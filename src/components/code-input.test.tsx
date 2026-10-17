// @vitest-environment happy-dom
import { render } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'

import { CodeInput } from './code-input'

/** A chosen file whose text comes when `finish` is called. */
function slowFile(text: string) {
  let finish: () => void = () => {}
  const read = new Promise<string>((resolve) => {
    finish = () => resolve(text)
  })
  return { file: { text: () => read }, finish }
}

/** Chooses a file, as the browser does: the input changes. */
function choose(
  input: HTMLInputElement,
  file: { text: () => Promise<string> },
) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const settle = () => new Promise((settled) => setTimeout(settled, 0))

describe('CodeInput', () => {
  it('fills the box from the file chosen last, and only then lets the form go', async () => {
    const reading = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    render(
      () => (
        <CodeInput
          id="code"
          name="code"
          value=""
          maxLines={100}
          onReading={reading}
        />
      ),
      host,
    )
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')
    const area = host.querySelector('textarea')
    if (!input || !area) throw new Error('expected the inputs')

    const first = slowFile('let first = 1')
    const second = slowFile('let second = 2')
    choose(input, first.file)
    choose(input, second.file)

    // The first comes back while the second is still being read.
    first.finish()
    await settle()
    expect(area.value).toBe('')
    expect(reading).toHaveBeenLastCalledWith(true)

    second.finish()
    await settle()
    expect(area.value).toBe('let second = 2')
    expect(reading).toHaveBeenLastCalledWith(false)
  })
})
