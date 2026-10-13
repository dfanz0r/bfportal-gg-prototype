// @vitest-environment happy-dom
import { render } from 'solid-js/web'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReportType } from '../shared/content'
import { ReportMenu } from './report-menu'

const reportProblem = vi.hoisted(() =>
  Object.assign(vi.fn(), { url: '/report' }),
)
vi.mock('../functions/reports', () => ({ reportProblem }))

function mount(reported: ReportType[]) {
  const host = document.createElement('div')
  document.body.append(host)
  render(
    () => <ReportMenu slug="gun-master" signedIn reported={reported} />,
    host,
  )
  return host
}

const choice = (host: HTMLElement, type: ReportType) =>
  host.querySelector<HTMLButtonElement>(`button[value="${type}"]`)

/** Chooses one, as the browser would: the form is submitted by its button. */
function choose(host: HTMLElement, type: ReportType) {
  host.querySelector('form')?.dispatchEvent(
    new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: choice(host, type),
    }),
  )
}

describe('ReportMenu', () => {
  beforeEach(() => {
    reportProblem.mockReset()
  })

  it('shows what this visitor reported before as sent', () => {
    const host = mount(['broken'])
    expect(choice(host, 'broken')?.disabled).toBe(true)
    expect(choice(host, 'broken')?.textContent).toContain('Sent')
    expect(choice(host, 'bugged')?.disabled).toBe(false)

    // And does not send it again.
    choose(host, 'broken')
    expect(reportProblem).not.toHaveBeenCalled()
  })

  it('marks one sent only once the server has it', async () => {
    reportProblem.mockRejectedValueOnce(new Error('offline'))
    const host = mount([])
    choose(host, 'bugged')
    await vi.waitFor(() => expect(reportProblem).toHaveBeenCalledTimes(1))
    expect(choice(host, 'bugged')?.disabled).toBe(false)

    reportProblem.mockResolvedValueOnce({ ok: true })
    choose(host, 'bugged')
    await vi.waitFor(() => expect(choice(host, 'bugged')?.disabled).toBe(true))
    expect(reportProblem).toHaveBeenLastCalledWith({
      data: { slug: 'gun-master', type: 'bugged' },
    })
  })
})
