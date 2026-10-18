import { z } from 'zod'

import { safeBackPath } from './results'

// A server function that writes can be called two ways: by the page's script,
// with an object, or by a plain HTML form posted straight to its address, with
// form fields. `formOr` lets one function take both, so an action works
// before the page's script has loaded and there is still only one of it.

/** A checkbox or a hidden field: "true" or "false" from a form. */
export const formBoolean = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
])

/**
 * A checkbox on its own: a form sends it only when it is ticked, so nothing
 * at all means no.
 */
export const formCheckbox = z.preprocess(
  (value) => value === true || value === 'true' || value === 'on',
  z.boolean(),
)

/**
 * The validator for a function that a form may post to. `viaForm` says which
 * way it was called; a form's `back` field is where to send the visitor
 * afterwards.
 *
 * It never throws. Input that does not read comes back with `input` null and
 * what is wrong in `errors`, for the handler to answer as a refusal like any
 * other. A thrown error would reach the visitor as a broken page.
 */
export function formOr<T extends z.ZodType>(schema: T) {
  return (given: z.input<T>) => {
    const raw: unknown = given
    const viaForm = raw instanceof FormData
    const read = schema.safeParse(viaForm ? formFields(raw) : raw)
    return {
      input: read.success ? (read.data as z.output<T>) : null,
      errors: read.success ? undefined : fieldErrors(read.error),
      viaForm,
      back: viaForm ? safeBackPath(raw.get('back')) : '/',
    }
  }
}

/** What is wrong with some input, by field, in words to show beside it. */
export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const name = String(issue.path[0] ?? 'form')
    errors[name] ??= issue.message
  }
  return errors
}

/**
 * A form's fields as an object. A name that appears more than once, as a
 * group of checkboxes does, becomes a list.
 */
export function formFields(form: FormData) {
  const fields: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {}
  for (const name of new Set(form.keys())) {
    const values = form.getAll(name)
    fields[name] = values.length > 1 ? values : values[0]
  }
  return fields
}
