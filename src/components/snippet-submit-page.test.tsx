// @vitest-environment happy-dom
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'

import type { SnippetSubmitPageData } from '../functions/submit-snippet'
import { SnippetSubmitPage } from './snippet-submit-page'

const submitSnippetForReview = vi.hoisted(() =>
  Object.assign(vi.fn(), { url: '/submit-snippet' }),
)
vi.mock('../functions/submit-snippet', () => ({ submitSnippetForReview }))
vi.mock('@tanstack/solid-router', () => ({
  useNavigate: () => () => Promise.resolve(),
  useLocation: () => () => ({ href: '/', pathname: '/' }),
  Link: (props: { children?: unknown }) => props.children,
}))

/** The edit page for one of the owner's live snippets. */
const pageFor = (slug: string, script: string) =>
  ({
    state: 'ok',
    options: {
      categories: [{ slug: 'rules', name: 'Rules' }],
      currentSdk: null,
    },
    draft: {
      fields: { title: slug, script, category: 'rules', editing: slug },
      errors: {},
    },
    editing: {
      slug,
      title: slug,
      status: 'published',
      reviewNote: null,
      editWaiting: false,
    },
  }) as unknown as SnippetSubmitPageData

describe('SnippetSubmitPage', () => {
  it('given another snippet, sends that one with its own code', () => {
    const [data, setData] = createSignal(pageFor('first', 'first code'))
    const host = document.createElement('div')
    document.body.append(host)
    render(() => <SnippetSubmitPage data={data()} />, host)

    const box = () =>
      host.querySelector<HTMLTextAreaElement>('textarea[name=script]')
    const box1 = box()
    if (!box1) throw new Error('expected the snippet box')
    box1.value = 'typed into the first'
    box1.dispatchEvent(new Event('input', { bubbles: true }))

    // The router gives the same page another snippet.
    setData(pageFor('second', 'second code'))
    const form = host.querySelector('form')
    if (!form) throw new Error('expected the form')
    const sent = new FormData(form)
    expect(sent.get('editing')).toBe('second')
    expect(sent.get('script')).toBe('second code')
    expect(box()?.value).toBe('second code')
  })
})
