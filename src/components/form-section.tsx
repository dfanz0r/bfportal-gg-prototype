import { type JSX, Show } from 'solid-js'

import { display } from './ui'

/**
 * A titled part of a form: its name in the display face on a rule, a note
 * beside it, then its fields with even space between them.
 */
export function FormSection(props: {
  title: string
  note?: string
  children: JSX.Element
}) {
  return (
    <fieldset class="min-w-0 pb-8">
      <legend
        class={`${display} mb-[18px] flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-3 text-2xl leading-none tracking-[0.02em] text-steel-hi`}
      >
        {props.title}
        <Show when={props.note}>
          <small class="font-sans text-[13.5px] font-normal tracking-normal text-fg-3 normal-case">
            {props.note}
          </small>
        </Show>
      </legend>
      <div class="grid gap-[18px]">{props.children}</div>
    </fieldset>
  )
}
