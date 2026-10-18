import { For, Show } from 'solid-js'

import { links } from '../../shared/links'
import { Icon } from '../ui/icon'
import { body, buttonSteel, display } from '../ui/ui'
import { PageLayout } from './page-layout'

/** A section of the site that has a place in the navigation but no pages yet. */
export function SectionPlaceholder(props: {
  title: string
  lead: string
  planned?: string[]
}) {
  return (
    <PageLayout title={props.title} lead={props.lead}>
      <h2 class={`${display} text-3xl leading-none`}>
        This section is not open yet
      </h2>
      <Show when={props.planned}>
        {(planned) => (
          <>
            <p class={`${body} mt-4`}>
              It is on the way. What we are planning for it:
            </p>
            <ul
              class={`${body} mt-3 grid list-[square] gap-1.5 pl-5 marker:text-accent`}
            >
              <For each={planned()}>{(item) => <li>{item}</li>}</For>
            </ul>
          </>
        )}
      </Show>
      <p class={`${body} mt-4`}>
        Tell us what you would use it for, and we will build that first.
      </p>
      <a href={links.discord} class={`${buttonSteel} mt-6`}>
        <Icon name="discord" />
        Talk to us on Discord
      </a>
    </PageLayout>
  )
}
