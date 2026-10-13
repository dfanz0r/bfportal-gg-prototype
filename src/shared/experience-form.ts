import { z } from 'zod'

import { experienceTypes, games } from './content'
import { formBoolean } from './form-input'

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

export const MAX_IMAGES = 8
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
  maxPlayers: count(256).refine((value) => value > 0, 'Say how many can play.'),
  maxBots: count(256).default(0),
  coverImgUrl: optional(httpsUrl('The cover must be an https:// address.')),
  images: lines(
    MAX_IMAGES,
    httpsUrl('Each picture must be an https:// address.'),
  ).default([]),
  vidUrl: optional(httpsUrl('The video must be an https:// address.')),
  repoUrl: optional(
    onHosts(REPO_HOSTS, `The repository must be on ${REPO_HOSTS.join(', ')}.`),
  ),
  filesUrl: optional(
    onHosts(FILE_HOSTS, `Files must be on ${FILE_HOSTS.join(', ')}.`),
  ),
  /** An SDK release the game has, checked by the service. */
  sdk: optional(z.string().max(20)),
  /** People to credit by name, who have no account here. */
  credits: lines(MAX_CREDITS, z.string().max(60)).default([]),
})

export type ExperienceForm = z.infer<typeof experienceFormSchema>

/** What is wrong with a form, by field, in words to show beside it. */
export function formErrors(error: z.ZodError) {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form')
    errors[field] ??= issue.message
  }
  return errors
}
