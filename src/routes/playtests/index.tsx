import { createFileRoute, Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'
import { PageLayout } from '../../components/page-layout'
import { PlaytestCard } from '../../components/playtest-card'
import { Section } from '../../components/section'
import { body, buttonGhost } from '../../components/ui'
import { fetchPlaytests } from '../../functions/playtests'
import { links } from '../../shared/links'

const LEAD =
  'Try something before it ships and tell its creator what you found. Play it whenever suits you; the feedback goes in its Discord thread.'

export const Route = createFileRoute('/playtests/')({
  loader: () => fetchPlaytests(),
  head: () => ({
    meta: [
      { title: 'Playtests · bfportal.gg' },
      { name: 'description', content: LEAD },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()

  return (
    <PageLayout
      title="Playtests"
      lead={LEAD}
      actions={
        <Link to="/events" class={buttonGhost}>
          Events
        </Link>
      }
    >
      <Show
        when={data().open.items.length > 0}
        fallback={
          <p class="border border-line bg-surface-1 px-5 py-10 text-center text-fg-2">
            No playtests are open right now.
          </p>
        }
      >
        <div class="grid gap-4 lg:grid-cols-3">
          <For each={data().open.items}>
            {(playtest) => <PlaytestCard playtest={playtest} />}
          </For>
        </div>
      </Show>

      <Section title="How it works">
        <ol class={`${body} grid list-decimal gap-1.5 pl-5 marker:text-fg-3`}>
          <li>
            A creator posts a brief: what it is, what to try, what to report.
          </li>
          <li>
            Testers in the chosen regions are pinged in Discord, and it shows up
            here.
          </li>
          <li>You play it with the code, whenever suits you.</li>
          <li>
            You report back in the playtest's Discord thread. The creator closes
            it and posts what changed.
          </li>
        </ol>
        <p class={`${body} mt-4`}>
          To be pinged for new ones, take the Tester role for your region in the{' '}
          <a href={links.discord} class="text-steel-hi underline">
            Discord server
          </a>
          .
        </p>
      </Section>

      <Show when={data().closed.items.length > 0}>
        <Section title="Recently closed">
          <div class="grid gap-4 lg:grid-cols-3">
            <For each={data().closed.items}>
              {(playtest) => <PlaytestCard playtest={playtest} />}
            </For>
          </div>
        </Section>
      </Show>
    </PageLayout>
  )
}
