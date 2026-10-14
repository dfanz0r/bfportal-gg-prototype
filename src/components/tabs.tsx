import { For, Show } from 'solid-js'

/**
 * Tabs in the display face: the parts of one area, each at its own address.
 * Playtests and community events, for one.
 */
export function Tabs(props: {
  label: string
  items: { name: string; href: string; count?: number; current?: boolean }[]
}) {
  return (
    <nav
      class="flex flex-wrap gap-x-[18px] gap-y-1 border-b border-line sm:gap-x-[26px]"
      aria-label={props.label}
    >
      <For each={props.items}>
        {(item) => (
          <a
            href={item.href}
            aria-current={item.current ? 'true' : undefined}
            class="-mb-px flex items-baseline gap-2 border-b-2 border-transparent pb-3 font-display text-[21px] leading-none font-bold tracking-[0.02em] text-fg-3 uppercase hover:text-fg aria-[current=true]:border-accent aria-[current=true]:text-steel-hi sm:text-2xl"
          >
            {item.name}
            <Show when={item.count !== undefined}>
              <span class="font-mono text-[11.5px] font-normal tracking-normal text-fg-3">
                {item.count}
              </span>
            </Show>
          </a>
        )}
      </For>
    </nav>
  )
}
