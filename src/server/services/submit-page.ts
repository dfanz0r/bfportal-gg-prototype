import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm'

import { type Game, games } from '../../shared/content'
import { defaultGame, normalizeCode, parsePortalLink } from '../../shared/games'
import { teamSetupSchema } from '../../shared/teams'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experienceCreators,
  experienceMedia,
  experienceTags,
  projectFiles,
  sdkVersions,
  tagGroups,
  tags,
  user,
} from '../db/schema'
import { lookupExperience } from '../integrations/gametools'
import { allow } from '../rate-limit'
import { type Draft, readDraft } from './drafts'
import type { PreparedExperience } from './edit-payload'
import { type Editable, isLive, ownEditable } from './experience-drafts'
import { lastSentEdit } from './experience-edits'
import { heldFilesFor, heldIdsIn } from './held-files'
import { ownSubmissionTally } from './own-submissions'
import { peopleByDiscordId } from './people'
import { groupBy } from './shared'

// What the page for sharing an experience starts from: what the form offers
// for the game, what Portal says about a code, and a refused form to show
// again.

/** How many codes one account may look up in a minute. */
const LOOKUPS_PER_MINUTE = 20

/** What the page's address can ask for. */
export type SubmitSearch = {
  game?: Game
  code?: string
  link?: string
  /** Show this visitor's last refused form again. */
  draft?: boolean
}

/**
 * The submit page for whoever is acting. `login` for a visitor who is not
 * signed in, who may not submit and may not use this to look codes up.
 */
export async function getSubmitPage(
  actor: Actor | null,
  search: SubmitSearch,
  options: { lookup?: typeof lookupExperience } = {},
) {
  if (!actor) return { state: 'login' as const }
  const kept = search.draft ? await readDraft(actor, 'experience') : null
  // A kept form from editing a draft is that draft's page's to show.
  const draft = kept?.fields.editing ? null : kept
  return pageFor(actor, search, draft, null, options)
}

/**
 * The form for one of theirs to go on with: a draft, one a moderator sent
 * back, one waiting for review, or one that is live. As it was last sent and
 * refused when `search.draft` says so, or as it was last saved, or else as
 * it was last sent: for something live, its waiting or sent-back edit, and
 * otherwise its row. `not-found` for one that is not theirs.
 */
export async function getDraftEditPage(
  actor: Actor | null,
  slug: string,
  search: Omit<SubmitSearch, 'game'>,
  options: { lookup?: typeof lookupExperience } = {},
) {
  if (!actor) return { state: 'login' as const }
  const saved = await ownEditable(actor, slug)
  if (!saved) return { state: 'not-found' as const }
  const sentEdit = isLive(saved.status) ? await lastSentEdit(saved.id) : null
  const kept = search.draft ? await readDraft(actor, 'experience') : null
  const draft =
    kept?.fields.editing === slug
      ? kept
      : (saved.draftForm ?? {
          fields: sentEdit
            ? await formFromPrepared(saved, sentEdit.form)
            : await formFromRow(saved),
          errors: {},
        })
  return pageFor(actor, search, draft, saved, options, sentEdit)
}

/**
 * The form as an edit sent from it says it was filled in. What was checked
 * is stored by id; the form names things as it offers them.
 */
async function formFromPrepared(saved: Editable, form: PreparedExperience) {
  const chosen = form.tagged
    .filter((tag) => tag.source === 'creator')
    .map((tag) => tag.tagId)
  const [[category], tagRows, accounts] = await Promise.all([
    db
      .select({ slug: categories.slug })
      .from(categories)
      .where(eq(categories.id, form.values.categoryId)),
    chosen.length > 0
      ? db
          .select({ id: tags.id, slug: tags.slug })
          .from(tags)
          .where(inArray(tags.id, chosen))
      : [],
    form.credited.length > 0
      ? db
          .select({ id: user.id, discordId: user.discordId })
          .from(user)
          .where(inArray(user.id, form.credited))
      : [],
  ])
  const { values } = form
  const fields: Record<string, string | string[]> = {
    game: saved.game,
    title: values.title,
    description: values.descriptionMd,
    category: category?.slug ?? saved.category,
    code: values.code ?? '',
    coverImgUrl: values.coverImgUrl ?? '',
    repoUrl: values.repoUrl ?? '',
    filesUrl: values.filesUrl ?? '',
    built: values.types,
    tags: chosen.flatMap(
      (id) => tagRows.find((row) => row.id === id)?.slug ?? [],
    ),
    media: form.media,
    credits: form.credits,
    creditAccounts: form.credited.flatMap(
      (id) => accounts.find((row) => row.id === id)?.discordId ?? [],
    ),
    files: form.files,
    teamPlayers: values.teamSetup.map((team) => String(team.players)),
    teamBots: values.teamSetup.map((team) => String(team.bots)),
  }
  if (saved.isTemplate) fields.isTemplate = 'true'
  if (values.copyAllowed) fields.copyAllowed = 'true'
  return fields
}

