import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { keepDraft, readDraft } from '../server/services/drafts'
import {
  getSnippetOptions,
  SNIPPET_FIELDS,
  submitSnippet,
} from '../server/services/snippet-submissions'
import { formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
import { MAX_SNIPPET_FILE_BYTES } from '../shared/snippet-form'
import { redirectTo } from './answer'

/**
 * What the snippet form shows: the categories it offers and the SDK release a
 * submission is listed for. `login` for a visitor who is not signed in. With
 * `draft`, the snippet form this visitor last had refused comes back as well.
 */
export const fetchSnippetSubmitPage = createServerFn({ method: 'GET' })
  .validator(z.object({ draft: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const actor = await currentActor()
    if (!actor) return { state: 'login' as const }
    const [options, draft] = await Promise.all([
      getSnippetOptions(),
      data.draft ? readDraft(actor, 'snippet') : null,
    ])
    return { state: 'ok' as const, options, draft }
  })

/**
 * The form as sent, with the snippet read from a file chosen on it. The page's
 * script reads a file into the box and sends no file, so a file arrives only
 * from a form posted with no script. It was chosen after whatever is in the
 * box, so it is the snippet.
 */
async function withFile(input: Record<string, unknown>) {
  const { file, ...fields } = input
  if (!(file instanceof File) || file.size === 0) return { fields }
  if (file.size > MAX_SNIPPET_FILE_BYTES) {
    return { fields, tooLarge: true }
  }
  return { fields: { ...fields, script: await file.text() } }
}

/** Submits a snippet for review. */
export const submitSnippetForReview = createServerFn({ method: 'POST' })
  .validator(formOr(z.record(z.string(), z.unknown())))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const actor = await currentActor()
    const sent = data.input ? await withFile(data.input) : null
    const result = !sent
      ? refuse('invalid', data.errors)
      : sent.tooLarge
        ? refuse('invalid', { script: 'That file is larger than a snippet.' })
        : await submitSnippet(actor, sent.fields)
    if (!data.viaForm) return result
    if (result.ok) throw redirectTo(`/scripts/${result.slug}`)
    if (!actor || result.reason === 'signed-out') throw redirectTo('/login')
    // With no script the page that was filled in is gone by now. What was
    // sent is kept, and the form is shown again with it and what was wrong.
    await keepDraft(
      actor,
      'snippet',
      sent?.fields ?? {},
      result.errors ?? { form: 'That could not be submitted.' },
      SNIPPET_FIELDS,
    )
    throw redirectTo('/submit/snippet?draft=true')
  })

export type SnippetSubmitPageData = Extract<
  Awaited<ReturnType<typeof fetchSnippetSubmitPage>>,
  { state: 'ok' }
>
