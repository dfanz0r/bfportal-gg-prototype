import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm'

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

// Scripts: Battlefield 6 snippets that others copy into their own
// experiences.

/** What anyone may see: published, and not deleted by its owner. */
export const snippetVisible = and(
  eq(snippets.status, 'published'),
  isNull(snippets.deletedAt),
)

const likeCount = sql<number>`(select count(*)::int from ${snippetLikes} where ${snippetLikes.snippetId} = ${snippets.id})`

export const snippetSorts = ['likes', 'newest'] as const
export type SnippetSort = (typeof snippetSorts)[number]

export async function listSnippets(options: {
  category?: string
  sort?: SnippetSort
  /** Only one person's scripts, for their profile. */
  ownerId?: string
  limit: number
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
    items: rows.map((script) => ({
      slug: script.slug,
      title: script.title,
      excerpt: excerpt(script.descriptionMd),
      category: script.category,
      featured: script.featured,
      updatedAt: script.updatedAt,
      owner: publicPerson(script.owner),
      likes: script.likes,
    })),
  }
}

export type SnippetItem = Awaited<
  ReturnType<typeof listSnippets>
>['items'][number]

/** A script's own page, or null unless it is published and not deleted. */
export async function getSnippet(slug: string, now = new Date()) {
  const [row] = await db
    .select({
      id: snippets.id,
      slug: snippets.slug,
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
    })
    .from(snippets)
    .innerJoin(user, eq(user.id, snippets.ownerId))
    .leftJoin(categories, eq(categories.id, snippets.categoryId))
    .leftJoin(sdkVersions, eq(sdkVersions.id, snippets.sdkVersionId))
    .where(and(eq(snippets.slug, slug), snippetVisible))
    .limit(1)
  if (!row) return null

  const posts = await db
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
    .orderBy(desc(updates.publishedAt))

  return {
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
    now,
  }
}
