import { and, asc, desc, eq, gt, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'

import { gameInfo } from '../../shared/games'
import { shownMedia } from '../../shared/media'
import { isStaff as isStaffRole } from '../../shared/roles'
import { teamSetupSchema } from '../../shared/teams'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experienceCreators,
  experienceLikes,
  experienceMedia,
  experienceReports,
  experiences,
  experienceTags,
  maps,
  playtests,
  projectFiles,
  sdkVersions,
  tagGroups,
  tags,
  updates,
  user,
} from '../db/schema'
import {
  available,
  isUnavailable,
  likes,
  listCards,
  visible,
} from './experience-cards'
import { EDITABLE, isLive } from './experience-drafts'
import { lastSentEdit } from './experience-edits'
import { excerpt, personColumns, publicPerson } from './shared'
import { templateRequestOf } from './template-offers'

// Everything an experience's own page shows. Nothing here is private: what
// this returns is written into the page.

const rotationSchema = z.array(
  z.object({
    map: z.string(),
    mode: z.string(),
    rounds: z.number(),
    teams: z.array(z.number()),
  }),
)

/** Someone credited on an experience. Only an account has a profile. */
type Credit = { name: string; image: string | null; discordId: string | null }

/**
 * An experience's page, or null if whoever is looking may not see it. The
 * public sees what is published. Its owner and the moderators also see it in
 * any other status: a draft, in review, with changes requested, taken off the
 * listings or removed. Nobody sees one its owner deleted.
 */
