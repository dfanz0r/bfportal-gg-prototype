import { createSignal } from 'solid-js'

import { lineCount } from '../shared/snippet-form'
import { Icon } from './icon'

/**
 * Where a snippet is given: a box to paste into, with its lines numbered, and
 * a button in the bar over it that reads a file into the box. One box either
 * way, so what will be submitted can be read before it is.
 *
 * With no script running the box still posts, and a file chosen with the
 * button is posted beside it as `file`. The server takes the file over the
 * box: it was chosen after whatever the box holds.
 */
export function CodeInput(props: {
  id: string
  name: string
  value: string
  maxLines: number
  /**
   * Told while a chosen file is being read into the box. Until it is, the box
   * still holds what was there before, and the form must not be sent.
   */
  onReading?: (reading: boolean) => void
}) {
  const [text, setText] = createSignal(props.value)
  const [scrolled, setScrolled] = createSignal(0)
  let area: HTMLTextAreaElement | undefined
  const lines = () => lineCount(text())
  const numbers = () =>
    Array.from({ length: Math.max(lines(), 1) }, (_, index) => index + 1).join(
      '\n',
    )

  // The file chosen last is the one that counts. One chosen before it and
  // read after it neither fills the box nor lets the form be sent.
  let latest = 0
  const readFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file || !area) return
    latest += 1
    const reading = latest
    props.onReading?.(true)
    try {
      const read = await file.text()
      if (reading !== latest) return
      area.value = read
      setText(read)
      // The box has it now; the file itself need not be sent as well.
      input.value = ''
    } finally {
      if (reading === latest) props.onReading?.(false)
    }
  }

  return (
    <div class="border border-line-strong">
      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-line bg-surface-1 p-1.5">
        <label class="relative inline-flex h-8 cursor-pointer items-center gap-2 border border-steel bg-base pr-3.5 pl-[11px] text-[13px] font-semibold text-fg hover:border-steel-hi hover:bg-steel/8 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
          <Icon name="upload" class="size-4 text-steel-hi" />
          Upload a .ts file
          <input
            type="file"
            name="file"
            accept=".ts,.txt,text/plain,application/typescript"
            onChange={readFile}
            class="sr-only"
          />
        </label>
        <span class="text-[13px] text-fg-3">or paste it below</span>
        <span
          class={`ml-auto pr-2 text-[12.5px] ${lines() > props.maxLines ? 'text-danger' : 'text-fg-3'}`}
        >
          TypeScript. {lines()} of {props.maxLines} lines
        </span>
      </div>
      <div class="flex bg-base">
        {/* The numbers. The column takes its height from the box beside it,
            so the list is laid over it and moved as the box scrolls. */}
        <div
          class="relative w-[50px] shrink-0 overflow-hidden border-r border-line select-none"
          aria-hidden="true"
        >
          <pre
            class="absolute inset-x-0 top-0 pt-3 pr-2.5 text-right font-mono text-[13px] leading-[1.6] text-fg-3/60"
            style={{ transform: `translateY(-${scrolled()}px)` }}
          >
            {numbers()}
          </pre>
        </div>
        {/* A line never wraps, which is what keeps a number beside it. */}
        <textarea
          ref={(element) => {
            area = element
          }}
          id={props.id}
          name={props.name}
          spellcheck={false}
          onInput={(event) => setText(event.currentTarget.value)}
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop)}
          class="h-[270px] min-w-0 flex-1 resize-y overflow-auto bg-base p-3 font-mono text-[13px] leading-[1.6] whitespace-pre text-fg outline-none [tab-size:2]"
        >
          {props.value}
        </textarea>
      </div>
    </div>
  )
}
