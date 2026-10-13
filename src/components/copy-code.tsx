import { createCopy } from './copy'
import { Icon } from './icon'
import { buttonAccent } from './ui'

/**
 * An experience's share code, which copies itself when pressed. Codes are
 * stored in lower case and copied in capitals, as Portal shows them.
 */
export function CopyCode(props: {
  code: string
  /** Words for the button, where it stands alone. Without them it shows the code. */
  label?: string
}) {
  const { copied, copy } = createCopy()

  return (
    <button
      type="button"
      onClick={() => copy(props.code.toUpperCase())}
      title="Copy experience code"
      class={
        props.label
          ? buttonAccent
          : 'inline-flex h-[30px] items-center gap-2 border border-line-strong px-2.5 font-mono text-[12.5px] font-semibold tracking-[0.12em] text-fg uppercase transition-colors hover:border-steel hover:bg-steel/6'
      }
    >
      <span>
        {props.label ? (copied() ? 'Copied' : props.label) : props.code}
      </span>
      <Icon
        name={copied() ? 'check' : 'copy'}
        class={props.label ? 'size-4' : 'size-3.5 text-fg-3'}
      />
      <span class="sr-only" aria-live="polite">
        {copied() ? 'Copied' : ''}
      </span>
    </button>
  )
}
