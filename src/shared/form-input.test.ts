import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { formBoolean, formOr } from './form-input'

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

  it('sends a form back only to a path on this site', () => {
    const back = (value: string) =>
      read(posted({ slug: 'x', liked: 'true', back: value })).back
    expect(back('//evil.example')).toBe('/')
    expect(back('/\\evil.example')).toBe('/')
    expect(back('https://evil.example')).toBe('/')
    expect(back('/library?tag=bc2.bf3')).toBe('/library?tag=bc2.bf3')
  })
})
