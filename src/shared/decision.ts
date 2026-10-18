import { z } from 'zod'

// A moderator's decision on a waiting submission, made on the page that shows
// it. The rule, the form and the pages it is made on all read this.

/** What is said when changes are requested with no note. */
export const NOTE_NEEDED =
  'Requesting changes needs a note, so its creator knows what to change.'

/** What is said when something is removed with no note. */
export const REMOVE_NOTE_NEEDED =
  'Removing needs a note, so its creator knows why.'

/**
 * What is said when its owner sent it again after the moderator opened it:
 * the decision was about a version that is no longer the one waiting.
 */
export const CHANGED_SINCE_OPENED =
  'It changed while you were reviewing. Reload to see what changed.'

/** The longest note a moderator may write. */
export const MAX_NOTE = 1000

/** What was wrong with a decision posted with no script. */
export const decisionProblems = ['note', 'changed'] as const
export type DecisionProblem = (typeof decisionProblems)[number]

/**
 * What a page a decision is made on takes in its address. A decision posted
 * with no script and refused comes back to that page with what was wrong and
 * the note as it was written.
 */
export const decisionSearchSchema = z.object({
  problem: z.enum(decisionProblems).optional().catch(undefined),
  note: z.string().max(MAX_NOTE).optional().catch(undefined),
})

export type DecisionSearch = z.infer<typeof decisionSearchSchema>
