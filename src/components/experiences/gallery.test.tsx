// @vitest-environment happy-dom
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { describe, expect, it } from 'vitest'

import { type Media, mediaOf } from '../../shared/media'
import { Gallery } from './gallery'

const pictures = (...urls: string[]): Media[] =>
  urls.map((url) => ({ kind: 'image', url }))

describe('Gallery', () => {
  it('falls back to a picture that exists when its pictures change', () => {
    const [items, setItems] = createSignal(pictures('a.png', 'b.png'))
    const host = document.body.appendChild(document.createElement('div'))
    const dispose = render(() => <Gallery items={items()} />, host)
    const main = () => host.querySelector('img')?.getAttribute('src')

    host.querySelector<HTMLButtonElement>('[aria-label="Next"]')?.click()
    expect(main()).toBe('b.png')

    // The page moved to an experience with one picture.
    setItems(pictures('c.png'))
    expect(main()).toBe('c.png')
    expect(host.querySelector('[aria-label="Next"]')).toBeNull()
    dispose()
  })

  it('goes round from the last picture to the first', () => {
    const host = document.body.appendChild(document.createElement('div'))
    const dispose = render(
      () => <Gallery items={pictures('a.png', 'b.png')} />,
      host,
    )
    const next = host.querySelector<HTMLButtonElement>('[aria-label="Next"]')

    next?.click()
    expect(host.querySelector('img')?.getAttribute('src')).toBe('b.png')
    next?.click()
    expect(host.querySelector('img')?.getAttribute('src')).toBe('a.png')
    dispose()
  })

  it('loads the player only once a video is played, and stops it on moving', () => {
    const video = mediaOf('https://youtu.be/jNQXAC9IVRw')
    if (video.kind !== 'video') throw new Error('not a video')
    const host = document.body.appendChild(document.createElement('div'))
    const dispose = render(
      () => <Gallery items={[video, ...pictures('a.png')]} />,
      host,
    )
    const play = () =>
      host.querySelector<HTMLAnchorElement>('[aria-label="Play video"]')

    // Before it is played: the thumbnail, linked to the video on YouTube.
    expect(host.querySelector('iframe')).toBeNull()
    expect(play()?.getAttribute('href')).toBe('https://youtu.be/jNQXAC9IVRw')
    expect(play()?.querySelector('img')?.getAttribute('src')).toBe(
      video.thumbnail,
    )
    expect(host.querySelector('[aria-label="Video 1 of 2"]')).not.toBeNull()

    play()?.click()
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe(video.embed)

    host.querySelector<HTMLButtonElement>('[aria-label="Next"]')?.click()
    expect(host.querySelector('iframe')).toBeNull()
    host.querySelector<HTMLButtonElement>('[aria-label="Previous"]')?.click()
    expect(host.querySelector('iframe')).toBeNull()
    expect(play()).not.toBeNull()
    dispose()
  })
})
