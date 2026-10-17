import { createHash } from 'node:crypto'
import { and, count, desc, eq, inArray, isNull, like, or } from 'drizzle-orm'

import type { Game } from '../../shared/content'
import {
  experienceFormSchema,
  formErrors,
  MAX_CREDITS,
} from '../../shared/experience-form'
import { gameInfo, normalizeCode, parsePortalLink } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import { slugify } from '../../shared/slug'
import { teamTotals } from '../../shared/teams'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experienceCreators,
  experienceMedia,
  experiences,
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
import { renderMarkdown } from '../markdown'
import { discardDraft } from './drafts'
import { ownEditable } from './experience-drafts'
import {
  heldFilesFor,
  letGoOfDraftFiles,
  letGoOfHeldFiles,
  takeHeldFiles,
} from './held-files'
import { filesInExport, readExport } from './portal-export'
import { groupBy, violates } from './shared'
import { submissionLimit, withinLimit } from './submission-limits'

// Sharing an experience. What is submitted waits as `pending` until a
// moderator approves it; nothing here publishes anything.

/** The experience form's own fields, which a refused one is kept by. */
export const EXPERIENCE_FIELDS = Object.keys(experienceFormSchema.shape)

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

/**
 * Creates a pending experience from a submitted form, for whoever is acting.
 *
 * The form says what the creator chose. What Portal knows about the code (its
 * maps, its tags, whether it needs the paid game) is looked up here and not
 * taken from the form, so it cannot be made up. If gametools does not answer,
 * the submission still goes in, and the nightly check fills those in later.
 */
