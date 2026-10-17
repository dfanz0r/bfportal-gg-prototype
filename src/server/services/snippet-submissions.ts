import { and, asc, desc, eq, like } from 'drizzle-orm'

import { fieldErrors } from '../../shared/form-input'
import { gameList } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import { slugify } from '../../shared/slug'
import { snippetFormSchema } from '../../shared/snippet-form'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { categories, sdkVersions, snippets } from '../db/schema'
import { renderMarkdown } from '../markdown'
import { discardDraft } from './drafts'
import { violates } from './shared'
import { submissionLimit, withinLimit } from './submission-limits'

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
 * Creates a pending snippet from a submitted form, for whoever is acting.
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

  // Told early, before anything else is read. The write is what holds to it.
  const limited = await submissionLimit(actor, now)
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
          slug,
          status: 'pending',
          title: form.title,
          descriptionMd: form.description,
          descriptionHtml: renderMarkdown(form.description),
          ownerId: actor.id,
          categoryId: category.id,
          script: form.script,
          sdkVersionId: sdk?.id ?? null,
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
