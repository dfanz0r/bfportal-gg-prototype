import type { JSX } from 'solid-js'

import { panel } from './ui'

/** A panel of "name: value" rows. Its children are `<Fact>`s. */
export function Facts(props: { children: JSX.Element }) {
  return (
    <div class={`${panel} px-5 pb-1.5`}>
      <dl class="-mt-px grid grid-cols-[auto_minmax(0,1fr)]">
        {props.children}
      </dl>
    </div>
  )
}
