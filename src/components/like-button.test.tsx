// @vitest-environment happy-dom
import { render } from 'solid-js/web'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LikeButton } from './like-button'

const likeExperience = vi.hoisted(() =>
  Object.assign(vi.fn(), { url: '/like' }),
)
vi.mock('../functions/likes', () => ({ likeExperience }))

function mount(signedIn = true) {
  const host = document.createElement('div')
  document.body.append(host)
  render(
    () => (
      <LikeButton
        slug="gun-master"
        likes={4}
        liked={false}
        signedIn={signedIn}
      />
    ),
    host,
  )
  return host
}

/** Presses the button, as the browser would: the form is submitted. */
function press(host: HTMLElement) {
  const event = new Event('submit', { bubbles: true, cancelable: true })
  host.querySelector('form')?.dispatchEvent(event)
  return event
}

const shown = (host: HTMLElement) =>
  Number.parseInt(host.querySelector('button')?.textContent ?? '', 10)

describe('LikeButton', () => {
  beforeEach(() => {
    likeExperience.mockReset()
  })

  it('sends one request at a time, however fast it is pressed', async () => {
    let answer: (result: unknown) => void = () => {}
    likeExperience.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    )
    const host = mount()

    press(host)
    press(host)
    press(host)
    expect(likeExperience).toHaveBeenCalledTimes(1)
    // Shown at once, and only once.
    expect(shown(host)).toBe(5)

    answer({ ok: true, liked: true, likes: 5 })
    await vi.waitFor(() =>
      expect(host.querySelector('button')?.ariaBusy).not.toBe('true'),
    )
    press(host)
    expect(likeExperience).toHaveBeenCalledTimes(2)
    expect(likeExperience).toHaveBeenLastCalledWith({
      data: { slug: 'gun-master', liked: false },
    })
  })

  it('puts the count back when the like did not go through', async () => {
    likeExperience.mockResolvedValueOnce({ ok: false, reason: 'not-found' })
    const refused = mount()
    press(refused)
    expect(shown(refused)).toBe(5)
    await vi.waitFor(() => expect(shown(refused)).toBe(4))

    likeExperience.mockRejectedValueOnce(new Error('offline'))
    const failed = mount()
    press(failed)
    await vi.waitFor(() => expect(shown(failed)).toBe(4))
  })

  it('leaves the form to the browser for a visitor who is not signed in', () => {
    const event = press(mount(false))
    expect(event.defaultPrevented).toBe(false)
    expect(likeExperience).not.toHaveBeenCalled()
  })
})
