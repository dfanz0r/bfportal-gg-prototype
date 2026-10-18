import type { JSX } from 'solid-js'

/** One "name: value" row of a list of facts. Put them inside `<Facts>`. */
export function Fact(props: { name: string; children: JSX.Element }) {
  return (
    <>
      <dt class="border-t border-line py-[9px] pr-5 text-sm text-fg-3">
        {props.name}
      </dt>
      <dd class="flex justify-end border-t border-line py-[9px] text-right text-sm font-medium">
        {props.children}
      </dd>
    </>
  )
}
