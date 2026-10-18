import { For } from 'solid-js'

/** The regions a playtest calls testers from. */
export function Regions(props: { regions: string[] }) {
  return (
    <span class="flex flex-wrap gap-1.5">
      <For each={props.regions}>
        {(region) => (
          <span class="border border-line-strong px-1.5 font-mono text-[11px] text-fg-2 uppercase">
            {region}
          </span>
        )}
      </For>
    </span>
  )
}
