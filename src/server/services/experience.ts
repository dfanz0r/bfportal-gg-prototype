import { and, asc, desc, eq, gt, isNull, lte, ne, or } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db'
import {
  categories,
  experienceCreators,
  experienceImages,
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
import { excerpt, personColumns, publicPerson } from './shared'

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

/** Null unless the experience is published and not deleted. */
export async function getExperience(slug: string, now = new Date()) {
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
    .where(and(eq(experiences.slug, slug), visible))
    .limit(1)
  if (!found) return null
  const { experience } = found
  const read = rotationSchema.safeParse(experience.mapRotation ?? [])
  if (!read.success) {
    // The page still shows; a rotation that will not read is left off it.
    console.error(
      `Experience ${experience.id} has a map rotation that does not parse.`,
    )
  }
  const rotation = read.success ? read.data : []

  const [
    images,
    creators,
    tagRows,
    mapRows,
    updateRows,
    [playtest],
    files,
    [latestSdk],
    more,
  ] = await Promise.all([
    db
      .select({ url: experienceImages.url })
      .from(experienceImages)
      .where(eq(experienceImages.experienceId, experience.id))
      .orderBy(asc(experienceImages.position)),
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
    // Files are shared when the experience is offered as a template.
    experience.isTemplate
      ? db
          .select({
            id: projectFiles.id,
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
    }),
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
    // The cover first, then the gallery in its order.
    images: [
      ...(experience.coverImgUrl ? [experience.coverImgUrl] : []),
      ...images.map((image) => image.url),
    ],
    vidUrl: experience.vidUrl,
    repoUrl: experience.repoUrl,
    filesUrl: experience.filesUrl,
    maxPlayers: experience.maxPlayers,
    maxBots: experience.maxBots,
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
 * experience that is offered as a template.
 */
export async function getProjectFile(id: number) {
  const [file] = await db
    .select({
      filename: projectFiles.filename,
      body: projectFiles.body,
    })
    .from(projectFiles)
    .innerJoin(experiences, eq(experiences.id, projectFiles.experienceId))
    .where(
      and(eq(projectFiles.id, id), eq(experiences.isTemplate, true), visible),
    )
    .limit(1)
  return file ?? null
}
