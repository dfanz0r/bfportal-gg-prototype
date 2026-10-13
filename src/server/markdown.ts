import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

// The one place Markdown someone wrote becomes HTML the site will show.
//
// Descriptions, update posts and playtest briefs are stored as Markdown and as
// the HTML made from it here, and pages print that HTML as it is. So nothing
// may write one of those HTML columns except through `renderMarkdown`: this is
// what stands between what a stranger typed and every visitor's browser.

const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]

/** Markdown to HTML that is safe to print into a page. */
export function renderMarkdown(markdown: string) {
  const html = marked.parse(markdown, {
    async: false,
    gfm: true,
    // A single line break is a line break, as people expect when they type.
    breaks: true,
  })
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    // No classes, ids, styles or event handlers survive on anything. `rel`,
    // `loading` and `referrerpolicy` are listed so the values set below are
    // kept; whatever the writer put there is overwritten.
    allowedAttributes: {
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'title', 'loading', 'referrerpolicy'],
      th: ['align'],
      td: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    // Pictures only over HTTPS: the page is, and a plain one would be blocked
    // or would leak that the page was opened.
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    transformTags: {
      // A link someone else wrote earns no search credit and cannot reach
      // back into the page that opened it.
      a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener ugc' }),
      img: sanitizeHtml.simpleTransform('img', {
        loading: 'lazy',
        referrerpolicy: 'no-referrer',
      }),
    },
  }).trim()
}

/**
 * The hosts a piece of rendered HTML loads pictures from, for a moderator to
 * see before approving it. A picture is fetched by every visitor's browser,
 * so whoever hosts it learns who opened the page.
 *
 * Takes HTML from `renderMarkdown`, where every picture left is an HTTPS one
 * with its address in a plain `src`.
 */
export function pictureHosts(html: string) {
  const hosts = new Set<string>()
  for (const [, address] of html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)) {
    try {
      hosts.add(new URL(address).hostname)
    } catch {
      // Not an address a browser would fetch.
    }
  }
  return [...hosts].sort()
}
