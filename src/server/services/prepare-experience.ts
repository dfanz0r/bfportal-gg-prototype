import { createHash } from 'node:crypto'
import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm'

import type { Game } from '../../shared/content'
import { type ExperienceForm, MAX_CREDITS } from '../../shared/experience-form'
import { gameInfo, normalizeCode, parsePortalLink } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import { teamTotals } from '../../shared/teams'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experienceCreators,
  experienceMedia,
  experienceTags,
  maps,
  mapTags,
  projectFiles,
  sdkVersions,
  tagGroups,
  tags,
  user,
} from '../db/schema'
import { lookupExperience } from '../integrations/gametools'
import { allowLookup } from '../rate-limit'
import type { PreparedExperience } from './edit-payload'
import type { Editable } from './experience-drafts'
import { heldFilesFor, type takeHeldFiles } from './held-files'
import { filesInExport, readExport } from './portal-export'
import { type Executor, groupBy } from './shared'

// The experience form, checked and worked out into what is stored, and the
// writing of the rows beside an experience. A new submission, one sent again
// and an edit to a live one all go through here, so each is held to the same
// rules and written the same way.

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

/**
 * Checks the form for whoever is acting, and works out what it stores: what
 * Portal says about the code, the maps and tags that follow from it, and the
 * files it holds. `target` is the row it changes, if it changes one. Nothing
 * is written.
 *
 * The form says what the creator chose. What Portal knows about the code (its
 * maps, its tags, whether it needs the paid game) is looked up here and not
 * taken from the form, so it cannot be made up. If gametools does not answer,
 * it still goes in, and the nightly check fills those in later.
 */
export async function prepareExperience(
  actor: Actor,
  form: ExperienceForm,
  target: Editable | null,
  options: { lookup?: typeof lookupExperience; now: Date },
): Promise<
  | {
      ok: true
      game: Game
      prepared: PreparedExperience
      /** The held files it names, as checked now. */
      held: Awaited<ReturnType<typeof heldFilesFor>>
    }
  | Refusal
