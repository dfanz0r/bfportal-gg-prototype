import { For, Show } from 'solid-js'

import { links } from '../shared/links'
import { Icon } from './icon'
import { PageHead } from './page-head'
import { buttonSteel, display } from './ui'

/** A section of the site that has a place in the navigation but no pages yet. */
export function SectionPlaceholder(props: {
  title: string
  lead: string
  planned?: string[]
}) {
  return (
    <main id="content">
      <PageHead title={props.title} lead={props.lead} />
      <div class="wrap py-8">
        <h2 class={`${display} text-3xl leading-none`}>
          This section is not open yet
        </h2>
        <Show when={props.planned}>
          {(planned) => (
            <>
              <p class="mt-4 text-[15.5px] text-fg-2">
                It is on the way. What we are planning for it:
              </p>
              <ul class="mt-3 grid max-w-[46em] list-[square] gap-1.5 pl-5 text-[15.5px] text-fg-2 marker:text-accent">
                <For each={planned()}>{(item) => <li>{item}</li>}</For>
              </ul>
            </>
          )}
        </Show>
        <p class="mt-4 max-w-[46em] text-[15.5px] text-fg-2">
          Tell us what you would use it for, and we will build that first.
        </p>
        <a href={links.discord} class={`${buttonSteel} mt-6`}>
          <Icon name="discord" />
          Talk to us on Discord
        </a>
      </div>
    </main>
  )
}
