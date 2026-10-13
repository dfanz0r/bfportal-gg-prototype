import { type JSX, Show } from 'solid-js'

/** The band at the top of every page except the home page. */
export function PageHead(props: {
  title: string
  lead?: string
  actions?: JSX.Element
}) {
  return (
    <section class="dot-grid border-b border-line bg-surface-1">
      <div class="wrap flex flex-wrap items-end justify-between gap-x-8 gap-y-4 py-6">
        <div>
          <h1 class="font-display text-[clamp(34px,3.4vw,46px)] leading-[0.96] font-extrabold tracking-[0.005em] text-steel-hi uppercase">
            {props.title}
          </h1>
          <Show when={props.lead}>
            <p class="mt-2.5 max-w-[44em] text-[15.5px] text-fg-2">
              {props.lead}
            </p>
          </Show>
        </div>
        <Show when={props.actions}>
          <div class="flex flex-wrap items-center gap-2">{props.actions}</div>
        </Show>
      </div>
    </section>
  )
}
