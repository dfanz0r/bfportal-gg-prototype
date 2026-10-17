import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { currentActor } from '../server/auth/actor'
import { getFileView } from '../server/services/file-view'

/** One project file to read on a page, or null if the visitor may not. */
export const fetchFileView = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => getFileView(data.id, await currentActor()))

export type FileView = NonNullable<Awaited<ReturnType<typeof fetchFileView>>>
