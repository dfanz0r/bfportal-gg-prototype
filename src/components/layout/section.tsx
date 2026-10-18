import { children, type JSX, Show } from 'solid-js'

import { display } from '../ui/ui'

/**
 * A titled part of a page: the heading on a rule that starts with a short
 * accent segment, a note beside it, and somewhere to go for more on the right.
 */
export function Section(props: {
  id?: string
  title: string
  /** More of the title, drawn in the accent color. The home page's headings. */
  accent?: string
  /** The home page's larger heading. Inner pages use the smaller one. */
  large?: boolean
  note?: string
  action?: JSX.Element
  children: JSX.Element
}) {
  // Read once, as in `PageHead`: testing for it and then drawing it would
  // build it twice and break hydration.
  const action = children(() => props.action)
  return (
    <section id={props.id} class="scroll-mt-20 pt-10">
      <header
        class={`relative flex flex-wrap items-end gap-x-6 gap-y-2.5 border-b border-line pb-3.5 after:absolute after:-bottom-px after:left-0 after:h-px after:w-11 after:bg-accent ${props.large ? 'mb-6' : 'mb-[18px]'}`}
      >
        <h2
          class={`${display} leading-none tracking-[0.02em] text-steel-hi ${props.large ? 'text-3xl' : 'text-[26px]'}`}
        >
          {props.title}
          <Show when={props.accent}>
            {' '}
            <span class="text-accent">{props.accent}</span>
          </Show>
        </h2>
        <Show when={props.note}>
          <p class="pb-0.5 text-[13.5px] text-fg-3 max-sm:hidden">
            {props.note}
          </p>
        </Show>
        <Show when={action()}>
          <div class="ml-auto pb-0.5 text-[13px] font-semibold tracking-[0.08em] whitespace-nowrap text-fg-2 uppercase">
            {action()}
          </div>
        </Show>
      </header>
      {props.children}
    </section>
  )
}
