import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { Actor } from '../auth/actor'
import { db } from '../db'
import { submissionDrafts } from '../db/schema'
import type { Executor } from './shared'

// A refused form, kept so the page can show it again filled in, with what was
// wrong. For a form posted with no script, where the page is gone by the time
// the refusal is known. One is kept per person, whichever form it was.

/** Which form a kept one is, so each page reads back only its own. */
export type DraftKind = 'experience' | 'snippet'

/**
 * The most text a kept form holds, in characters. More than any form that
 * passes its own checks can hold: the largest is a snippet, with 60,000
 * characters of script and 10,000 of description. So a form refused for one
 * field keeps every other, and only something refused for its length can be
 * too long to keep.
 */
export const DRAFT_LIMIT = 100_000

const draftSchema = z.object({
  fields: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  errors: z.record(z.string(), z.string()),
})

export type Draft = z.infer<typeof draftSchema>

/**
 * Keeps a refused form for whoever sent it. `names` are the form's own
 * fields: a posted form can carry any name and any file, and only those, as
 * text, are kept.
 */
export async function keepDraft(
  actor: Actor,
  kind: DraftKind,
  given: Record<string, unknown>,
  errors: Record<string, string>,
  names: readonly string[],
) {
  const fields: Draft['fields'] = {}
  for (const name of names) {
    const value = given[name]
    if (typeof value === 'string') fields[name] = value
    else if (Array.isArray(value)) {
      fields[name] = value.filter((item) => typeof item === 'string')
    }
  }
  // Too much to keep whole. What was refused goes first, longest first, so
  // what passed is kept.
  const size = (name: string) => [fields[name]].flat().join('').length
  let total = Object.keys(fields).reduce((sum, name) => sum + size(name), 0)
  const order = Object.keys(fields).sort(
    (a, b) => Number(b in errors) - Number(a in errors) || size(b) - size(a),
  )
  for (const name of order) {
    if (total <= DRAFT_LIMIT) break
    total -= size(name)
    delete fields[name]
  }
  const kept = { fields: { ...fields, kind }, errors, savedAt: new Date() }
  await db
    .insert(submissionDrafts)
    .values({ userId: actor.id, ...kept })
    .onConflictDoUpdate({ target: submissionDrafts.userId, set: kept })
}

/** The refused form of this kind kept for whoever is acting, if there is one. */
export async function readDraft(
  actor: Actor,
  kind: DraftKind,
): Promise<Draft | null> {
  const [row] = await db
    .select({
      fields: submissionDrafts.fields,
      errors: submissionDrafts.errors,
    })
    .from(submissionDrafts)
    .where(eq(submissionDrafts.userId, actor.id))
    .limit(1)
  const read = draftSchema.safeParse(row)
  if (!read.success) return null
  // Forms kept before they said what they were are experiences.
  const { kind: keptKind = 'experience', ...fields } = read.data.fields
  return keptKind === kind ? { fields, errors: read.data.errors } : null
}

/** Lets go of a kept form once one of its sender's goes through. */
export async function discardDraft(executor: Executor, actor: Actor) {
  await executor
    .delete(submissionDrafts)
    .where(eq(submissionDrafts.userId, actor.id))
}
