// @vitest-environment happy-dom
import { render } from 'solid-js/web'
import { describe, expect, it } from 'vitest'

import { PageHead } from './page-head'
import { Section } from './section'

// A prop that holds markup is built again each time it is read. A component
// that asks whether it has any and then draws it reads it twice: the server
// writes one copy and the browser hydrates another, and the page fails. These
// count how often the markup is built.

function counted() {
  let built = 0
  const Probe = () => {
    built += 1
    return <a href="/elsewhere">Elsewhere</a>
  }
  return { Probe, built: () => built }
}

describe('markup passed as a prop', () => {
  it('is built once by PageHead', () => {
    const { Probe, built } = counted()
    const host = document.createElement('div')
    render(() => <PageHead title="Events" actions={<Probe />} />, host)

    expect(built()).toBe(1)
    expect(host.querySelectorAll('a')).toHaveLength(1)
  })

  it('is built once by Section', () => {
    const { Probe, built } = counted()
    const host = document.createElement('div')
    render(
      () => (
        <Section title="Updates" action={<Probe />}>
          <p>Body</p>
        </Section>
      ),
      host,
    )

    expect(built()).toBe(1)
    expect(host.querySelectorAll('a')).toHaveLength(1)
  })

  it('leaves no empty holder behind when there is none', () => {
    const host = document.createElement('div')
    render(() => <PageHead title="Events" />, host)
    expect(host.querySelector('.items-center.gap-2')).toBeNull()
  })
})
