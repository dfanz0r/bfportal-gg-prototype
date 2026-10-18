import { For, Match, Show, Switch } from 'solid-js'

import type { OwnSubmissions } from '../functions/submissions'
import { gameInfo } from '../shared/games'
import { PageLayout } from './layout/page-layout'
import { DateText } from './ui/date-text'
import { buttonGhost, fileGlyph, label, panel, statusChips, tag } from './ui/ui'

type Item = OwnSubmissions['items'][number]

/** 1st, 2nd, 3rd, 4th, 11th. */
function ordinal(n: number) {
  const tens = n % 100
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')
  return `${n}${suffix}`
}

// In a line on a phone, and three columns from a little wider.
const columns =
  'flex flex-wrap items-center gap-x-3 gap-y-1 sm:grid sm:grid-cols-[110px_120px_minmax(0,1fr)] sm:gap-x-4'

/** What last happened to it, in a line. */
function Happened(props: { item: Item; now: Date }) {
  const at = () => props.item.happened.at
  const when = () => (
    <Show when={at()}>
      {(date) => (
        <>
          {' '}
          <DateText value={date()} now={props.now} />
        </>
      )}
    </Show>
  )
  return (
    <p class="text-[13px] text-fg-3">
      <Switch>
        <Match when={props.item.happened.what === 'saved'}>
          Saved{when()}.
        </Match>
        <Match when={props.item.happened.what === 'submitted'}>
          Submitted{when()}.
          <Show when={props.item.happened.place}>
            {(place) => (
              <>
                {' '}
                {ordinal(place().at)} of {place().of} in the queue.
              </>
            )}
          </Show>
        </Match>
        <Match when={props.item.happened.what === 'reviewed'}>
          Reviewed{when()}.
        </Match>
        <Match when={props.item.happened.what === 'published'}>
          Published{when()}.
        </Match>
        <Match when={props.item.happened.what === 'delisted'}>Delisted.</Match>
        <Match when={props.item.happened.what === 'removed'}>
          Removed{when()}. It cannot be submitted again.
        </Match>
      </Switch>
    </p>
  )
}

/**
 * "Your submissions": everything the visitor has made here, most recently
 * changed first. Three things are said about each, apart: what it is now,
 * what was last sent to the moderators about it, and where that stands.
 */
export function YourSubmissions(props: { data: OwnSubmissions }) {
  const data = () => props.data
  const needing = () => data().tally.changesRequested

  return (
    <PageLayout
      title="Your submissions"
      lead="Your experiences and snippets, and the state of each. Only you can see this list."
    >
      <Show
        when={data().items.length > 0}
        fallback={
          <p class={`${panel} px-5 py-10 text-center text-fg-2`}>
            Nothing yet. What you save or submit is listed here.
          </p>
        }
      >
        <p class="mb-3 text-sm text-fg-2">
          <b class="font-semibold text-fg">{data().items.length}</b>{' '}
          {data().items.length === 1 ? 'item' : 'items'}.
          <Show when={needing() > 0}>
            {' '}
            {needing() === 1
              ? '1 has changes requested.'
              : `${needing()} have changes requested.`}
          </Show>
        </p>
        <div class={`${panel} divide-y divide-line`}>
          <div class="hidden items-center gap-4 px-4 py-2.5 lg:flex">
            <span class={`${label} w-14`} />
            <span class={`${label} min-w-0 flex-1`}>Submission</span>
            <div class={`${columns} w-[520px]`}>
              <span class={label}>Status</span>
              <span class={label}>Request</span>
              <span class={label}>Review</span>
            </div>
            <span class="w-[72px]" />
          </div>
          <For each={data().items}>
            {(item) => (
              <article class="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
                <Show
                  when={item.image}
                  fallback={
                    <span class={`${fileGlyph} h-10 w-14`} aria-hidden="true">
                      {item.kind === 'snippet' ? 'TS' : ''}
                    </span>
                  }
                >
                  {(image) => (
                    <img
                      src={image()}
                      alt=""
                      loading="lazy"
                      referrerpolicy="no-referrer"
                      class="h-10 w-14 shrink-0 border border-line object-cover"
                    />
                  )}
                </Show>
                <div class="min-w-0 flex-1 basis-56">
                  <a
                    href={item.href}
                    class="block truncate text-[15px] font-semibold hover:text-steel-hi"
                  >
                    {item.title}
                  </a>
                  <p class="text-[13px] text-fg-3">
                    {item.kind === 'snippet' ? 'Snippet' : 'Experience'}.{' '}
                    {gameInfo(item.game).name}
                  </p>
                </div>
                <div class={`${columns} w-full lg:w-[520px]`}>
                  <span>
                    <span class={`${tag} ${statusChips[item.listing]}`}>
                      {item.listing}
                    </span>
                  </span>
                  <span class="text-sm text-fg-2 max-sm:empty:hidden">
                    {item.request ?? ''}
                  </span>
                  <div class="min-w-0">
                    <Show when={item.review}>
                      {(review) => (
                        <span class={`${tag} ${statusChips[review()]}`}>
                          {review()}
                        </span>
                      )}
                    </Show>
                    <Happened item={item} now={data().now} />
                  </div>
                </div>
                <span class="w-[72px] max-lg:ml-auto">
                  <Show when={item.editHref}>
                    {(href) => (
                      <a
                        href={href()}
                        class={`${buttonGhost} h-[34px] px-3.5 ${item.review === 'Changes requested' ? 'border-warn/60 text-warn' : ''}`}
                      >
                        Edit
                      </a>
                    )}
                  </Show>
                </span>
              </article>
            )}
          </For>
        </div>
      </Show>
    </PageLayout>
  )
}
