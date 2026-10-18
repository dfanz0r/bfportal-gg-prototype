// @vitest-environment happy-dom
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { expect, it } from 'vitest'

import { Icon, type IconName } from './icon'

it('redraws when its name changes, between and across line and brand icons', () => {
  const [name, setName] = createSignal<IconName>('discord')
  const root = document.createElement('div')
  const dispose = render(() => <Icon name={name()} />, root)
  const viewBox = () => root.querySelector('svg')?.getAttribute('viewBox')
  const shapes = () => root.querySelectorAll('svg > *').length

  const discord = viewBox()
  expect(discord).not.toBe('0 0 24 24')

  // One brand mark to another.
  setName('github')
  expect(viewBox()).not.toBe(discord)

  // A brand mark to a line icon.
  setName('search')
  expect(viewBox()).toBe('0 0 24 24')
  expect(root.querySelectorAll('circle')).toHaveLength(1)

  // One line icon to another.
  setName('menu')
  expect(root.querySelectorAll('circle')).toHaveLength(0)
  expect(shapes()).toBe(3)

  // And back to a brand mark.
  setName('discord')
  expect(viewBox()).toBe(discord)
  expect(root.querySelectorAll('svg')).toHaveLength(1)

  dispose()
})
