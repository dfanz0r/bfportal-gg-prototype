import { z } from 'zod'

import { experienceTypes, games } from './content'
import { formBoolean } from './form-input'
import { type MediaProblem, mediaOf } from './media'
import { MAX_TEAMS } from './teams'

export { fieldErrors as formErrors } from './form-input'

// What someone submits when they share an experience. The form, the server
// function and the service all read this one schema. It checks shape and
// size; what depends on the database or on Portal (is this a real category,
// does the code exist) is checked by the service.

/** Empty and missing mean the same thing in a form. */
const blank = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blank, schema.optional())

/** One value, a list, or lines of a textarea, as a list of trimmed lines. */
const lines = <T extends z.ZodType<string>>(max: number, each: T) =>
  z.preprocess(
    (value) =>
      (Array.isArray(value) ? value : [value])
        .flatMap((item) => String(item ?? '').split('\n'))
        .map((item) => item.trim())
        .filter(Boolean),
    z.array(each).max(max),
  )

const httpsUrl = (message: string) =>
  z
    .string()
    .max(500)
    .refine((value) => {
      try {
        return new URL(value).protocol === 'https:'
      } catch {
        return false
      }
    }, message)

/** An HTTPS address on one of a few hosts, or a host under one of them. */
const onHosts = (hosts: string[], message: string) =>
  httpsUrl(message).refine((value) => {
    const { hostname } = new URL(value)
    return hosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    )
  }, message)

const count = (max: number) => z.coerce.number().int().min(0).max(max)

/** One number per team, in team order. A form sends one team as one value. */
const perTeam = z.preprocess(
  (value) => (value === undefined ? [] : [value].flat()),
  z.array(count(256)).max(MAX_TEAMS),
)

const mediaProblems: Record<MediaProblem, string> = {
  'not-https': 'Each link must be an https:// address.',
  'not-a-video': 'A YouTube link must be to one video.',
  'video-site': 'Videos must be on YouTube.',
}

const mediaLink = z
  .string()
  .max(500)
  .superRefine((value, context) => {
    const media = mediaOf(value)
    if (media.kind === 'none') {
      context.addIssue({
        code: 'custom',
        message: mediaProblems[media.problem],
      })
    }
  })

export const MAX_MEDIA = 8
export const MAX_CREDITS = 10
export const REPO_HOSTS = ['github.com', 'gitlab.com', 'codeberg.org']
export const FILE_HOSTS = [
  'github.com',
  'dropbox.com',
  'drive.google.com',
  'docs.google.com',
]

export const experienceFormSchema = z.object({
  game: z.enum(games),
  /** A share code, checked against the game's format by the service. */
  code: optional(z.string().max(20)),
  /** Either of the experience's Portal pages, instead of or beside the code. */
  link: optional(z.string().max(500)),
  category: z.string().min(1, 'Choose a category.').max(80),
  title: z
    .string()
    .trim()
    .min(3, 'Give it a title of at least three characters.')
    .max(80, 'Keep the title to 80 characters.'),
  description: z
    .string()
    .max(10000, 'Keep the description to 10,000 characters.')
    .default(''),
  tags: lines(30, z.string().max(80)).default([]),
  built: lines(4, z.enum(experienceTypes)).default([]),
  isTemplate: formBoolean.default(false),
  copyAllowed: formBoolean.default(false),
  /** How many people may play on each team. The service pairs these up. */
  teamPlayers: perTeam,
  /** How many bots play on each team, in the same order. */
  teamBots: perTeam,
  coverImgUrl: optional(httpsUrl('The cover must be an https:// address.')),
  /** Links to pictures and YouTube videos, shown after the cover. */
  media: lines(MAX_MEDIA, mediaLink).default([]),
  repoUrl: optional(
    onHosts(REPO_HOSTS, `The repository must be on ${REPO_HOSTS.join(', ')}.`),
  ),
  filesUrl: optional(
    onHosts(FILE_HOSTS, `Files must be on ${FILE_HOSTS.join(', ')}.`),
  ),
  /** People to credit by name, who have no account here. */
  credits: lines(MAX_CREDITS, z.string().max(60)).default([]),
  /**
   * People to credit who have an account here, by the Discord id their
   * profile is at. Each is asked, and shown once they accept.
   */
  creditAccounts: lines(
    MAX_CREDITS,
    z.string().regex(/^\d{1,25}$/, 'Choose each account from the list.'),
  ).default([]),
})

export type ExperienceForm = z.infer<typeof experienceFormSchema>