export async function submitExperience(
  actor: Actor | null,
  given: unknown,
  options: { lookup?: typeof lookupExperience; now?: Date } = {},
): Promise<{ ok: true; slug: string } | Refusal> {
  if (!actor) return refuse('signed-out')
  const parsed = experienceFormSchema.safeParse(given)
  if (!parsed.success) return refuse('invalid', formErrors(parsed.error))
  const form = parsed.data
  // A draft of theirs being sent in, rather than something new. Its game was
  // settled when it was first saved.
  const draft = form.editing ? await ownEditable(actor, form.editing) : null
  if (form.editing && !draft) return refuse('not-found')
  const game: Game = draft?.game ?? form.game
  const info = gameInfo(game)
  const now = options.now ?? new Date()
  const errors: Record<string, string> = {}

  // Every submission is a moderator's time, and a lookup on someone else's
  // service, so one over the limit is told before Portal is asked. The write
  // below is what holds to it.
  const limited = await submissionLimit(actor, now)
  if (limited) return limited

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
    ? await heldFilesFor(actor, form.files, { now, draft: draft?.id })
    : []
  const exported = held.filter((file) => file.kind === 'export')
  if (held.length < new Set(form.files).size && info.hasExport) {
    errors.files = 'A file is no longer held. Add it again.'
  } else if (exported.length > 1) {
    errors.files = 'Add one export.'
  }
  const fromExport = exported[0]?.summary ?? null
  // What one sent back was submitted with, which it keeps unless new files
  // are sent.
  const [{ value: storedFiles }] = draft
    ? await db
        .select({ value: count() })
        .from(projectFiles)
        .where(eq(projectFiles.experienceId, draft.id))
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
  if (Object.keys(errors).length > 0) return refuse('invalid', errors)

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

  const base = slugify(form.title) || 'experience'
  const [portalTags, tagsOfMaps, taken] = await Promise.all([
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
    db
      .select({ slug: experiences.slug })
      .from(experiences)
      .where(like(experiences.slug, `${base}%`)),
  ])
  // A tag keeps the first source that gave it: the creator's choice, then
  // Portal's, then the maps'.
  const tagged = [
    ...chosenTags.map((tag) => ({ tagId: tag.id, source: 'creator' as const })),
    ...portalTags.map((tag) => ({ tagId: tag.id, source: 'portal' as const })),
    ...tagsOfMaps.map((tag) => ({ tagId: tag.id, source: 'map' as const })),
  ]

  // The address is the title, with a number after it if that is taken. What
  // was read above can be out of date by the time this writes: two people can
  // send the same title at once. The database is what knows, so a taken
  // address is found out by trying, and the next one is tried.
  const used = new Set(taken.map((row) => row.slug))
  for (let attempt = 0; ; attempt += 1) {
    let slug = base
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`
    try {
      const written = await withinLimit(actor, now, async (tx) => {
        const values: Omit<typeof experiences.$inferInsert, 'slug'> = {
          game,
          status: 'pending',
          title: form.title,
          descriptionMd: form.description,
          descriptionHtml: renderMarkdown(form.description),
          ownerId: actor.id,
          categoryId: category.id,
          code,
          playgroundId: found?.playgroundId ?? linked?.playgroundId ?? null,
          copyAllowed: form.copyAllowed,
          coverImgUrl: form.coverImgUrl ?? found?.thumbnailUrl ?? null,
          repoUrl: form.repoUrl,
          // A game with no export has no files to host elsewhere.
          filesUrl: info.hasExport ? form.filesUrl : undefined,
          maxPlayers: totals.players,
          maxBots: totals.bots,
          teamSetup: teams,
          types: built,
          // Chosen on the form, or said by the category it was put in.
          isTemplate: offered || category.marksTemplate,
          gameMode: portalRotation[0]?.mode,
          mapRotation:
            rotation.length > 0 ? rotation.map((entry) => entry.stored) : null,
          xpMode: found?.xpMode,
          requiresFullGame: found?.requiresFullGame ?? fromMaps(),
          sdkVersionId: sdk?.id ?? null,
          // What was just looked up counts as the first check of the code.
          portalState: found
            ? found.published
              ? 'published'
              : 'unpublished'
            : 'unchecked',
          portalCheckedAt: found ? now : null,
          portalStateSince: found ? now : null,
          submittedAt: now,
        }
        // Sent back and sent again with no code and no new export: its maps
        // are still what its files said, so they stay.
        if (draft && !found && !fromExport && storedFiles > 0) {
          delete values.mapRotation
          delete values.gameMode
          delete values.requiresFullGame
        }
        // A draft, or one sent back, becomes the submission at the address it
        // already has. What it had is replaced by what was just checked.
        const [created] = draft
          ? await tx
              .update(experiences)
              // The last decision was about what was sent before. What is
              // sent now waits for its own.
              .set({
                ...values,
                draftForm: null,
                reviewedBy: null,
                reviewedAt: null,
                reviewNote: null,
                reviewFieldNotes: {},
              })
              .where(
                and(
                  eq(experiences.id, draft.id),
                  inArray(experiences.status, ['draft', 'changes_requested']),
                  // Still there: deleted since it was read, it is not
                  // submitted, and nothing reports that it was.
                  isNull(experiences.deletedAt),
                ),
              )
              .returning({ id: experiences.id })
          : await tx
              .insert(experiences)
              .values({ ...values, slug })
              .returning({ id: experiences.id })
        if (!created) return refuse('not-found')
        if (draft) {
          for (const table of [
            experienceTags,
            experienceMedia,
            experienceCreators,
          ]) {
            await tx.delete(table).where(eq(table.experienceId, draft.id))
          }
          // Files sent before stay unless new ones are sent: one sent back
          // keeps what it was submitted with when only its text changes.
          if (held.length > 0) {
            await tx
              .delete(projectFiles)
              .where(eq(projectFiles.experienceId, draft.id))
          }
        }

        if (tagged.length > 0) {
          await tx
            .insert(experienceTags)
            .values(tagged.map((tag) => ({ experienceId: created.id, ...tag })))
            .onConflictDoNothing()
        }
        if (form.media.length > 0) {
          await tx.insert(experienceMedia).values(
            form.media.map((url, position) => ({
              experienceId: created.id,
              position,
              url,
            })),
          )
        }
        // Accounts first, then names, as the form shows them. An account is
        // asked and not shown until it accepts, and edits nothing until the
        // owner says so.
        const creators = [
          ...credited.map((account) => ({ userId: account.id })),
          ...credits.map((name) => ({ name })),
        ]
        if (creators.length > 0) {
          await tx.insert(experienceCreators).values(
            creators.map((creator, position) => ({
              experienceId: created.id,
              ...creator,
              position,
            })),
          )
        }
        // Its files are kept: the export as it was, what is inside it one
        // file at a time, and what was added beside it. Only its owner and
        // the moderators can download them until it is a template, which its
        // owner can ask for later.
        if (held.length > 0) {
          const files = await takeHeldFiles(tx, actor, form.files, {
            now,
            draft: draft?.id,
          })
          await tx.insert(projectFiles).values(
            files.flatMap((file) => {
              const row = {
                experienceId: created.id,
                kind: file.kind,
                filename: file.filename,
                sizeBytes: file.sizeBytes,
                sha256: file.sha256,
                body: file.body,
                uploadedBy: actor.id,
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
        // It went through, so a kept copy of a refused form, and the files it
        // held, have done their job.
        await discardDraft(tx, actor)
        await letGoOfHeldFiles(tx, actor)
        if (draft) await letGoOfDraftFiles(tx, draft.id)
        return { ok: true as const, slug: draft?.slug ?? slug }
      })
      return written
    } catch (error) {
      if (!violates(error, 'experiences_slug_unique') || attempt >= 10) {
        throw error
      }
      used.add(slug)
    }
  }
}