> {
  const { now } = options
  // Its game was settled when it was first saved.
  const game: Game = target?.game ?? form.game
  const info = gameInfo(game)
  const errors: Record<string, string> = {}

  const typed = form.code ? normalizeCode(game, form.code) : null
  if (form.code && !typed) {
    errors.code = `That is not a ${info.name} experience code.`
  }
  const linked = form.link ? parsePortalLink(form.link) : null
  if (form.link && linked?.game !== game) {
    errors.link = `That is not a link to a ${info.name} experience on Portal.`
  }
  // Where a game's Portal has an export, a template is a choice on the form
  // and can be shared as files alone. Anything else is played by code, which
  // a link may yet supply. A form for a game with no export cannot say this.
  const offered = info.hasExport && form.isTemplate
  if (!form.code && !form.link && !offered) {
    errors.code = info.hasExport
      ? 'Give its experience code. Only a template can go without.'
      : 'Give its experience code, or a link to it on Portal.'
  }
  const built = info.builtWith.length > 0 ? form.built : []
  // The teams, paired up in order. Their totals are what listings show.
  const teams = form.teamPlayers.map((players, index) => ({
    players,
    bots: form.teamBots[index] ?? 0,
  }))
  const totals = teamTotals(teams)
  if (teams.length === 0 || form.teamBots.length > teams.length) {
    errors.teams = 'Say how many play on each team.'
  } else if (teams.some((team) => team.players + team.bots === 0)) {
    errors.teams = 'Each team needs players or bots.'
  } else if (totals.players === 0) {
    errors.teams = 'Say how many people can play.'
  } else if (totals.players > info.maxPlayers) {
    errors.teams = `A ${info.name} match holds up to ${info.maxPlayers} players.`
  } else if (totals.bots > info.maxPlayers) {
    errors.teams = `A ${info.name} match holds up to ${info.maxPlayers} bots.`
  }
  if (built.includes('verified') && built.length > 1) {
    errors.built =
      'A verified mode has no script, blocks or custom map. Choose one or the other.'
  }

  const accounts = [...new Set(form.creditAccounts)]
  const credits = [...new Set(form.credits)]
  if (accounts.length + credits.length > MAX_CREDITS) {
    errors.credits = `Credit up to ${MAX_CREDITS} people.`
  }

  // Files chosen earlier, held for this account. One held too long has been
  // let go, and one held for someone else is not theirs to send.
  const held = info.hasExport
    ? await heldFilesFor(actor, form.files, { now, draft: target?.id })
    : []
  const exported = held.filter((file) => file.kind === 'export')
  if (held.length < new Set(form.files).size && info.hasExport) {
    errors.files = 'A file is no longer held. Add it again.'
  } else if (exported.length > 1) {
    errors.files = 'Add one export.'
  }
  const fromExport = exported[0]?.summary ?? null
  // What it was sent with before, which it keeps unless new files are sent.
  const [{ value: storedFiles }] = target
    ? await db
        .select({ value: count() })
        .from(projectFiles)
        .where(eq(projectFiles.experienceId, target.id))
    : [{ value: 0 }]
  // A template with no code is taken as its files, so it needs some.
  if (offered && !form.code && !form.link && !errors.files) {
    if (held.length === 0 && storedFiles === 0 && !form.filesUrl) {
      errors.files =
        'A template with no code needs its export, or a link to its files.'
    }
  }

  const [[category], [sdk], chosenTags, gameMaps, creditedRows] =
    await Promise.all([
      db
        .select({ id: categories.id, marksTemplate: categories.marksTemplate })
        .from(categories)
        .where(
          and(
            eq(categories.kind, 'experience_main'),
            eq(categories.slug, form.category),
            eq(categories.visible, true),
            eq(categories.selectableOnForm, true),
            or(isNull(categories.game), eq(categories.game, game)),
          ),
        )
        .limit(1),
      // The release it is for is not asked: a game only ever runs its latest,
      // so whatever is submitted today is for that one. A game with no
      // releases recorded has none to set.
      db
        .select({ id: sdkVersions.id })
        .from(sdkVersions)
        .where(eq(sdkVersions.game, game))
        .orderBy(desc(sdkVersions.sortOrder))
        .limit(1),
      // Only tags of this game, from groups creators may choose from. Anything
      // else in the list is not a tag here, and is left out.
      form.tags.length > 0
        ? db
            .select({
              id: tags.id,
              group: tagGroups.name,
              groupId: tagGroups.id,
              pick: tagGroups.pick,
            })
            .from(tags)
            .innerJoin(tagGroups, eq(tagGroups.id, tags.groupId))
            .where(
              and(
                eq(tags.game, game),
                inArray(tags.slug, form.tags),
                eq(tags.visible, true),
                eq(tagGroups.creatorSelectable, true),
              ),
            )
        : [],
      db
        .select({
          id: maps.id,
          levelId: maps.levelId,
          name: maps.name,
          requiresFullGame: maps.requiresFullGame,
        })
        .from(maps)
        .where(eq(maps.game, game)),
      // Only accounts the search would offer: one that hides its name is not
      // to be found by its id instead.
      accounts.length > 0
        ? db
            .select({ id: user.id, discordId: user.discordId })
            .from(user)
            .where(
              and(
                inArray(user.discordId, accounts),
                eq(user.hideUsername, false),
              ),
            )
        : [],
    ])
  if (!category) errors.category = 'Choose one of the categories offered.'
  if (creditedRows.length < accounts.length) {
    errors.credits = 'Someone credited is no longer here. Choose them again.'
  }
  // In the order they were chosen. The owner is credited already.
  const credited = accounts.flatMap((discordId) =>
    creditedRows.filter(
      (row) => row.discordId === discordId && row.id !== actor.id,
    ),
  )
  // A group an admin set to one choice takes one.
  for (const group of groupBy(chosenTags, (tag) => tag.groupId).values()) {
    if (group[0].pick === 'one' && group.length > 1) {
      errors.tags = `Choose only one under ${group[0].group}.`
    }
  }

  // Ask Portal about it, unless the form is already known to be wrong.
  const by = typed
    ? { code: typed }
    : linked?.playgroundId
      ? { playgroundId: linked.playgroundId }
      : null
  // Each lookup is a request to someone else's service, counted with those
  // "Fetch details" makes: a submission refused for its code is not a way
  // round the limit.
  if (by && Object.keys(errors).length === 0 && !allowLookup(actor.id)) {
    return refuse('invalid', {
      [typed ? 'code' : 'link']:
        'That is a lot of lookups in a short time. Wait a minute, then submit it again.',
    })
  }
  const looked =
    by && Object.keys(errors).length === 0
      ? await (options.lookup ?? lookupExperience)(game, by)
      : null
  if (looked?.status === 'missing') {
    errors[typed ? 'code' : 'link'] = 'Portal has no experience with this code.'
  }
  const found = looked?.status === 'found' ? looked.experience : null
  // Given a link and no code, Portal says what the code is.
  const code = typed ?? found?.code ?? null
  if (!code && !offered && Object.keys(errors).length === 0) {
    errors.code =
      'Give its experience code as well. Portal did not say what it is.'
  }
  if (Object.keys(errors).length > 0 || !category) {
    return refuse('invalid', errors)
  }

  // Each map of the rotation, matched to one the site knows: by level id
  // where gametools gives one, by name where it gives only that. With no code
  // to look up, the export says what the maps are.
  const portalRotation =
    found?.rotation ??
    (fromExport?.maps ?? []).map((levelId) => ({
      levelId,
      name: null,
      mode: fromExport?.mode ?? 'Custom',
      rounds: 1,
      teams: (fromExport?.teams ?? []).map((team) => team.players),
    }))
  const rotation = portalRotation.map((entry) => {
    const known = gameMaps.find(
      (map) =>
        (entry.levelId && map.levelId === entry.levelId) ||
        (entry.name && map.name.toLowerCase() === entry.name.toLowerCase()),
    )
    return {
      known,
      stored: {
        map: known?.levelId ?? entry.levelId ?? entry.name ?? 'Unknown map',
        mode: entry.mode,
        rounds: entry.rounds,
        teams: entry.teams,
      },
    }
  })
  const knownMaps = rotation.flatMap((entry) =>
    entry.known ? [entry.known] : [],
  )

  // One paid map is enough to need the paid game; it is free only when every
  // map is known to be.
  const fromMaps = () => {
    if (!info.hasFreeVersion || rotation.length === 0) return null
    if (knownMaps.some((map) => map.requiresFullGame === true)) return true
    const allFree =
      knownMaps.length === rotation.length &&
      knownMaps.every((map) => map.requiresFullGame === false)
    return allFree ? false : null
  }

  const [portalTags, tagsOfMaps] = await Promise.all([
    found && found.tags.length > 0
      ? db
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.game, game), inArray(tags.portalId, found.tags)))
      : [],
    knownMaps.length > 0
      ? db
          .select({ id: mapTags.tagId })
          .from(mapTags)
          .where(
            inArray(
              mapTags.mapId,
              knownMaps.map((map) => map.id),
            ),
          )
      : [],
  ])

  const values: PreparedExperience['values'] = {
    title: form.title,
    descriptionMd: form.description,
    categoryId: category.id,
    code,
    playgroundId: found?.playgroundId ?? linked?.playgroundId ?? null,
    copyAllowed: form.copyAllowed,
    coverImgUrl: form.coverImgUrl ?? found?.thumbnailUrl ?? null,
    repoUrl: form.repoUrl ?? null,
    // A game with no export has no files to host elsewhere.
    filesUrl: info.hasExport ? (form.filesUrl ?? null) : undefined,
    maxPlayers: totals.players,
    maxBots: totals.bots,
    teamSetup: teams,
    types: built,
    // Chosen on the form, or said by the category it was put in.
    isTemplate: offered || category.marksTemplate,
    gameMode: portalRotation[0]?.mode ?? null,
    mapRotation:
      rotation.length > 0 ? rotation.map((entry) => entry.stored) : null,
    xpMode: found?.xpMode ?? null,
    requiresFullGame: found?.requiresFullGame ?? fromMaps(),
    sdkVersionId: sdk?.id ?? null,
    // What was just looked up counts as a check of the code.
    portalState: found
      ? found.published
        ? 'published'
        : 'unpublished'
      : 'unchecked',
    portalCheckedAt: found ? now : null,
    portalStateSince: found ? now : null,
  }
  // Whether it still names the same Portal experience it did: the same code,
  // or with no code the same link, or neither when it had neither.
  const samePortalExperience =
    target !== null &&
    (typed
      ? typed === target.code
      : linked?.playgroundId
        ? linked.playgroundId === target.playgroundId
        : !form.code && !form.link && !target.code)
  // Sent before, and sent again with nothing new to say what it plays: no
  // answer from Portal, and no new export. What it had stays, its maps, its
  // tags from Portal and the maps, and what Portal last said, until the
  // nightly check or the next answer says otherwise. Otherwise one edit made
  // while gametools is down would clear them. Only while it is the same
  // Portal experience: a new code is not described by the old one's facts,
  // which are left out, and it is unchecked until Portal answers.
  const keepPortalFacts = Boolean(
    target && !found && !fromExport && samePortalExperience,
  )
  if (keepPortalFacts) {
    for (const key of [
      'mapRotation',
      'gameMode',
      'requiresFullGame',
      'xpMode',
      'playgroundId',
      'portalState',
      'portalCheckedAt',
      'portalStateSince',
    ] as const) {
      delete values[key]
    }
    // A link to its page can still say where it is, where it had nothing.
    if (linked?.playgroundId) values.playgroundId = linked.playgroundId
  }

  return {
    ok: true,
    game,
    held,
    prepared: {
      values,
      // A tag keeps the first source that gave it: the creator's choice, then
      // Portal's, then the maps'.
      tagged: [
        ...chosenTags.map((tag) => ({
          tagId: tag.id,
          source: 'creator' as const,
        })),
        ...portalTags.map((tag) => ({
          tagId: tag.id,
          source: 'portal' as const,
        })),
        ...tagsOfMaps.map((tag) => ({ tagId: tag.id, source: 'map' as const })),
      ],
      media: form.media,
      credited: credited.map((account) => account.id),
      credits,
      files: held.map((file) => file.id),
      keepPortalFacts,
    },
  }
}

