import { and, asc, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm'

import { fieldErrors } from '../../shared/form-input'
import { gameList } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import { slugify } from '../../shared/slug'
import { snippetFormSchema } from '../../shared/snippet-form'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { categories, sdkVersions, snippets } from '../db/schema'
import { renderMarkdown } from '../markdown'
import { discardDraft, readDraft } from './drafts'
import { violates } from './shared'
import {
  lastSentSnippetEdit,
  ownSnippet,
  submitSnippetEdit,
} from './snippet-edits'
import { resendLimit, submissionLimit, withinLimit } from './submission-limits'

// Sharing a snippet: a small, reusable piece of script. Like an experience it
// waits as `pending` until a moderator approves it; nothing here publishes
// anything.

/** The snippet form's own fields, which a refused one is kept by. */
export const SNIPPET_FIELDS = Object.keys(snippetFormSchema.shape)

/** The game snippets are for: the one whose editor has scripting. */
const snippetGame = () => gameList.find((game) => game.snippets === true)

/** The newest SDK release of the game snippets are for, if any is recorded. */
const currentSdk = async () => {
  const game = snippetGame()
  if (!game) return null
  const [release] = await db
    .select({ id: sdkVersions.id, version: sdkVersions.version })
    .from(sdkVersions)
    .where(eq(sdkVersions.game, game.id))
    .orderBy(desc(sdkVersions.sortOrder))
    .limit(1)
  return release ?? null
}

/** The categories a snippet can be listed under. */
const snippetCategories = () =>
  db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(
      and(
        eq(categories.kind, 'script_main'),
        eq(categories.visible, true),
        eq(categories.selectableOnForm, true),
      ),
    )
    .orderBy(asc(categories.sortOrder))

/**
 * Sends the snippet form for review, for whoever is acting: a new snippet,
 * one sent back, or one already waiting, whose new version takes the old
 * one's place in the queue. For one that is live it is an edit, which waits
 * beside the live page: `submitSnippetEdit`.
 *
 * It counts against the same limits as an experience. The SDK release it is
 * listed for is not asked: it is the current one.
 */
export async function submitSnippet(
  actor: Actor | null,
  given: unknown,
  options: { now?: Date } = {},
): Promise<{ ok: true; slug: string } | Refusal> {
  if (!actor) return refuse('signed-out')
  const parsed = snippetFormSchema.safeParse(given)
  if (!parsed.success) return refuse('invalid', fieldErrors(parsed.error))
  const form = parsed.data
  const now = options.now ?? new Date()
  // One of theirs being sent again, rather than something new.
  const sent = form.editing ? await ownSnippet(actor, form.editing) : null
  if (form.editing && !sent) return refuse('not-found')

  // Told early, before anything else is read. The write is what holds to it.
  // One already waiting is not another submission: sending it again is held
  // to its own limit.
  const resending = sent?.status === 'pending'
  const limited =
    resending || sent?.status === 'published'
      ? resendLimit(actor)
      : await submissionLimit(actor, now)
  if (limited) return limited

  const [available, sdk] = await Promise.all([
    snippetCategories(),
    currentSdk(),
  ])
  const category = available.find((item) => item.slug === form.category)
  if (!category) {
    return refuse('invalid', {
      category: 'Choose one of the categories offered.',
    })
  }
  if (sent?.status === 'published') {
    return submitSnippetEdit(actor, form, sent, category.id, now)
  }

  const values = {
    status: 'pending' as const,
    title: form.title,
    descriptionMd: form.description,
    descriptionHtml: renderMarkdown(form.description),
    categoryId: category.id,
    script: form.script,
    sdkVersionId: sdk?.id ?? null,
  }
  if (sent) {
    return withinLimit(
      actor,
      now,
      async (tx) => {
        // In place, at its address. What it had is replaced, its version
        // moves on so a decision on what was there before is refused, and
        // the last decision, which was about that, is cleared.
        const [written] = await tx
          .update(snippets)
          .set({
            ...values,
            // One waiting keeps its place in the queue.
            ...(resending ? {} : { submittedAt: now }),
            version: sql`${snippets.version} + 1`,
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: null,
            reviewFieldNotes: {},
          })
          .where(
            and(
              eq(snippets.id, sent.id),
              inArray(snippets.status, ['changes_requested', 'pending']),
              isNull(snippets.deletedAt),
            ),
          )
          .returning({ id: snippets.id })
        if (!written) return refuse('not-found')
        await discardDraft(tx, actor)
        return { ok: true as const, slug: sent.slug }
      },
      { counted: !resending },
    )
  }

  // The address is the title, with a number after it if that is taken. As
  // for an experience, the database is what knows: a taken address is found
  // by trying, and the next one is tried.
  const base = slugify(form.title) || 'snippet'
  const taken = await db
    .select({ slug: snippets.slug })
    .from(snippets)
    .where(like(snippets.slug, `${base}%`))
  const used = new Set(taken.map((row) => row.slug))
  for (let attempt = 0; ; attempt += 1) {
    let slug = base
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`
    try {
      return await withinLimit(actor, now, async (tx) => {
        await tx.insert(snippets).values({
          ...values,
          slug,
          ownerId: actor.id,
          submittedAt: now,
        })
        // It went through, so a kept copy of a refused form has done its job.
        await discardDraft(tx, actor)
        return { ok: true as const, slug }
      })
    } catch (error) {
      if (!violates(error, 'snippets_slug_unique') || attempt >= 10) {
        throw error
      }
      used.add(slug)
    }
  }
}

/**
 * The snippet form for one of theirs to change: one sent back, one in review,
 * or one that is live. As it was last sent and refused when `search.draft`
 * says so, or else as it was last sent: for one that is live, its waiting or
 * sent-back edit, and otherwise its row. `not-found` for one that is not
 * theirs.
 */
export async function getSnippetEditPage(
  actor: Actor | null,
  slug: string,
  search: { draft?: boolean },
) {
  if (!actor) return { state: 'login' as const }
  const sent = await ownSnippet(actor, slug)
  if (!sent) return { state: 'not-found' as const }
  const [options, kept, sentEdit] = await Promise.all([
    getSnippetOptions(),
    search.draft ? readDraft(actor, 'snippet') : null,
    sent.status === 'published' ? lastSentSnippetEdit(sent.id) : null,
  ])
  const draft =
    kept?.fields.editing === slug
      ? kept
      : {
          fields: {
            ...(sentEdit?.fields ?? {
              title: sent.title,
              description: sent.descriptionMd,
              script: sent.script,
              category: sent.category ?? '',
            }),
            editing: slug,
          },
          errors: {},
        }
  return {
    state: 'ok' as const,
    options,
    draft,
    editing: {
      slug: sent.slug,
      title: sent.title,
      status: sent.status,
      // What a moderator wrote when sending it, or its last edit, back. Who
      // wrote it is not passed on.
      reviewNote:
        sent.status === 'changes_requested'
          ? sent.reviewNote
          : (sentEdit?.note ?? null),
      editWaiting: sentEdit?.waiting === true,
    },
  }
}

/**
 * What the snippet form offers: its categories, and the SDK release a
 * submission will be listed for, which the form states and does not ask.
 */
export async function getSnippetOptions() {
  const [available, sdk] = await Promise.all([
    snippetCategories(),
    currentSdk(),
  ])
  return {
    categories: available.map((item) => ({ name: item.name, slug: item.slug })),
    currentSdk: sdk ? { version: sdk.version } : null,
  }
}
