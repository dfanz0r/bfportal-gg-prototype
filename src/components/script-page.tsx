import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Script } from '../functions/scripts'
import { CopyText } from './copy-text'
import { DateText } from './date-text'
import { Fact } from './fact'
import { Facts } from './facts'
import { Icon } from './icon'
import { PageLayout } from './page-layout'
import { PersonLink } from './person-link'
import { RepoLink } from './repo-link'
import { Section } from './section'
import { buttonGhost, panel } from './ui'
import { UpdatePost } from './update-post'

/** The head of a script's page, for search engines and link previews. */
export function scriptHead(data: Script | undefined) {
  if (!data) return {}
  return {
    meta: [
      { title: `${data.title} · bfportal.gg` },
      { name: 'description', content: data.summary },
      { property: 'og:title', content: data.title },
      { property: 'og:description', content: data.summary },
      { property: 'og:type', content: 'article' },
    ],
  }
}

/** A script's own page: its code, what it does and what has changed. */
export function ScriptPage(props: { data: Script }) {
  const data = () => props.data

  return (
    <PageLayout
      title={data().title}
      lead={data().summary}
      actions={
        <Link to="/scripts" class={buttonGhost}>
          All scripts
        </Link>
      }
    >
      <div class="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10">
        <div class="min-w-0">
          <div class={panel}>
            <p class="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 font-mono text-xs text-fg-3">
              <span>Script.ts, {data().lines} lines</span>
              <CopyText text={data().script} label="Copy script" />
            </p>
            {/* The script as text. Nothing here runs it. */}
            <pre class="max-h-[560px] overflow-auto p-4 font-mono text-[13px] leading-[1.6] text-fg-2">
              <code>{data().script}</code>
            </pre>
          </div>

          <Show when={data().descriptionHtml}>
            <Section title="About">
              {/* Rendered and sanitized from Markdown when it was saved. */}
              <div class="prose" innerHTML={data().descriptionHtml} />
            </Section>
          </Show>

          <Show when={data().updates.length > 0}>
            <Section id="updates" title="Updates">
              <For each={data().updates}>
                {(update) => <UpdatePost update={update} now={data().now} />}
              </For>
            </Section>
          </Show>
        </div>

        <aside class="grid gap-4">
          <Facts>
            <Show when={data().owner}>
              {(owner) => (
                <Fact name="By">
                  <PersonLink person={owner()} />
                </Fact>
              )}
            </Show>
            <Show when={data().category}>
              {(category) => <Fact name="Category">{category()}</Fact>}
            </Show>
            <Fact name="Likes">
              <span class="inline-flex items-center gap-1.5">
                <Icon name="heart" class="size-3.5" />
                {data().likes}
              </span>
            </Fact>
            <Show when={data().sdk}>
              {(sdk) => (
                <Fact name="SDK">
                  <span>
                    {sdk().version}
                    <span class="block text-xs font-normal text-fg-3">
                      {sdk().season}
                    </span>
                  </span>
                </Fact>
              )}
            </Show>
            <Show when={data().publishedAt}>
              {(published) => (
                <Fact name="Published">
                  <DateText value={published()} />
                </Fact>
              )}
            </Show>
          </Facts>
          <Show when={data().repoUrl}>{(url) => <RepoLink url={url()} />}</Show>
        </aside>
      </div>
    </PageLayout>
  )
}