export async function getExperience(
  slug: string,
  now = new Date(),
  viewer: Actor | null = null,
) {
  const [found] = await db
    .select({
      experience: experiences,
      likes,
      category: { name: categories.name, slug: categories.slug },
      owner: { id: user.id, ...personColumns },
      sdk: {
        version: sdkVersions.version,
        season: sdkVersions.season,
        sortOrder: sdkVersions.sortOrder,
      },
    })
    .from(experiences)
    .innerJoin(user, eq(user.id, experiences.ownerId))
    .innerJoin(categories, eq(categories.id, experiences.categoryId))
    .leftJoin(sdkVersions, eq(sdkVersions.id, experiences.sdkVersionId))
    .where(and(eq(experiences.slug, slug), isNull(experiences.deletedAt)))
    .limit(1)
  if (!found) return null
  const { experience } = found
  const isOwner = viewer?.id === found.owner.id
  const isStaff = viewer !== null && isStaffRole(viewer.role)
  if (experience.status !== 'published' && !isOwner && !isStaff) return null
  // A draft has not been sent to anyone, moderators included.
  if (experience.status === 'draft' && !isOwner) return null
  // Files are shared when the experience is offered as a template: its
  // uploads and the link to the rest alike. Its owner and the moderators see
  // them either way.
  const filesShown = experience.isTemplate || isOwner || isStaff
  const read = rotationSchema.safeParse(experience.mapRotation ?? [])
  if (!read.success) {
    // The page still shows; a rotation that will not read is left off it.
    console.error(
      `Experience ${experience.id} has a map rotation that does not parse.`,
    )
  }
  const rotation = read.success ? read.data : []

  const [
    media,
    creators,
    tagRows,
    mapRows,
    updateRows,
    [playtest],
    files,
    [latestSdk],
    more,
    [ownLike],
    ownReports,
    templateRequest,
    sentEdit,
  ] = await Promise.all([
    db
      .select({ url: experienceMedia.url })
      .from(experienceMedia)
      .where(eq(experienceMedia.experienceId, experience.id))
      .orderBy(asc(experienceMedia.position)),
    // Credits: names, and accounts that have accepted being listed.
    db
      .select({
        creditName: experienceCreators.name,
        account: personColumns,
        acceptedAt: experienceCreators.acceptedAt,
      })
      .from(experienceCreators)
      .leftJoin(user, eq(user.id, experienceCreators.userId))
      .where(eq(experienceCreators.experienceId, experience.id))
      .orderBy(asc(experienceCreators.position)),
    db
      .select({ name: tags.name, slug: tags.slug, group: tagGroups.name })
      .from(experienceTags)
      .innerJoin(tags, eq(tags.id, experienceTags.tagId))
      .innerJoin(tagGroups, eq(tagGroups.id, tags.groupId))
      .where(
        and(
          eq(experienceTags.experienceId, experience.id),
          eq(tags.visible, true),
        ),
      )
      .orderBy(asc(tagGroups.sortOrder), asc(tags.sortOrder), asc(tags.name)),
    db
      .select({
        levelId: maps.levelId,
        name: maps.name,
        imageUrl: maps.imageUrl,
      })
      .from(maps)
      .where(eq(maps.game, experience.game)),
    db
      .select({
        id: updates.id,
        title: updates.title,
        bodyHtml: updates.bodyHtml,
        publishedAt: updates.publishedAt,
        author: personColumns,
      })
      .from(updates)
      .innerJoin(user, eq(user.id, updates.authorId))
      .where(
        and(
          eq(updates.experienceId, experience.id),
          eq(updates.status, 'published'),
          isNull(updates.deletedAt),
        ),
      )
      .orderBy(desc(updates.publishedAt)),
    // The playtest that is open now, if there is one.
    db
      .select({
        id: playtests.id,
        summary: playtests.summary,
        regions: playtests.regions,
        closesAt: playtests.closesAt,
      })
      .from(playtests)
      .where(
        and(
          eq(playtests.experienceId, experience.id),
          eq(playtests.status, 'approved'),
          lte(playtests.opensAt, now),
          or(isNull(playtests.closesAt), gt(playtests.closesAt, now)),
        ),
      )
      .orderBy(desc(playtests.opensAt))
      .limit(1),
    filesShown
      ? db
          .select({
            // The one its addresses use.
            id: projectFiles.publicId,
            kind: projectFiles.kind,
            filename: projectFiles.filename,
            sizeBytes: projectFiles.sizeBytes,
          })
          .from(projectFiles)
          .where(eq(projectFiles.experienceId, experience.id))
          .orderBy(asc(projectFiles.id))
      : [],
    db
      .select({
        version: sdkVersions.version,
        sortOrder: sdkVersions.sortOrder,
      })
      .from(sdkVersions)
      .where(eq(sdkVersions.game, experience.game))
      .orderBy(desc(sdkVersions.sortOrder))
      .limit(1),
    listCards({
      where: and(
        eq(experiences.ownerId, found.owner.id),
        ne(experiences.id, experience.id),
        visible,
        available,
      ),
      orderBy: [desc(likes), desc(experiences.id)],
      limit: 3,
      viewer: viewer?.id ?? null,
    }),
    viewer
      ? db
          .select({ one: experienceLikes.userId })
          .from(experienceLikes)
          .where(
            and(
              eq(experienceLikes.experienceId, experience.id),
              eq(experienceLikes.userId, viewer.id),
            ),
          )
          .limit(1)
      : [],
    viewer
      ? db
          .select({ type: experienceReports.type })
          .from(experienceReports)
          .where(
            and(
              eq(experienceReports.experienceId, experience.id),
              eq(experienceReports.userId, viewer.id),
              // One a moderator dealt with can be made again.
              isNull(experienceReports.resolvedAt),
            ),
          )
      : [],
    // Its owner's request to offer it as a template, which only they see.
    isOwner ? templateRequestOf(experience.id) : null,
    // And their edit to it, which only they see here.
    isOwner && isLive(experience.status) ? lastSentEdit(experience.id) : null,
  ])

  const mapOf = new Map(mapRows.map((map) => [map.levelId, map]))

  return {
    slug: experience.slug,
    game: experience.game,
    title: experience.title,
    summary: excerpt(experience.descriptionMd),
    descriptionHtml: experience.descriptionHtml,
    category: found.category,
    code: experience.code,
    playgroundId: experience.playgroundId,
    copyAllowed: experience.copyAllowed === true,
    // The cover first, then the rest in its order, each worked out into a
    // picture or a video to embed.
    gallery: [
      ...(experience.coverImgUrl
        ? [{ kind: 'image' as const, url: experience.coverImgUrl }]
        : []),
      ...shownMedia(media.map((item) => item.url)),
    ],
    repoUrl: experience.repoUrl,
    filesUrl: filesShown ? experience.filesUrl : null,
    maxPlayers: experience.maxPlayers,
    maxBots: experience.maxBots,
    // As its creator set them out, or else the sizes Portal gives for the
    // first map, which say nothing about bots.
    teams:
      teamSetupSchema.safeParse(experience.teamSetup).data ??
      (rotation[0]?.teams ?? []).map((players) => ({ players, bots: 0 })),
    types: experience.types,
    isTemplate: experience.isTemplate,
    gameMode: experience.gameMode,
    xpMode: experience.xpMode,
    requiresFullGame: experience.requiresFullGame,
    featured: experience.featured,
    bugged: experience.bugged,
    xpFarm: experience.xpFarm,
    unavailable: isUnavailable(experience),
    portalState: experience.portalState,
    portalCheckedAt: experience.portalCheckedAt,
    portalStateSince: experience.portalStateSince,
    publishedAt: experience.firstPublishedAt,
    updatedAt: experience.lastPublishedAt,
    likes: found.likes,
    status: experience.status,
    // What a moderator wrote when asking for changes or removing it, for its
    // owner. Who wrote it is not passed on.
    reviewNote: isOwner || isStaff ? experience.reviewNote : null,
    viewer: {
      signedIn: viewer !== null,
      liked: ownLike !== undefined,
      reported: ownReports.map((report) => report.type),
      isOwner,
      isStaff,
      // Where its owner may offer its files, and how their request stands.
      templateRequest,
      canOfferTemplate: isOwner && gameInfo(experience.game).hasExport,
      // Whether its owner opens it in the form, and whether changes they sent
      // to it while live are waiting.
      canEdit:
        isOwner && EDITABLE.some((status) => status === experience.status),
      editWaiting: sentEdit?.waiting === true,
    },
    owner: publicPerson(found.owner),
    // An invitation not yet accepted shows nowhere.
    // A name with no account is a credit with nothing to link to. An account
    // is shown once it has accepted.
    creators: creators.flatMap((creator): Credit[] => {
      if (creator.creditName) {
        return [{ name: creator.creditName, image: null, discordId: null }]
      }
      const account = creator.acceptedAt ? publicPerson(creator.account) : null
      return account ? [account] : []
    }),
    tags: tagRows,
    rotation: rotation.map((entry) => {
      const map = mapOf.get(entry.map)
      return {
        // A map can be in a rotation before the site knows its name.
        name: map?.name ?? entry.map,
        imageUrl: map?.imageUrl ?? null,
        mode: entry.mode,
        teams: entry.teams,
        players: entry.teams.reduce((sum, team) => sum + team, 0),
      }
    }),
    sdk: found.sdk?.version
      ? {
          version: found.sdk.version,
          season: found.sdk.season ?? '',
          releasesBehind: latestSdk
            ? latestSdk.sortOrder - (found.sdk.sortOrder ?? 0)
            : 0,
          latest: latestSdk?.version ?? found.sdk.version,
        }
      : null,
    updates: updateRows.map((update) => ({
      id: update.id,
      title: update.title,
      bodyHtml: update.bodyHtml,
      publishedAt: update.publishedAt,
      author: publicPerson(update.author),
    })),
    playtest: playtest ?? null,
    files,
    more,
    // When this was read, so the page can say "5 hours ago" the same way on
    // the server and in the browser.
    now,
  }
}

export type ExperienceData = NonNullable<
  Awaited<ReturnType<typeof getExperience>>
>

/**
 * One shared file, for download. Null unless it belongs to a published
 * experience that is offered as a template, or the viewer is its owner or a
 * moderator, who see a submission's files before it is published.
 */
export async function getProjectFile(publicId: string, viewer: Actor | null) {
  const [file] = await db
    .select({
      filename: projectFiles.filename,
      body: projectFiles.body,
    })
    .from(projectFiles)
    .innerJoin(experiences, eq(experiences.id, projectFiles.experienceId))
    .where(and(eq(projectFiles.publicId, publicId), fileReadableBy(viewer)))
    .limit(1)
  return file ?? null
}

/**
 * Who may read a project's files, to download or to view: anyone, for a
 * published template; its owner and the moderators, always.
 */
export const fileReadableBy = (viewer: Actor | null) =>
  and(
    isNull(experiences.deletedAt),
    or(
      and(eq(experiences.isTemplate, true), visible),
      viewer && isStaffRole(viewer.role) ? sql`true` : undefined,
      viewer ? eq(experiences.ownerId, viewer.id) : undefined,
    ),
  )
