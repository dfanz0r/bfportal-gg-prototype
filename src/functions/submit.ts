import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import type { Actor } from '../server/auth/actor'
import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { keepDraft } from '../server/services/drafts'
import {
  deleteExperienceDraft,
  ownEditable,
  saveExperienceDraft,
} from '../server/services/experience-drafts'
import {
  EXPERIENCE_FIELDS,
  submitExperience,
} from '../server/services/experience-submissions'
import { addFilesToForm, type SentFile } from '../server/services/held-files'
import { getDraftEditPage, getSubmitPage } from '../server/services/submit-page'
import { games } from '../shared/content'
import { formOr } from '../shared/form-input'
import { defaultGame } from '../shared/games'
import {
  MAX_ADDED_FILES,
  MAX_EXPORT_BYTES,
  MAX_FILE_BYTES,
} from '../shared/project-files'
import { type Refusal, refuse } from '../shared/results'
import { redirectTo } from './answer'

/** The address of the form: a draft's own, or the one for something new. */
const formPage = (editing: unknown) =>
  typeof editing === 'string' && editing
    ? `/experiences/${encodeURIComponent(editing)}/edit`
    : '/submit'

const pageSearch = {
  code: z.string().max(20).optional(),
  link: z.string().max(500).optional(),
  draft: z.boolean().optional(),
}

/**
 * What the submit page shows: what the form offers for the game, and what
 * Portal says about the code in the address, if there is one. With `draft`,
 * the form this visitor last had refused comes back as well.
 */
export const fetchSubmitPage = createServerFn({ method: 'GET' })
  .validator(z.object({ game: z.enum(games).optional(), ...pageSearch }))
  .handler(async ({ data }) => getSubmitPage(await currentActor(), data))

/** The same form for one of the visitor's drafts, as it was saved. */
export const fetchDraftEditPage = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(200), ...pageSearch }))
  .handler(async ({ data }) => {
    const { slug, ...search } = data
    return getDraftEditPage(await currentActor(), slug, search)
  })

/** A file the page's script read, sent as its name and text. */
const readFileSchema = z.object({
  filename: z.string().max(300),
  text: z.string(),
})

/** The form's file inputs, and which slot each fills. */
const FILE_INPUTS = { exportFile: 'export', addedFiles: 'added' } as const

/** The most of each slot one form sends, and the largest file in each. */
const SLOTS = {
  export: { most: 1, largest: MAX_EXPORT_BYTES },
  added: { most: MAX_ADDED_FILES, largest: MAX_FILE_BYTES },
}

/**
 * The files sent with the submit form: chosen in its file inputs, with no
 * script, or read by the page's script and sent as text. How many there are,
 * and how large each says it is, are checked before any is read; one too
 * large to be taken is not read at all. A form with more files than it can
 * hold is refused.
 */
async function filesSent(
  input: Record<string, unknown>,
): Promise<{ ok: true; sent: SentFile[] } | Refusal> {
  const chosen = Object.entries(FILE_INPUTS).flatMap(([name, slot]) =>
    [input[name] ?? []]
      .flat()
      // A file input left empty still sends a file, with no name.
      .filter((value) => !(value instanceof File && !value.name && !value.size))
      .map((value) => ({ slot, value })),
  )
  for (const [slot, { most }] of Object.entries(SLOTS)) {
    if (chosen.filter((file) => file.slot === slot).length > most) {
      return refuse('invalid', {
        [slot === 'export' ? 'exportFile' : 'addedFiles']:
          slot === 'export'
            ? 'Choose one export.'
            : `Add up to ${MAX_ADDED_FILES} files beside the export.`,
      })
    }
  }
  const sent: SentFile[] = []
  for (const { slot, value } of chosen) {
    if (value instanceof File) {
      sent.push(
        value.size > SLOTS[slot].largest
          ? { slot, filename: value.name, text: '', sizeBytes: value.size }
          : { slot, filename: value.name, text: await value.text() },
      )
    } else {
      const read = readFileSchema.safeParse(value)
      if (read.success) sent.push({ slot, ...read.data })
    }
  }
  return { ok: true, sent }
}

/** The form's fields, without its file inputs. */
const withoutFiles = (input: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(input).filter(([name]) => !(name in FILE_INPUTS)),
  )

/** The draft a form is, if it is one of the actor's, by its id. */
async function draftIdOf(actor: Actor | null, fields: Record<string, unknown>) {
  if (!actor || typeof fields.editing !== 'string' || !fields.editing) {
    return null
  }
  return (await ownEditable(actor, fields.editing))?.id ?? null
}

/**
 * The form as sent, with any file chosen in it with no script held for it,
 * so a refused form still has its files. Nothing is read for a visitor who
 * is not signed in.
 */
