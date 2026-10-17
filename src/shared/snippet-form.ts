import { z } from 'zod'

// What someone submits when they share a snippet: a small, reusable piece of
// script to copy into your own, pasted in or uploaded as one file. The form,
// the server function and the service all read this one schema.

/**
 * The most lines a snippet may have. It is what keeps a whole experience's
 * script out: that is submitted as an experience, where it can be offered as
 * a template. A placeholder until the number is decided.
 */
export const MAX_SNIPPET_LINES = 400

/**
 * The most characters a snippet may have: its lines at a generous 150 each.
 * The box, a file read into it and a refused form kept to show again are all
 * sized from this.
 */
export const MAX_SNIPPET_CHARS = MAX_SNIPPET_LINES * 150

/**
 * The largest file read as a snippet, in bytes. A character takes up to four,
 * so no file that could be a snippet is larger.
 */
export const MAX_SNIPPET_FILE_BYTES = MAX_SNIPPET_CHARS * 4

/** How many lines a script has. A file's last line break is not a line. */
export const lineCount = (script: string) =>
  script === '' ? 0 : script.replace(/\n$/, '').split('\n').length

export const snippetFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Give it a title of at least three characters.')
    .max(80, 'Keep the title to 80 characters.'),
  description: z
    .string()
    .max(10000, 'Keep the description to 10,000 characters.')
    .default(''),
  script: z
    // A file saved on Windows ends its lines differently; a line is a line.
    .preprocess(
      (value) =>
        typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : value,
      z.string(),
    )
    .refine(
      (value) => value.trim().length > 0,
      'Paste the snippet, or upload its file.',
    )
    .refine(
      (value) => lineCount(value) <= MAX_SNIPPET_LINES,
      `Keep it to ${MAX_SNIPPET_LINES} lines. To share a whole experience, submit it as an experience instead.`,
    )
    .refine(
      (value) => value.length <= MAX_SNIPPET_CHARS,
      `Keep it to ${MAX_SNIPPET_CHARS.toLocaleString('en-US')} characters.`,
    ),
  category: z.string().min(1, 'Choose a category.').max(80),
})

export type SnippetForm = z.infer<typeof snippetFormSchema>
