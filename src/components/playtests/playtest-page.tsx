import { Show } from 'solid-js'

import type { Playtest } from '../../functions/playtests'
import { gameInfo } from '../../shared/games'
import { PageLayout } from '../layout/page-layout'
import { Byline } from '../ui/byline'
import { CopyCode } from '../ui/copy-code'
import { DateText } from '../ui/date-text'
import { Fact } from '../ui/fact'
import { Facts } from '../ui/facts'
import { Icon } from '../ui/icon'
import { PersonLink } from '../ui/person-link'
import { buttonGhost, buttonSteel, label, panel } from '../ui/ui'
import { Regions } from './regions'

/** The head of a playtest's page. */
export function playtestHead(data: Playtest | undefined) {
  if (!data) return {}
  return {
    meta: [
      { title: `Playtest: ${data.name} · bfportal.gg` },
      { name: 'description', content: data.summary },
    ],
  }
}

/** One playtest: the brief, the code, and where to report back. */
export function PlaytestPage(props: { data: Playtest }) {
  const data = () => props.data

  return (
    <PageLayout
      title={`Playtest: ${data().name}`}
      lead={data().summary}
      crumbs={[
        { label: 'Events', href: '/events' },
        { label: 'Playtests', href: '/playtests' },
      ]}
      meta={
        <>
          <Byline person={data().host} class="text-[13.5px]" />
          <span>
            Opened <DateText value={data().opensAt} now={data().now} />
          </span>
          <Regions regions={data().regions} />
        </>
      }
    >
      <div
        class="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10"
        data-game={data().game}
      >
        <div class="min-w-0">
          <Show when={!data().open}>
            <p class="mb-6 border-l-2 border-warn bg-warn/8 px-4 py-3 text-sm text-fg-2">
              <b class="font-semibold text-fg">This playtest has closed.</b>
              <Show when={data().resultTitle}>
                {(title) => <> What changed: “{title()}”.</>}
              </Show>
            </p>
          </Show>
          {/* Rendered and sanitized from Markdown when it was saved. */}
          <div class="prose" innerHTML={data().briefHtml} />
        </div>

        <aside class="grid gap-4 max-[1099px]:order-first">
          <div class={`${panel} grid gap-3 p-5`}>
            <span class={label}>Experience code</span>
            <p class="font-mono text-[40px] leading-none font-semibold tracking-[0.14em] uppercase">
              {data().code}
            </p>
            <CopyCode code={data().code} label="Copy code" />
            <Show when={data().discordUrl}>
              {(url) => (
                <a href={url()} class={buttonSteel} rel="noopener">
                  <Icon name="discord" />
                  Report in the Discord thread
                </a>
              )}
            </Show>
            <Show when={data().experienceSlug}>
              {(slug) => (
                <a href={`/experiences/${slug()}`} class={buttonGhost}>
                  The experience's page
                </a>
              )}
            </Show>
          </div>

          <Facts>
            <Fact name="Game">{gameInfo(data().game).name}</Fact>
            <Fact name="Testers">
              <Regions regions={data().regions} />
            </Fact>
            <Fact name="Opened">
              <DateText value={data().opensAt} now={data().now} />
            </Fact>
            <Show when={data().closesAt}>
              {(closes) => (
                <Fact name={data().open ? 'Open until' : 'Closed'}>
                  <DateText value={closes()} />
                </Fact>
              )}
            </Show>
            <Show when={data().host}>
              {(host) => (
                <Fact name="Host">
                  <PersonLink person={host()} />
                </Fact>
              )}
            </Show>
          </Facts>
        </aside>
      </div>
    </PageLayout>
  )
}
