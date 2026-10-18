import { z } from 'zod'

import { experienceTypes, portalStates, tagSources } from '../../shared/content'
import { teamSetupSchema } from '../../shared/teams'

// What a pending edit to a live experience holds, and the shape of an
// experience form once it has been checked. Only what these schemas read is
// ever applied, so nothing else a stored payload holds can reach a page.

/**
 * The experience form, checked and worked out into what is stored: the row's
 * columns its owner decides, and the rows beside it. Portal's facts about the
 * code are here too, as they were looked up when it was sent. The HTML of the
 * description is not: it is rendered when it is written.
 */
export const preparedExperienceSchema = z.object({
  values: z.object({
    title: z.string(),
    descriptionMd: z.string(),
    categoryId: z.number().int(),
    code: z.string().nullable(),
    // This and the rest of what Portal says are left out where nothing new
    // was learned, and the row keeps what it has.
    playgroundId: z.string().nullable().optional(),
    copyAllowed: z.boolean(),
    coverImgUrl: z.string().nullable(),
    repoUrl: z.string().nullable(),
    // Undefined for a game with no export, which has no files to link.
    filesUrl: z.string().nullable().optional(),
    maxPlayers: z.number().int(),
    maxBots: z.number().int(),
    teamSetup: teamSetupSchema,
    types: z.array(z.enum(experienceTypes)),
    // Chosen on the form, or said by its category.
    isTemplate: z.boolean(),
    gameMode: z.string().nullable().optional(),
    mapRotation: z
      .array(
        z.object({
          map: z.string(),
          mode: z.string(),
          rounds: z.number(),
          teams: z.array(z.number()),
        }),
      )
      .nullable()
      .optional(),
    xpMode: z.string().nullable().optional(),
    requiresFullGame: z.boolean().nullable().optional(),
    sdkVersionId: z.number().int().nullable(),
    portalState: z.enum(portalStates).optional(),
    portalCheckedAt: z.coerce.date().nullable().optional(),
    portalStateSince: z.coerce.date().nullable().optional(),
  }),
  tagged: z.array(
    z.object({ tagId: z.number().int(), source: z.enum(tagSources) }),
  ),
  media: z.array(z.string()),
  /** Accounts credited, by user id, in the order chosen. */
  credited: z.array(z.string()),
  /** Names credited with no account. */
  credits: z.array(z.string()),
  /** Held files to store in place of its files. None keeps the ones it has. */
  files: z.array(z.string()),
  /**
   * Nothing new was learned about what it plays: its tags from Portal and
   * its maps stay as they are, and so do the Portal facts left out above.
   */
  keepPortalFacts: z.boolean().default(false),
})

export type PreparedExperience = z.infer<typeof preparedExperienceSchema>

/**
 * What a pending edit asks to change: the template switch from the page, the
 * edit form as it was last sent, or both.
 */
export const editPayloadSchema = z.object({
  isTemplate: z.boolean().optional(),
  form: preparedExperienceSchema.optional(),
})

export type EditPayload = z.infer<typeof editPayloadSchema>
