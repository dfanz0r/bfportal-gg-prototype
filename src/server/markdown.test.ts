import { describe, expect, it } from 'vitest'

import { pictureHosts, renderMarkdown } from './markdown'

describe('rendering Markdown', () => {
  it('renders what people write', () => {
    expect(renderMarkdown('# Rules\n\nFirst to **three** captures.')).toBe(
      '<h1>Rules</h1>\n<p>First to <strong>three</strong> captures.</p>',
    )
    expect(renderMarkdown('- one\n- two')).toBe(
      '<ul>\n<li>one</li>\n<li>two</li>\n</ul>',
    )
    expect(renderMarkdown('line one\nline two')).toBe(
      '<p>line one<br />line two</p>',
    )
    expect(renderMarkdown('')).toBe('')
  })

  it("marks every link as someone else's", () => {
    expect(renderMarkdown('[the thread](https://example.com/t)')).toBe(
      '<p><a href="https://example.com/t" rel="nofollow noopener ugc">the thread</a></p>',
    )
    // A bare address becomes a link too.
    expect(renderMarkdown('https://youtu.be/abc')).toContain(
      '<a href="https://youtu.be/abc" rel="nofollow noopener ugc">',
    )
  })

  it.each([
    ['a script tag', '<script>alert(1)</script>hello'],
    [
      'an event handler',
      '<img src="https://e.example/x.png" onerror="alert(1)">',
    ],
    ['a javascript link', '[click](javascript:alert(1))'],
    ['a javascript link in HTML', '<a href="javascript:alert(1)">click</a>'],
    ['a data link', '[click](data:text/html,<script>alert(1)</script>)'],
    ['an iframe', '<iframe src="https://evil.example"></iframe>'],
    [
      'a style attribute',
      '<p style="position:fixed;inset:0">over the page</p>',
    ],
    ['a style tag', '<style>body{display:none}</style>'],
    ['an svg with a script', '<svg><script>alert(1)</script></svg>'],
    [
      'a form',
      '<form action="https://evil.example"><input name="password"></form>',
    ],
    ['an encoded script link', '<a href="&#106;avascript:alert(1)">x</a>'],
  ])('lets nothing run from %s', (_, input) => {
    const html = renderMarkdown(input)
    expect(html).not.toMatch(
      /<script|<iframe|<style|<svg|<form|<input|javascript:|data:text|\son\w+=|style=/i,
    )
  })

  it('keeps pictures to HTTPS and stops them reporting back', () => {
    expect(renderMarkdown('![a map](https://i.example/map.png)')).toBe(
      '<p><img src="https://i.example/map.png" alt="a map" loading="lazy" referrerpolicy="no-referrer" /></p>',
    )
    expect(renderMarkdown('![a map](http://i.example/map.png)')).not.toContain(
      'src=',
    )
    expect(renderMarkdown('![x](//i.example/map.png)')).not.toContain('src=')
  })

  it('shows HTML someone typed as text they typed, or not at all', () => {
    expect(renderMarkdown('Use `<b>` for bold')).toBe(
      '<p>Use <code>&lt;b&gt;</code> for bold</p>',
    )
    expect(renderMarkdown('<div class="x" id="y">text</div>')).toBe('text')
  })
})

describe('a writer cannot choose the attributes the site sets', () => {
  it('overwrites rel on a link and keeps nothing else', () => {
    expect(
      renderMarkdown(
        '<a href="https://e.example" rel="opener" target="_top">x</a>',
      ),
    ).toBe(
      '<p><a href="https://e.example" rel="nofollow noopener ugc">x</a></p>',
    )
  })
})

describe('the hosts a description loads pictures from', () => {
  it('lists each host once, for a moderator to see', () => {
    const html = renderMarkdown(
      [
        '![cover](https://i.imgur.com/a.png)',
        '![map](https://i.imgur.com/b.png)',
        '![badge](https://tracker.example/pixel.gif?page=1)',
        // Dropped by the renderer, so not loaded and not listed.
        '![plain](http://insecure.example/c.png)',
      ].join('\n\n'),
    )
    expect(pictureHosts(html)).toEqual(['i.imgur.com', 'tracker.example'])
  })

  it('is empty for text with no pictures', () => {
    expect(
      pictureHosts(
        renderMarkdown('Just words, and a [link](https://e.example).'),
      ),
    ).toEqual([])
  })
})
