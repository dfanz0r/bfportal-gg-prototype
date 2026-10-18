import { children, For, type JSX, Show } from 'solid-js'

import { body, headline } from '../ui/ui'

/** One step of the trail above a page's title. The last has no address. */
export type Crumb = { label: string; href?: string }

/** The band at the top of every page except the home page. */
export function PageHead(props: {
  title: string
  lead?: string
  /** Where the page sits: "Scripts / AI". */
  crumbs?: Crumb[]
  /** A line of facts under the title, such as who made it and when. */
  meta?: JSX.Element
  actions?: JSX.Element
  /** In a frame of its own, as the admin's screens are: no band, no column. */
  bare?: boolean
}) {
  // Read once. Each read of a prop that holds markup builds that markup
  // again, and asking "is there any?" and then drawing it is two reads: the
  // server writes the second copy and the browser looks for the first, which
  // fails the whole page as a hydration mismatch.
  const actions = children(() => props.actions)
  const meta = children(() => props.meta)
  return (
    <section
      class={props.bare ? 'mb-5' : 'dot-grid border-b border-line bg-surface-1'}
    >
      <div class={props.bare ? undefined : 'wrap py-6'}>
        <Show when={props.crumbs?.length}>
          <nav
            class="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-fg-2"
            aria-label="Breadcrumb"
          >
            <For each={props.crumbs}>
              {(crumb, index) => (
                <>
                  <Show when={index() > 0}>
                    <span class="text-line-strong" aria-hidden="true">
                      /
                    </span>
                  </Show>
                  <Show
                    when={crumb.href}
                    fallback={<span class="text-fg-3">{crumb.label}</span>}
                  >
                    {(href) => (
                      <a href={href()} class="hover:text-accent">
                        {crumb.label}
                      </a>
                    )}
                  </Show>
                </>
              )}
            </For>
          </nav>
        </Show>
        <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div class="min-w-0">
            <h1 class={headline}>{props.title}</h1>
            <Show when={props.lead}>
              <p class={`${body} mt-2.5`}>{props.lead}</p>
            </Show>
            <Show when={meta()}>
              <p class="mt-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13.5px] text-fg-2">
                {meta()}
              </p>
            </Show>
          </div>
          <Show when={actions()}>
            <div class="flex flex-wrap items-center gap-2">{actions()}</div>
          </Show>
        </div>
      </div>
    </section>
  )
}
