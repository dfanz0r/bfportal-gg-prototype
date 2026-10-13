import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  like,
  or,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'

import type { Game } from '../../shared/content'
import { experienceFormSchema, formErrors } from '../../shared/experience-form'
import { gameInfo, normalizeCode, parsePortalLink } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import { isStaff } from '../../shared/roles'
import { slugify } from '../../shared/slug'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experienceCreators,
  experienceImages,
  experiences,
  experienceTags,
  maps,
  mapTags,
  sdkVersions,
  submissionDrafts,
  tagGroups,
  tags,
} from '../db/schema'
import { lookupExperience } from '../integrations/gametools'
import { renderMarkdown } from '../markdown'
import { groupBy } from './shared'

// Sharing an experience. What is submitted waits as `pending` until a
// moderator approves it; nothing here publishes anything.

type Lookup = typeof lookupExperience

/** How many submissions one account may have waiting for a moderator. */
export const MAX_WAITING = 5
/** How many one account may send in a day. */
export const MAX_PER_DAY = 10

const DAY = 24 * 60 * 60 * 1000

/** Whether a failed insert was the address being taken by another row. */
function slugWasTaken(error: unknown) {
  for (
    let current = error;
    current;
    current = (current as { cause?: unknown }).cause
  ) {
    const { code, constraint_name: constraint } = current as {
      code?: string
      constraint_name?: string
    }
    if (code === '23505' && constraint === 'experiences_slug_unique')
      return true
  }
  return false
}

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
  options: { lookup?: Lookup; now?: Date } = {},
): Promise<{ ok: true; slug: string } | Refusal> {
  if (!actor) return refuse('signed-out')
  const parsed = experienceFormSchema.safeParse(given)
  if (!parsed.success) return refuse('invalid', formErrors(parsed.error))
  const form = parsed.data
  const game: Game = form.game
  const info = gameInfo(game)
  const now = options.now ?? new Date()
  const errors: Record<string, string> = {}

  // Every submission is a moderator's time, and a lookup on someone else's
  // service. Moderators and admins are trusted not to flood their own queue.
  if (!isStaff(actor.role)) {
    const [mine] = await db
      .select({
        waiting: count(
          sql`case when ${experiences.status} = 'pending' then 1 end`,
        ),
        today: count(
          sql`case when ${experiences.submittedAt} > ${new Date(now.getTime() - DAY).toISOString()}::timestamptz then 1 end`,
        ),
      })
      .from(experiences)
      .where(
        and(eq(experiences.ownerId, actor.id), isNull(experiences.deletedAt)),
      )
    if (mine.waiting >= MAX_WAITING) {
      return refuse('invalid', {
        form: `You have ${mine.waiting} submissions waiting for a moderator. Once some of those are looked at you can send more.`,
      })
    }
    if (mine.today >= MAX_PER_DAY) {
      return refuse('invalid', {
        form: `You have sent ${mine.today} submissions in the last day, which is the most allowed. Try again tomorrow.`,
      })
    }
  }

  const typed = form.code ? normalizeCode(game, form.code) : null
  if (form.code && !typed) {
    errors.code = `That is not a ${info.name} experience code.`
  }
  const linked = form.link ? parsePortalLink(form.link) : null
  if (form.link && linked?.game !== game) {
    errors.link = `That is not a link to a ${info.name} experience on Portal.`
  }
  // A template can be shared as files alone. Anything else is played by code,
  // which a link may yet supply.
  if (!form.code && !form.link && !form.isTemplate) {
    errors.code = 'Give its experience code. Only a template can go without.'
  }
  const built = info.builtWith.length > 0 ? form.built : []
  if (built.includes('verified') && built.length > 1) {
    errors.built =
      'A verified mode has no script, blocks or custom map. Choose one or the other.'
  }

  const [[category], [sdk], chosenTags, gameMaps] = await Promise.all([
    db
      .select({ id: categories.id })
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
    form.sdk
      ? db
          .select({ id: sdkVersions.id })
          .from(sdkVersions)
          .where(
            and(eq(sdkVersions.game, game), eq(sdkVersions.version, form.sdk)),
          )
          .limit(1)
      : [],
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
  ])
  if (!category) errors.category = 'Choose one of the categories offered.'
  if (form.sdk && !sdk) errors.sdk = 'Choose one of the SDK releases offered.'
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
  if (!code && !form.isTemplate && Object.keys(errors).length === 0) {
    errors.code =
      'Give its experience code as well. Portal did not say what it is.'
  }
  if (Object.keys(errors).length > 0) return refuse('invalid', errors)

  // Each map of the rotation, matched to one the site knows: by level id
  // where gametools gives one, by name where it gives only that.
  const rotation = (found?.rotation ?? []).map((entry) => {
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
  const credits = [...new Set(form.credits)]

  // The address is the title, with a number after it if that is taken. What
  // was read above can be out of date by the time this writes: two people can
  // send the same title at once. The database is what knows, so a taken
  // address is found out by trying, and the next one is tried.
  const used = new Set(taken.map((row) => row.slug))
  for (let attempt = 0; ; attempt += 1) {
    let slug = base
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`
    try {
      await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(experiences)
          .values({
            slug,
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
            vidUrl: form.vidUrl,
            repoUrl: form.repoUrl,
            filesUrl: form.filesUrl,
            maxPlayers: form.maxPlayers,
            maxBots: form.maxBots,
            types: built,
            isTemplate: form.isTemplate,
            gameMode: found?.rotation[0]?.mode,
            mapRotation: found ? rotation.map((entry) => entry.stored) : null,
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
          })
          .returning({ id: experiences.id })

        if (tagged.length > 0) {
          await tx
            .insert(experienceTags)
            .values(tagged.map((tag) => ({ experienceId: created.id, ...tag })))
            .onConflictDoNothing()
        }
        if (form.images.length > 0) {
          await tx.insert(experienceImages).values(
            form.images.map((url, position) => ({
              experienceId: created.id,
              position,
              url,
            })),
          )
        }
        if (credits.length > 0) {
          await tx.insert(experienceCreators).values(
            credits.map((name, position) => ({
              experienceId: created.id,
              name,
              position,
            })),
          )
        }
        // It went through, so a kept copy of a refused form has done its job.
        await tx
          .delete(submissionDrafts)
          .where(eq(submissionDrafts.userId, actor.id))
      })
      return { ok: true, slug }
    } catch (error) {
      if (!slugWasTaken(error) || attempt >= 10) throw error
      used.add(slug)
    }
  }
}

/** The most of a refused form that is kept, as JSON. */
const DRAFT_LIMIT = 40_000

const draftSchema = z.object({
  fields: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  errors: z.record(z.string(), z.string()),
})

export type Draft = z.infer<typeof draftSchema>

/**
 * Keeps a form that was refused, with what was wrong, so the page can show it
 * again filled in. For a form posted with no script, where the page is gone
 * by the time the refusal is known.
 */
export async function keepDraft(
  actor: Actor,
  given: Record<string, unknown>,
  errors: Record<string, string>,
) {
  // Only the form's own fields, and only text: a posted form can carry any
  // name and any file.
  const fields: Draft['fields'] = {}
  for (const name of Object.keys(experienceFormSchema.shape)) {
    const value = given[name]
    if (typeof value === 'string') fields[name] = value
    else if (Array.isArray(value)) {
      fields[name] = value.filter((item) => typeof item === 'string')
    }
  }
  // Too much to keep whole, so the longest field goes first. Something that
  // long was refused for its length, and the rest is still worth keeping.
  const size = (name: string) => JSON.stringify(fields[name]).length
  while (JSON.stringify(fields).length > DRAFT_LIMIT) {
    const [longest] = Object.keys(fields).sort((a, b) => size(b) - size(a))
    delete fields[longest]
  }
  await db
    .insert(submissionDrafts)
    .values({ userId: actor.id, fields, errors, savedAt: new Date() })
    .onConflictDoUpdate({
      target: submissionDrafts.userId,
      set: { fields, errors, savedAt: new Date() },
    })
}

/** The refused form kept for whoever is acting, if there is one. */
export async function readDraft(actor: Actor) {
  const [row] = await db
    .select({
      fields: submissionDrafts.fields,
      errors: submissionDrafts.errors,
    })
    .from(submissionDrafts)
    .where(eq(submissionDrafts.userId, actor.id))
    .limit(1)
  const draft = draftSchema.safeParse(row)
  return draft.success ? draft.data : null
}

/**
 * What the submit form offers for a game: its categories, the tags a creator
 * may choose, and its SDK releases, newest first.
 */
export async function getSubmitOptions(game: Game) {
  const [categoryRows, tagRows, sdkRows] = await Promise.all([
    db
      .select({ name: categories.name, slug: categories.slug })
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
      .orderBy(desc(sdkVersions.sortOrder)),
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
    sdkVersions: sdkRows,
  }
}
