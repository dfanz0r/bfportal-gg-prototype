// @vitest-environment happy-dom
import { render } from 'solid-js/web'
import { describe, expect, it } from 'vitest'

import { ShowMore } from './show-more'

function mount(props: { shown: number; total: number; page: number }) {
  const host = document.createElement('div')
  render(
    () => (
      <ShowMore {...props} lastPage={20}>
        <a href="?page=next">Show more</a>
      </ShowMore>
    ),
    host,
  )
  return host
}

describe('ShowMore', () => {
  it('offers more while there is more and room to grow', () => {
    expect(
      mount({ shown: 12, total: 40, page: 1 }).querySelector('a'),
    ).not.toBeNull()
    expect(
      mount({ shown: 40, total: 40, page: 4 }).querySelector('a'),
    ).toBeNull()
  })

  it('does not link past the last page the address accepts', () => {
    // 240 of 300 shown: a link to page 21 would be dropped and start again.
    const host = mount({ shown: 240, total: 300, page: 20 })
    expect(host.querySelector('a')).toBeNull()
    expect(host.textContent).toContain('Narrow the search')
  })
})
