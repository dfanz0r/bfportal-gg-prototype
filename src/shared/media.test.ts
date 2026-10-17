import { describe, expect, it } from 'vitest'

import { mediaOf, shownMedia } from './media'

const ID = 'jNQXAC9IVRw'
const embed = (query = '') =>
  `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1${query}`

describe('mediaOf', () => {
  it('finds the video in each form of YouTube link', () => {
    for (const link of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?feature=share&v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
    ]) {
      expect(mediaOf(link)).toEqual({
        kind: 'video',
        url: link,
        thumbnail: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
        embed: embed(),
      })
    }
  })

  it('starts the player where the link does', () => {
    const start = (link: string) => (mediaOf(link) as { embed?: string }).embed
    expect(start(`https://youtu.be/${ID}?t=90`)).toBe(embed('&start=90'))
    expect(start(`https://youtu.be/${ID}?t=90s`)).toBe(embed('&start=90'))
    expect(start(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)).toBe(
      embed('&start=90'),
    )
    expect(start(`https://www.youtube.com/watch?v=${ID}&t=1h0m5s`)).toBe(
      embed('&start=3605'),
    )
    // A time it cannot read starts at the beginning.
    expect(start(`https://youtu.be/${ID}?t=soon`)).toBe(embed())
  })

  it('takes any other https link for a picture', () => {
    expect(mediaOf('https://i.imgur.com/a.png')).toEqual({
      kind: 'image',
      url: 'https://i.imgur.com/a.png',
    })
    // Named like YouTube, but not on it.
    expect(mediaOf(`https://youtube.com.evil.example/watch?v=${ID}`).kind).toBe(
      'image',
    )
  })

  it('says why a link cannot be shown', () => {
    const problem = (link: string) => {
      const media = mediaOf(link)
      return media.kind === 'none' ? media.problem : null
    }
    expect(problem('http://i.example/a.png')).toBe('not-https')
    expect(problem('not a link')).toBe('not-https')
    expect(problem('https://www.youtube.com/@battlefield')).toBe('not-a-video')
    expect(problem('https://www.youtube.com/watch?v=short')).toBe('not-a-video')
    expect(problem('https://youtu.be/')).toBe('not-a-video')
    expect(problem('https://www.twitch.tv/videos/1')).toBe('video-site')
    expect(problem('https://vimeo.com/1')).toBe('video-site')
  })
})

describe('shownMedia', () => {
  it('keeps the order and leaves out what cannot be shown', () => {
    expect(
      shownMedia([
        'https://i.example/a.png',
        'http://i.example/b.png',
        `https://youtu.be/${ID}`,
      ]).map((media) => media.kind),
    ).toEqual(['image', 'video'])
  })
})
