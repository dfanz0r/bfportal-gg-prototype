import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm'

import { isStaff as isStaffRole } from '../../shared/roles'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  sdkVersions,
  snippetLikes,
  snippets,
  updates,
  user,
} from '../db/schema'
import { excerpt, personColumns, publicPerson } from './shared'
import { lastSentSnippetEdit, SNIPPET_EDITABLE } from './snippet-edits'

// Snippets: small, reusable pieces others copy into their own experiences.
// For now each is TypeScript, kept in `snippets.script`.

/** What anyone may see: published, and not deleted by its owner. */
export const snippetVisible = and(
  eq(snippets.status, 'published'),
  isNull(snippets.deletedAt),
)

const likeCount = sql<number>`(select count(*)::int from ${snippetLikes} where ${snippetLikes.snippetId} = ${snippets.id})`

/** Whether `viewer` likes the snippet in the row, false for nobody. */
const likedBy = (viewer: string | null | undefined) =>
  viewer
    ? sql<boolean>`exists (select 1 from ${snippetLikes} where ${snippetLikes.snippetId} = ${snippets.id} and ${snippetLikes.userId} = ${viewer})`
    : sql<boolean>`false`

export const snippetSorts = ['likes', 'newest'] as const
export type SnippetSort = (typeof snippetSorts)[number]

export async function listSnippets(options: {
  category?: string
  sort?: SnippetSort
  /** Only one person's snippets, for their profile. */
  ownerId?: string
  limit: number
  /** Who is looking, if anyone, for whether they like each one. */
  viewer?: string | null
}) {
  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      count: count(snippets.id),
    })
    .from(categories)
    .leftJoin(
      snippets,
      and(eq(snippets.categoryId, categories.id), snippetVisible),
    )
    .where(
      and(eq(categories.kind, 'script_main'), eq(categories.visible, true)),
    )
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder))
  const category = categoryRows.find((row) => row.slug === options.category)
  const where = and(
    snippetVisible,
    category ? eq(snippets.categoryId, category.id) : undefined,
    options.ownerId ? eq(snippets.ownerId, options.ownerId) : undefined,
  )
  const newest = desc(snippets.firstPublishedAt)

  const [rows, [matching], [all]] = await Promise.all([
    db
      .select({
        slug: snippets.slug,
        title: snippets.title,
        descriptionMd: snippets.descriptionMd,
        category: categories.name,
        featured: snippets.featured,
        updatedAt: snippets.lastPublishedAt,
        owner: personColumns,
        likes: likeCount,
        liked: likedBy(options.viewer),
      })
      .from(snippets)
      .innerJoin(user, eq(user.id, snippets.ownerId))
      .leftJoin(categories, eq(categories.id, snippets.categoryId))
      .where(where)
      .orderBy(
        ...(options.sort === 'newest' ? [newest] : [desc(likeCount), newest]),
        desc(snippets.id),
      )
      .limit(options.limit),
    db.select({ value: count() }).from(snippets).where(where),
    db.select({ value: count() }).from(snippets).where(snippetVisible),
  ])

  return {
    total: matching.value,
    all: all.value,
    category: category?.slug,
    sort: options.sort ?? ('likes' as const),
    categories: categoryRows.map((row) => ({
      name: row.name,
      slug: row.slug,
      count: row.count,
    })),
    items: rows.map((snippet) => ({
      slug: snippet.slug,
      title: snippet.title,
      excerpt: excerpt(snippet.descriptionMd),
      category: snippet.category,
      featured: snippet.featured,
      updatedAt: snippet.updatedAt,
      owner: publicPerson(snippet.owner),
      likes: snippet.likes,
      liked: snippet.liked,
    })),
  }
}

export type SnippetItem = Awaited<
  ReturnType<typeof listSnippets>
>['items'][number]

/**
 * A snippet's own page, or null if whoever is looking may not see it. The
 * public sees what is published. Its owner and the moderators also see it in
 * any other status. Nobody sees one its owner deleted.
 */
export async function getSnippet(
  slug: string,
  now = new Date(),
  viewer: Actor | null = null,
) {
  const [row] = await db
    .select({
      id: snippets.id,
      slug: snippets.slug,
      status: snippets.status,
      version: snippets.version,
      ownerId: snippets.ownerId,
      reviewNote: snippets.reviewNote,
      title: snippets.title,
      descriptionMd: snippets.descriptionMd,
      descriptionHtml: snippets.descriptionHtml,
      script: snippets.script,
      repoUrl: snippets.repoUrl,
      featured: snippets.featured,
      publishedAt: snippets.firstPublishedAt,
      updatedAt: snippets.lastPublishedAt,
      category: categories.name,
      owner: personColumns,
      sdkVersion: sdkVersions.version,
      sdkSeason: sdkVersions.season,
      likes: likeCount,
      liked: likedBy(viewer?.id),
    })
    .from(snippets)
    .innerJoin(user, eq(user.id, snippets.ownerId))
    .leftJoin(categories, eq(categories.id, snippets.categoryId))
    .leftJoin(sdkVersions, eq(sdkVersions.id, snippets.sdkVersionId))
    .where(and(eq(snippets.slug, slug), isNull(snippets.deletedAt)))
    .limit(1)
  if (!row) return null
  const isOwner = viewer?.id === row.ownerId
  const isStaff = viewer !== null && isStaffRole(viewer.role)
  if (row.status !== 'published' && !isOwner && !isStaff) return null

  const [posts, sentEdit] = await Promise.all([
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
          eq(updates.snippetId, row.id),
          eq(updates.status, 'published'),
          isNull(updates.deletedAt),
        ),
      )
      .orderBy(desc(updates.publishedAt)),
    // Its owner's edit to it, which only they see here.
    isOwner && row.status === 'published' ? lastSentSnippetEdit(row.id) : null,
  ])

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: excerpt(row.descriptionMd),
    descriptionHtml: row.descriptionHtml,
    script: row.script,
    lines: row.script ? row.script.trimEnd().split('\n').length : 0,
    repoUrl: row.repoUrl,
    featured: row.featured,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    category: row.category,
    owner: publicPerson(row.owner),
    sdk: row.sdkVersion
      ? { version: row.sdkVersion, season: row.sdkSeason ?? '' }
      : null,
    likes: row.likes,
    updates: posts.map((post) => ({
      id: post.id,
      title: post.title,
      bodyHtml: post.bodyHtml,
      publishedAt: post.publishedAt,
      author: publicPerson(post.author),
    })),
    status: row.status,
    // What a moderator wrote when asking for changes or removing it, for its
    // owner. Who wrote it is not passed on.
    reviewNote: isOwner || isStaff ? row.reviewNote : null,
    // Which version this shows, for a moderator deciding on it here.
    version: row.version,
    viewer: {
      signedIn: viewer !== null,
      liked: row.liked,
      isOwner,
      isStaff,
      // Whether its owner opens it in the form, and whether changes they
      // sent to it while live are waiting.
      canEdit:
        isOwner && SNIPPET_EDITABLE.some((status) => status === row.status),
      editWaiting: sentEdit?.waiting === true,
    },
    now,
  }
}
