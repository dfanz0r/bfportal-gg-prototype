import { Icon } from '../ui/icon'

/** The text to search for, in a row of filters. Enter applies it. */
export function FilterSearch(props: {
  value?: string
  placeholder: string
  class?: string
}) {
  return (
    <label
      class={`inline-flex h-[34px] items-center gap-2 border border-line-strong px-3 focus-within:border-steel ${props.class ?? ''}`}
    >
      <Icon name="search" class="size-4 shrink-0 text-fg-3" />
      <input
        type="search"
        name="q"
        value={props.value ?? ''}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        maxlength={100}
        class="min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-3"
      />
    </label>
  )
}