async function withFilesHeld(
  actor: Actor | null,
  input: Record<string, unknown>,
) {
  const fields = withoutFiles(input)
  if (!actor) {
    return { fields, refused: refuse('signed-out') as Refusal }
  }
  const files = await filesSent(input)
  if (!files.ok) return { fields, refused: files }
  if (files.sent.length === 0) return { fields, refused: null }
  const added = await addFilesToForm(actor, fields, files.sent, {
    draft: await draftIdOf(actor, fields),
  })
  return added.ok
    ? { fields: added.fields, refused: null }
    : { fields, refused: added }
}

/**
 * With no script the page that was filled in is gone by the time the answer
 * is known. A refused form is kept, and its page shows it again with what was
 * wrong.
 */
async function backToForm(
  actor: Actor | null,
  fields: Record<string, unknown>,
  result: Refusal,
) {
  if (!actor || result.reason === 'signed-out') return redirectTo('/login')
  await keepDraft(
    actor,
    'experience',
    fields,
    result.errors ?? { form: 'That could not be sent.' },
    EXPERIENCE_FIELDS,
  )
  return redirectTo(`${formPage(fields.editing)}?draft=true`)
}

/** Submits an experience for review: a new one, or a draft being edited. */
export const submitForReview = createServerFn({ method: 'POST' })
  .validator(formOr(z.record(z.string(), z.unknown())))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const actor = await currentActor()
    const { fields, refused } = await withFilesHeld(actor, data.input ?? {})
    const result = !data.input
      ? refuse('invalid', data.errors)
      : (refused ?? (await submitExperience(actor, fields)))
    if (!data.viaForm) return result
    if (result.ok) throw redirectTo(`/experiences/${result.slug}`)
    throw await backToForm(actor, fields, result)
  })

/**
 * Saves the form as a draft without sending it to anyone: a new one, or the
 * draft being edited. Only a title and safe links are needed.
 */
export const saveDraft = createServerFn({ method: 'POST' })
  .validator(formOr(z.record(z.string(), z.unknown())))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const actor = await currentActor()
    const { fields, refused } = await withFilesHeld(actor, data.input ?? {})
    const result = !data.input
      ? refuse('invalid', data.errors)
      : (refused ?? (await saveExperienceDraft(actor, fields)))
    if (!data.viaForm) return result
    if (result.ok) throw redirectTo(formPage(result.slug))
    throw await backToForm(actor, fields, result)
  })

/** Deletes one of the visitor's drafts. */
export const deleteDraft = createServerFn({ method: 'POST' })
  .validator(formOr(z.object({ editing: z.string().min(1).max(200) })))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const actor = await currentActor()
    const result = data.input
      ? await deleteExperienceDraft(actor, data.input.editing)
      : refuse('invalid', data.errors)
    if (!data.viaForm) return result
    if (!actor) throw redirectTo('/login')
    throw redirectTo('/submissions')
  })

/**
 * Reads the files chosen on the submit form into it: an export fills in the
 * form, and every file is held for the form until it is sent. The form comes
 * back as a draft, with no script and with one: the page's script goes to it.
 */
export const readProjectFiles = createServerFn({ method: 'POST' })
  .validator(formOr(z.record(z.string(), z.unknown())))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const actor = await currentActor()
    if (!actor) {
      if (data.viaForm) throw redirectTo('/login')
      return refuse('signed-out')
    }
    const input = data.input ?? {}
    const fields = withoutFiles(input)
    const files = await filesSent(input)
    const result = files.ok
      ? await addFilesToForm(actor, fields, files.sent, {
          fill: true,
          draft: await draftIdOf(actor, fields),
        })
      : files
    if (result.ok || data.viaForm) {
      await keepDraft(
        actor,
        'experience',
        result.ok ? result.fields : fields,
        result.ok ? {} : (result.errors ?? { form: 'That file was not read.' }),
        EXPERIENCE_FIELDS,
      )
    }
    if (data.viaForm) throw redirectTo(`${formPage(fields.editing)}?draft=true`)
    return result.ok ? { ok: true as const } : result
  })

/**
 * "Fetch details" on the submit form, posted with no script: the code and
 * link are fields of the form that is submitted, so the button posts that
 * form here, and this goes to the page for the code. The page's script goes
 * there itself.
 */
export const startFromCode = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        game: z.enum(games).catch(defaultGame.id),
        code: z.string().max(20).catch(''),
        link: z.string().max(500).catch(''),
        editing: z.string().max(200).optional().catch(undefined),
      }),
    ),
  )
  .handler(async ({ data }) => {
    const search = new URLSearchParams()
    const { game, code, link, editing } = data.input ?? {}
    // A draft's game is its own; only a new form says which game.
    if (!editing && game && game !== defaultGame.id) search.set('game', game)
    if (code?.trim()) search.set('code', code.trim())
    if (link?.trim()) search.set('link', link.trim())
    const query = search.toString()
    throw redirectTo(
      query ? `${formPage(editing)}?${query}` : formPage(editing),
    )
  })

export type SubmitPageData = Extract<
  Awaited<ReturnType<typeof fetchSubmitPage>>,
  { state: 'ok' }
>
