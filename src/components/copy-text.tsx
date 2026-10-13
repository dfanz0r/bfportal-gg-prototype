import { createCopy } from './copy'
import { Icon } from './icon'

/** A small button that copies some text, such as a whole script. */
export function CopyText(props: { text: string; label: string }) {
  const { copied, copy } = createCopy()

  return (
    <button
      type="button"
      onClick={() => copy(props.text)}
      class="inline-flex items-center gap-1.5 text-fg-2 hover:text-fg"
    >
      <Icon name={copied() ? 'check' : 'copy'} class="size-3.5" />
      <span aria-live="polite">{copied() ? 'Copied' : props.label}</span>
    </button>
  )
}
