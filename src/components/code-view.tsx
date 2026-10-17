import { For } from 'solid-js'

/**
 * Text shown as code, a numbered line at a time. Nothing here runs it, and
 * the numbers are drawn by the page, so copying the text does not pick them
 * up. Long lines scroll sideways.
 */
export function CodeView(props: { text: string; class?: string }) {
  return (
    <pre
      class={`overflow-auto bg-base py-4 font-mono text-[13px] leading-[1.7] text-fg-2 ${props.class ?? ''}`}
    >
      <code class="block [counter-reset:line]">
        {/* A file ends with a line break, which is not a line. */}
        <For each={props.text.replace(/\n$/, '').split('\n')}>
          {(line) => (
            <span class="block pr-4 whitespace-pre before:mr-4 before:inline-block before:w-[52px] before:text-right before:text-fg-3/60 before:content-[counter(line)] before:[counter-increment:line]">
              {line || ' '}
            </span>
          )}
        </For>
      </code>
    </pre>
  )
}
