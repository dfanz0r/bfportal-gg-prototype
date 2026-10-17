import { z } from 'zod'

// A moderator's decision on a waiting submission, made on the page that shows
// it. The rule, the form and the pages it is made on all read this.

/** What is said when changes are requested with no note. */
export const NOTE_NEEDED =
  'Requesting changes needs a note, so its creator knows what to change.'

/** The longest note a moderator may write. */
export const MAX_NOTE = 1000

/**
 * What a page a decision is made on takes in its address. A decision posted
 * with no script and refused comes back to that page with what was wrong and
 * the note as it was written.
 */
export const decisionSearchSchema = z.object({
  problem: z.literal('note').optional().catch(undefined),
  note: z.string().max(MAX_NOTE).optional().catch(undefined),
})

export type DecisionSearch = z.infer<typeof decisionSearchSchema>
