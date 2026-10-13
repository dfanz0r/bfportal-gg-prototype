import { onCleanup, onMount } from 'solid-js'

import { Icon } from './icon'
import { buttonSteel } from './ui'

/**
 * The framed search field. It submits as a plain GET form, so it works before
 * the page's script has loaded. Pressing "/" anywhere on the page focuses it.
 */
export function SearchForm(props: {
  action: string
  placeholder: string
  label: string
  value?: string
  class?: string
}) {
  let input: HTMLInputElement | undefined

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      if (event.key === '/' && !typing) {
        event.preventDefault()
        input?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    onCleanup(() => document.removeEventListener('keydown', onKey))
  })

  return (
    <search class={props.class}>
      <form
        action={props.action}
        class="frame flex h-[50px] max-w-[560px] items-center border border-line-strong bg-surface-1/90 focus-within:border-steel"
      >
        <Icon name="search" class="ml-4 size-5 text-steel" />
        <input
          type="search"
          name="q"
          ref={(element) => {
            input = element
          }}
          value={props.value ?? ''}
          placeholder={props.placeholder}
          aria-label={props.label}
          autocomplete="off"
          class="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[15.5px] text-fg outline-none placeholder:text-fg-3"
        />
        <span
          class="mr-3 border border-line-strong px-1.5 py-px font-mono text-[10.5px] text-fg-3 max-sm:hidden"
          aria-hidden="true"
        >
          /
        </span>
        <button type="submit" class={`${buttonSteel} -my-px -mr-px h-[50px]`}>
          Search
        </button>
      </form>
    </search>
  )
}
