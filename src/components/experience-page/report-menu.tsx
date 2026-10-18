import { createSignal, For, Show } from 'solid-js'

import { reportProblem } from '../../functions/reports'
import type { ReportType } from '../../shared/content'
import { createDismiss } from '../ui/dismiss'
import { Icon } from '../ui/icon'

const KINDS: { type: ReportType; label: string }[] = [
  { type: 'bugged', label: 'Something in it is broken' },
  { type: 'broken', label: 'It no longer loads' },
  { type: 'xp_farm', label: 'It is an XP farm' },
]

/**
 * The menu for telling the moderators something is wrong with an experience.
 * Each choice is a button of one form, posted to the function the script
 * calls, so it works before the page's script has loaded.
 */
export function ReportMenu(props: {
  slug: string
  signedIn: boolean
  /** What this visitor has reported here before. */
  reported: ReportType[]
}) {
  const dismiss = createDismiss({ staysOpen: true })
  // What has been sent since the page loaded, by experience. Going from one
  // experience to another keeps this menu and changes its slug, and a report
  // made on one says nothing about the next.
  const [justSent, setJustSent] = createSignal<Record<string, ReportType[]>>({})
  // What the page was loaded with, and what has been sent since. A report is
  // made once, so each of these stays "Sent" however the page is reached.
  const sent = () => [...props.reported, ...(justSent()[props.slug] ?? [])]

  const submit = async (event: SubmitEvent) => {
    // Signing in is a full page load; let the form go there.
    if (!props.signedIn) return
    event.preventDefault()
    const button = event.submitter as HTMLButtonElement | null
    const type = button?.value as ReportType | undefined
    if (!type || sent().includes(type)) return
    // The experience it was sent about, whichever is shown when it answers.
    const slug = props.slug
    try {
      const result = await reportProblem({ data: { slug, type } })
      if (result.ok) {
        setJustSent((all) => ({ ...all, [slug]: [...(all[slug] ?? []), type] }))
      }
    } catch {
      // The button stays as it was, to try again. Sending one twice is safe:
      // a report is recorded once.
    }
  }

  return (
    <details class="relative" ref={dismiss}>
      <summary
        class="inline-flex h-[38px] items-center gap-2 border border-line-strong px-3 text-[13.5px] font-semibold text-fg-2 hover:border-steel hover:text-fg"
        aria-label="Report a problem"
      >
        <Icon name="alert" />
        <span class="max-sm:hidden">Report</span>
      </summary>
      <form
        method="post"
        action={reportProblem.url}
        onSubmit={submit}
        class="absolute top-11 right-0 z-20 grid w-64 border border-line-strong bg-surface-1 p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.6)]"
      >
        <input type="hidden" name="slug" value={props.slug} />
        <input type="hidden" name="back" value={`/experiences/${props.slug}`} />
        <For each={KINDS}>
          {(kind) => (
            <button
              type="submit"
              name="type"
              value={kind.type}
              disabled={sent().includes(kind.type)}
              class="flex items-center justify-between gap-3 px-2.5 py-2 text-left text-sm text-fg-2 hover:bg-surface-2 hover:text-fg disabled:text-fg-3"
            >
              {kind.label}
              <Show when={sent().includes(kind.type)}>
                <span class="inline-flex items-center gap-1 text-xs">
                  <Icon name="check" class="size-3" />
                  Sent
                </span>
              </Show>
            </button>
          )}
        </For>
        <p class="px-2.5 pt-1.5 pb-1 text-xs text-fg-3">
          A moderator looks at reports. Nothing changes until they do.
        </p>
      </form>
    </details>
  )
}
