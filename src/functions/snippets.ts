import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import {
  deleteOwnSnippet,
  removeSnippet,
} from '../server/services/snippet-removal'
import { getSnippet, listSnippets } from '../server/services/snippets'
import { MAX_NOTE } from '../shared/decision'
import { FEED_PAGE_SIZE, snippetsSearchSchema } from '../shared/feed-search'
import { formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
import { formAnswer } from './answer'

/** The snippets list, by category. */
export const fetchSnippets = createServerFn({ method: 'GET' })
  .validator(snippetsSearchSchema)
  .handler(async ({ data }) => ({
    ...(await listSnippets({
      category: data.category,
      sort: data.sort,
      // "Show more" grows the page: page two holds the first two pages.
      limit: (data.page ?? 1) * FEED_PAGE_SIZE,
      viewer: (await currentActor())?.id ?? null,
    })),
    page: data.page ?? 1,
  }))

/**
 * A snippet's page, or null if there is none whoever is asking may see. Its
 * owner and the moderators see one that is not published yet.
 */
export const fetchSnippet = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) =>
    getSnippet(data.slug, new Date(), await currentActor()),
  )

/** Deletes one of the visitor's own snippets. */
export const deleteSnippet = createServerFn({ method: 'POST' })
  .validator(formOr(z.object({ slug: z.string().min(1).max(200) })))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await deleteOwnSnippet(await currentActor(), data.input.slug)
      : refuse('invalid', data.errors)
    // Its page is gone; their list is where to go.
    if (data.viaForm)
      throw formAnswer(result, result.ok ? '/submissions' : data.back)
    return result
  })

/** Removes a snippet for good, with a note to its owner. Moderators only. */
export const removeSnippetForGood = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        slug: z.string().min(1).max(200),
        note: z.string().max(MAX_NOTE).default(''),
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await removeSnippet(
          await currentActor(),
          data.input.slug,
          data.input.note,
        )
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

export type Snippets = Awaited<ReturnType<typeof fetchSnippets>>
export type SnippetItem = Snippets['items'][number]
export type Snippet = NonNullable<Awaited<ReturnType<typeof fetchSnippet>>>
