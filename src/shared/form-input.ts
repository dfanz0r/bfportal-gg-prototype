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
 * The validator for a function that a form may post to. `viaForm` says which
 * way it was called; a form's `back` field is where to send the visitor
 * afterwards.
 */
export function formOr<T extends z.ZodType>(schema: T) {
  return (given: z.input<T>) => {
    const raw: unknown = given
    if (raw instanceof FormData) {
      return {
        input: schema.parse(Object.fromEntries(raw)) as z.output<T>,
        viaForm: true,
        back: safeBackPath(raw.get('back')),
      }
    }
    return {
      input: schema.parse(raw) as z.output<T>,
      viaForm: false,
      back: '/',
    }
  }
}