/** Files taken from those held, with what each says, to store. */
type TakenFile = Awaited<ReturnType<typeof takeHeldFiles>>[number]

/**
 * Writes the rows beside an experience from a checked form: its tags, its
 * gallery, its credits and, when new files were sent, its files. What it had
 * is replaced. An account credited before keeps its answer to the invitation
 * and what it may edit; one newly credited is asked.
 */
export async function writeAround(
  tx: Executor,
  experienceId: number,
  ownerId: string,
  prepared: PreparedExperience,
  files: TakenFile[],
) {
  const before = await tx
    .select({
      userId: experienceCreators.userId,
      canEdit: experienceCreators.canEdit,
      acceptedAt: experienceCreators.acceptedAt,
    })
    .from(experienceCreators)
    .where(eq(experienceCreators.experienceId, experienceId))
  for (const table of [experienceMedia, experienceCreators]) {
    await tx.delete(table).where(eq(table.experienceId, experienceId))
  }
  // Its tags from Portal and its maps stay when nothing new was learned
  // about them; the creator's own choices are always replaced.
  await tx
    .delete(experienceTags)
    .where(
      and(
        eq(experienceTags.experienceId, experienceId),
        prepared.keepPortalFacts
          ? eq(experienceTags.source, 'creator')
          : undefined,
      ),
    )
  if (prepared.tagged.length > 0) {
    await tx
      .insert(experienceTags)
      .values(prepared.tagged.map((tag) => ({ experienceId, ...tag })))
      .onConflictDoNothing()
  }
  if (prepared.media.length > 0) {
    await tx.insert(experienceMedia).values(
      prepared.media.map((url, position) => ({
        experienceId,
        position,
        url,
      })),
    )
  }
  // Accounts first, then names, as the form shows them. An account is asked
  // and not shown until it accepts, and edits nothing until the owner says so.
  const creators = [
    ...prepared.credited.map((userId) => {
      const was = before.find((row) => row.userId === userId)
      return {
        userId,
        canEdit: was?.canEdit ?? false,
        acceptedAt: was?.acceptedAt ?? null,
      }
    }),
    ...prepared.credits.map((name) => ({ name })),
  ]
  if (creators.length > 0) {
    await tx.insert(experienceCreators).values(
      creators.map((creator, position) => ({
        experienceId,
        ...creator,
        position,
      })),
    )
  }
  // Files sent before stay unless new ones are sent: one sent again keeps
  // what it was sent with when only its text changes. Its files are kept: the
  // export as it was, what is inside it one file at a time, and what was added
  // beside it. Only its owner and the moderators can download them until it
  // is a template.
  if (files.length > 0) {
    await tx
      .delete(projectFiles)
      .where(eq(projectFiles.experienceId, experienceId))
    await tx.insert(projectFiles).values(
      files.flatMap((file) => {
        const row = {
          experienceId,
          kind: file.kind,
          filename: file.filename,
          sizeBytes: file.sizeBytes,
          sha256: file.sha256,
          body: file.body,
          uploadedBy: ownerId,
        }
        const read = file.kind === 'export' && readExport(file.body)
        return [
          row,
          ...(read ? filesInExport(read.export) : []).map((inside) => ({
            ...row,
            ...inside,
            sizeBytes: Buffer.byteLength(inside.body),
            sha256: sha256(inside.body),
            fromExport: true,
          })),
        ]
      }),
    )
  }
}