/**
 * The form as its row says it was filled in: for one sent back, everything
 * that was submitted; for a draft saved before drafts kept their form, such
 * as one from the seed, what it has.
 */
async function formFromRow(saved: Editable) {
  const [tagRows, mediaRows, creatorRows] = await Promise.all([
    db
      .select({ slug: tags.slug })
      .from(experienceTags)
      .innerJoin(tags, eq(tags.id, experienceTags.tagId))
      .where(
        and(
          eq(experienceTags.experienceId, saved.id),
          eq(experienceTags.source, 'creator'),
        ),
      ),
    db
      .select({ url: experienceMedia.url })
      .from(experienceMedia)
      .where(eq(experienceMedia.experienceId, saved.id))
      .orderBy(asc(experienceMedia.position)),
    db
      .select({
        name: experienceCreators.name,
        discordId: user.discordId,
      })
      .from(experienceCreators)
      .leftJoin(user, eq(user.id, experienceCreators.userId))
      .where(eq(experienceCreators.experienceId, saved.id))
      .orderBy(asc(experienceCreators.position)),
  ])
  const teams = teamSetupSchema.safeParse(saved.teamSetup).data ?? []
  const fields: Record<string, string | string[]> = {
    game: saved.game,
    title: saved.title,
    description: saved.descriptionMd,
    category: saved.category,
    code: saved.code ?? '',
    coverImgUrl: saved.coverImgUrl ?? '',
    repoUrl: saved.repoUrl ?? '',
    filesUrl: saved.filesUrl ?? '',
    built: saved.types,
    tags: tagRows.map((row) => row.slug),
    media: mediaRows.map((row) => row.url),
    credits: creatorRows.flatMap((row) => (row.name ? [row.name] : [])),
    creditAccounts: creatorRows.flatMap((row) =>
      row.discordId ? [row.discordId] : [],
    ),
  }
  if (teams.length > 0) {
    fields.teamPlayers = teams.map((team) => String(team.players))
    fields.teamBots = teams.map((team) => String(team.bots))
  }
  if (saved.isTemplate) fields.isTemplate = 'true'
  if (saved.copyAllowed) fields.copyAllowed = 'true'
  return fields
}

