import { type JSX, Show } from 'solid-js'

import { display } from './ui'

/**
 * A titled part of a page: the heading on a rule, a note beside it, and
 * somewhere to go for more on the right.
 */
export function Section(props: {
  id?: string
  title: string
  note?: string
  action?: JSX.Element
  children: JSX.Element
}) {
  return (
    <section id={props.id} class="scroll-mt-20 pt-10">
      <header class="mb-6 flex flex-wrap items-end gap-x-6 gap-y-2.5 border-b border-line pb-3.5">
        <h2
          class={`${display} text-3xl leading-none tracking-[0.02em] text-steel-hi sm:text-[34px]`}
        >
          {props.title}
        </h2>
        <Show when={props.note}>
          <p class="pb-0.5 text-sm text-fg-3 max-sm:hidden">{props.note}</p>
        </Show>
        <Show when={props.action}>
          <div class="ml-auto pb-0.5 text-[13.5px] font-semibold text-steel-hi">
            {props.action}
          </div>
        </Show>
      </header>
      {props.children}
    </section>
  )
}
