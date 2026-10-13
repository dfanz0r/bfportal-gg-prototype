// @vitest-environment happy-dom
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { describe, expect, it } from 'vitest'

import { Gallery } from './gallery'

describe('Gallery', () => {
  it('falls back to a picture that exists when its pictures change', () => {
    const [images, setImages] = createSignal(['a.png', 'b.png'])
    const host = document.body.appendChild(document.createElement('div'))
    const dispose = render(() => <Gallery images={images()} />, host)
    const main = () => host.querySelector('img')?.getAttribute('src')

    host.querySelector<HTMLButtonElement>('[aria-label="Next image"]')?.click()
    expect(main()).toBe('b.png')

    // The page moved to an experience with one picture.
    setImages(['c.png'])
    expect(main()).toBe('c.png')
    expect(host.querySelector('[aria-label="Next image"]')).toBeNull()
    dispose()
  })

  it('goes round from the last picture to the first', () => {
    const host = document.body.appendChild(document.createElement('div'))
    const dispose = render(() => <Gallery images={['a.png', 'b.png']} />, host)
    const next = host.querySelector<HTMLButtonElement>(
      '[aria-label="Next image"]',
    )

    next?.click()
    expect(host.querySelector('img')?.getAttribute('src')).toBe('b.png')
    next?.click()
    expect(host.querySelector('img')?.getAttribute('src')).toBe('a.png')
    dispose()
  })
})
