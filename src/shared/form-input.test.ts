import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { formBoolean, formFields, formOr, MAX_FORM_FIELDS } from './form-input'

const read = formOr(
  z.object({ slug: z.string().min(1).max(200), liked: formBoolean }),
)

function posted(fields: Record<string, string>) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  return form as never
}

describe('formOr', () => {
  it('reads an object from the script and a form from the page alike', () => {
    expect(read({ slug: 'gun-master', liked: true })).toEqual({
      input: { slug: 'gun-master', liked: true },
      errors: undefined,
      viaForm: false,
      back: '/',
    })
    expect(
      read(
        posted({
          slug: 'gun-master',
          liked: 'false',
          back: '/experiences/gun-master',
        }),
      ),
    ).toEqual({
      input: { slug: 'gun-master', liked: false },
      errors: undefined,
      viaForm: true,
      back: '/experiences/gun-master',
    })
  })

  it('never throws: what does not read comes back as errors by field', () => {
    for (const given of [
      {},
      null,
      'nonsense',
      { slug: '', liked: 'perhaps' },
      posted({ liked: 'perhaps' }),
    ]) {
      const result = read(given as never)
      expect(result.input).toBeNull()
      expect(Object.keys(result.errors ?? {}).length).toBeGreaterThan(0)
    }
    expect(read(posted({ liked: 'perhaps' })).errors).toHaveProperty('slug')
  })

  it('reads a name given more than once as a list, and any name as a field', () => {
    const form = new FormData()
    form.append('tag', 'a')
    form.append('slug', 's')
    form.append('tag', 'b')
    form.append('tag', 'c')
    form.append('__proto__', 'x')
    const fields = formFields(form)
    expect(fields.tag).toEqual(['a', 'b', 'c'])
    expect(fields.slug).toBe('s')
    expect(Object.getPrototypeOf(fields)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(fields, '__proto__')?.value).toBe(
      'x',
    )
  })

  it('refuses a form with more fields than any page sends, and reads it quickly', () => {
    const form = new FormData()
    form.append('slug', 'gun-master')
    form.append('liked', 'true')
    for (let index = 0; index < MAX_FORM_FIELDS; index += 1) {
      form.append(`f${index}`, 'x')
    }
    expect(read(form as never)).toMatchObject({
      input: null,
      errors: { form: expect.any(String) },
      viaForm: true,
    })

    // Many names, each once, just under the cap: one pass, not one per name.
    const wide = new FormData()
    wide.append('slug', 'gun-master')
    wide.append('liked', 'true')
    for (let index = 0; index < MAX_FORM_FIELDS - 2; index += 1) {
      wide.append(`f${index}`, 'x'.repeat(100))
    }
    const started = performance.now()
    expect(read(wide as never).input).toEqual({
      slug: 'gun-master',
      liked: true,
    })
    expect(performance.now() - started).toBeLessThan(200)
  })

  it('sends a form back only to a path on this site', () => {
    const back = (value: string) =>
      read(posted({ slug: 'x', liked: 'true', back: value })).back
    expect(back('//evil.example')).toBe('/')
    expect(back('/\\evil.example')).toBe('/')
    expect(back('https://evil.example')).toBe('/')
    expect(back('/library?tag=bc2.bf3')).toBe('/library?tag=bc2.bf3')
  })
})