async function pageFor(
  actor: Actor,
  search: SubmitSearch,
  draft: Draft | null,
  editing: Editable | null,
  options: { lookup?: typeof lookupExperience },
  sentEdit: Awaited<ReturnType<typeof lastSentEdit>> = null,
) {
  // A kept form says what it was for, where the address does not.
  const kept = (name: string) => {
    const value = draft?.fields[name]
    return typeof value === 'string' && value ? value : undefined
  }
  const typedLink = search.link ?? kept('link')
  const typedCode = search.code ?? kept('code')
  const linked = typedLink ? parsePortalLink(typedLink) : null
  // A draft's game was settled when it was first saved. Otherwise a pasted
  // link says which game it is for.
  const game =
    editing?.game ??
    linked?.game ??
    search.game ??
    games.find((item) => item === kept('game')) ??
    defaultGame.id
  const code = typedCode ? normalizeCode(game, typedCode) : null
  const by = code
    ? { code }
    : linked
      ? { playgroundId: linked.playgroundId }
      : null
  // Each lookup is a request to someone else's service.
  const limited =
    by !== null && !allow(`lookup:${actor.id}`, LOOKUPS_PER_MINUTE, 60 * 1000)

  const [offered, looked, credited, held, tally] = await Promise.all([
    getSubmitOptions(game),
    by && !limited ? (options.lookup ?? lookupExperience)(game, by) : null,
    // A kept form holds the accounts it credited by id. The form shows
    // their names and pictures.
    peopleByDiscordId(
      [draft?.fields.creditAccounts ?? []].flat().map(String).slice(0, 20),
    ),
    // And the files it holds, by id: what each is, not what it says.
    heldFilesFor(actor, heldIdsIn(draft?.fields.files), {
      draft: editing?.id,
    }),
    // Where the rest of theirs stand, for the side of the page.
    ownSubmissionTally(actor),
  ])
  const found = looked?.status === 'found' ? looked.experience : null
  return {
    state: 'ok' as const,
    game,
    // What was typed, as typed, for the fields to start from.
    code: typedCode ?? '',
    link: typedLink ?? '',
    // The code or link that was typed and could not be read.
    unreadable: Boolean((typedCode && !code) || (typedLink && !linked)),
    lookup: limited ? ('limited' as const) : (looked?.status ?? null),
    options: offered,
    // What Portal says, to start the form from. The creator can change any
    // of it; what is stored about the code is looked up again on submit.
    found: found && {
      code: found.code,
      title: found.title,
      description: found.description,
      thumbnailUrl: found.thumbnailUrl,
      published: found.published,
      maps: found.rotation.map((entry) => entry.name ?? entry.levelId ?? ''),
      players: Math.max(
        0,
        ...found.rotation.map((entry) =>
          entry.teams.reduce((sum, team) => sum + team, 0),
        ),
      ),
      // The players on each team of the first map, to start the teams from.
      teams: found.rotation[0]?.teams ?? [],
      tags: found.tags,
    },
    draft,
    credited,
    held,
    tally,
    // When the page's data was read, to say how long ago it was saved.
    now: new Date(),
    // The draft this form is, when it is one.
    editing: editing && {
      slug: editing.slug,
      title: editing.title,
      // When its form was last saved: for a draft or one sent back, its
      // row; for one already sent, only when a form is kept.
      savedAt:
        editing.status === 'draft' ||
        editing.status === 'changes_requested' ||
        editing.draftForm
          ? editing.updatedAt
          : null,
      status: editing.status,
      // What a moderator wrote when sending it, or its last edit, back. Who
      // wrote it is not passed on.
      reviewNote:
        editing.status === 'changes_requested'
          ? editing.reviewNote
          : (sentEdit?.note ?? null),
      // For something live: whether an edit sent from here is waiting.
      editWaiting: sentEdit?.waiting === true,
      // The export and files it was submitted with, which stay unless new
      // ones are chosen.
      submittedFiles: editing
        ? await db
            .select({
              id: projectFiles.publicId,
              kind: projectFiles.kind,
              filename: projectFiles.filename,
              sizeBytes: projectFiles.sizeBytes,
            })
            .from(projectFiles)
            .where(
              and(
                eq(projectFiles.experienceId, editing.id),
                eq(projectFiles.fromExport, false),
              ),
            )
            .orderBy(asc(projectFiles.id))
        : [],
    },
  }
}

/**
 * What the submit form offers for a game: its categories and the tags a
 * creator may choose. With them, the game's current SDK release, which the
 * form states and does not ask for.
 */
export async function getSubmitOptions(game: Game) {
  const [categoryRows, tagRows, [currentSdk]] = await Promise.all([
    db
      .select({
        name: categories.name,
        slug: categories.slug,
        marksTemplate: categories.marksTemplate,
      })
      .from(categories)
      .where(
        and(
          eq(categories.kind, 'experience_main'),
          eq(categories.visible, true),
          eq(categories.selectableOnForm, true),
          or(isNull(categories.game), eq(categories.game, game)),
        ),
      )
      .orderBy(asc(categories.sortOrder)),
    db
      .select({
        group: tagGroups.name,
        description: tagGroups.description,
        pick: tagGroups.pick,
        name: tags.name,
        slug: tags.slug,
        portalId: tags.portalId,
      })
      .from(tags)
      .innerJoin(tagGroups, eq(tagGroups.id, tags.groupId))
      .where(
        and(
          eq(tags.game, game),
          eq(tags.visible, true),
          eq(tagGroups.creatorSelectable, true),
        ),
      )
      .orderBy(asc(tagGroups.sortOrder), asc(tags.sortOrder), asc(tags.name)),
    db
      .select({ version: sdkVersions.version, season: sdkVersions.season })
      .from(sdkVersions)
      .where(eq(sdkVersions.game, game))
      .orderBy(desc(sdkVersions.sortOrder))
      .limit(1),
  ])
  return {
    categories: categoryRows,
    tagGroups: [...groupBy(tagRows, (row) => row.group).values()].map(
      (group) => ({
        name: group[0].group,
        description: group[0].description,
        pick: group[0].pick,
        tags: group.map((tag) => ({
          name: tag.name,
          slug: tag.slug,
          portalId: tag.portalId,
        })),
      }),
    ),
    currentSdk: currentSdk ?? null,
  }
}
