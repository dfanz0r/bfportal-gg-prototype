import { Show } from 'solid-js'

import { healthFlagLabels } from '../../shared/admin-search'
import { tag } from './ui'

/**
 * What is wrong with an experience, as tags. Broken is said as "Not
 * available", as the nightly code check says it, since both mean it does not
 * load.
 */
export function FlagTags(props: {
  flags: {
    bugged: boolean
    broken: boolean
    xpFarm: boolean
    unavailable: boolean
  }
  /** Say "None" when nothing is wrong, rather than nothing. */
  none?: boolean
}) {
  const any = () =>
    props.flags.bugged || props.flags.xpFarm || props.flags.unavailable
  return (
    <span class="inline-flex flex-wrap gap-1.5">
      <Show when={props.flags.bugged}>
        <span class={`${tag} border-warn/60 text-warn`}>
          {healthFlagLabels.bugged}
        </span>
      </Show>
      <Show when={props.flags.xpFarm}>
        <span class={`${tag} border-warn/60 text-warn`}>
          {healthFlagLabels.xp_farm}
        </span>
      </Show>
      <Show when={props.flags.unavailable}>
        <span class={`${tag} border-danger/60 text-danger`}>
          {healthFlagLabels.unavailable}
        </span>
      </Show>
      <Show when={props.none && !any()}>
        <span class={`${tag} border-line-strong text-fg-3`}>None</span>
      </Show>
    </span>
  )
}
