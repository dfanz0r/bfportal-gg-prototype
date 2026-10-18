import { For, Show } from 'solid-js'

import { decideOnSnippet } from '../functions/moderation'
import type { Snippet } from '../functions/snippets'
import type { DecisionSearch } from '../shared/decision'
import { Byline } from './byline'
import { CodeView } from './code-view'
import { ContentManage } from './content-manage'
import { CopyText } from './copy-text'
import { DateText } from './date-text'
import { DecisionForm } from './decision-form'
import { Fact } from './fact'
import { Facts } from './facts'
import { Icon } from './icon'
import { LikeButton } from './like-button'
import { PageLayout } from './page-layout'
import { RepoLink } from './repo-link'
import { Section } from './section'
import { StatusNote } from './status-note'
import { buttonAccent, buttonGhost, panel } from './ui'
import { UpdatePost } from './update-post'

/** The head of a snippet's page, for search engines and link previews. */
export function snippetHead(data: Snippet | undefined) {
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

/** A snippet's own page: its code, what it does and what has changed. */
export function SnippetPage(props: {
  data: Snippet
  /** What a decision posted with no script and refused brought back. */
  decision: DecisionSearch
}) {
  const data = () => props.data

  return (
    <PageLayout
      title={data().title}
      crumbs={[
        { label: 'Snippets', href: '/snippets' },
        ...(data().category ? [{ label: data().category ?? '' }] : []),
      ]}
      actions={
        <>
          <Show when={data().viewer.canEdit}>
            <a
              href={`/snippets/${data().slug}/edit`}
              class={`${buttonGhost} h-[38px] px-3.5`}
            >
              <Icon name="pencil" class="size-4" />
              Edit
            </a>
          </Show>
          {/* Nothing can be liked until it is published; the server refuses
              it. */}
          <Show when={data().status === 'published'}>
            <LikeButton
              kind="snippet"
              slug={data().slug}
              likes={data().likes}
              liked={data().viewer.liked}
              signedIn={data().viewer.signedIn}
            />
          </Show>
        </>
      }
      meta={
        <>
          <Byline person={data().owner} class="text-[13.5px]" />
          <Show when={data().publishedAt}>
            {(published) => (
              <span>
                Published <DateText value={published()} />
              </span>
            )}
          </Show>
        </>
      }
    >
      <StatusNote
        status={data().status}
        note={data().reviewNote}
        edit={
          data().viewer.canEdit ? `/snippets/${data().slug}/edit` : undefined
        }
      />
      <Show when={data().viewer.editWaiting}>
        <p class="mb-6 border-l-2 border-steel bg-steel/8 px-4 py-3 text-sm text-fg-2">
          <b class="font-semibold text-fg">Your changes are waiting.</b> This
          page stays as it is until a moderator approves them.
        </p>
      </Show>
      <div class="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10">
        <div class="min-w-0">
          <div class={panel}>
            <p class="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 font-mono text-xs text-fg-3">
              <span>TypeScript, {data().lines} lines</span>
              <CopyText text={data().script} label="Copy" />
            </p>
            <CodeView
              text={data().script}
              language="typescript"
              class="max-h-[560px]"
            />
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

          {/* For its owner and the moderators, under the page as on an
              experience's. */}
          <div class="mt-10 max-w-xl">
            <ContentManage
              kind="snippet"
              slug={data().slug}
              status={data().status}
              isOwner={data().viewer.isOwner}
              isStaff={data().viewer.isStaff}
            />
          </div>
        </div>

        <aside class="grid gap-4">
          {/* This page is what a moderator reviews, so the decision is made
              here. The service refuses anyone who is not one. */}
          <Show when={data().viewer.isStaff && data().status === 'pending'}>
            <DecisionForm
              decide={decideOnSnippet}
              id={data().id}
              version={data().version}
              back={`/snippets/${data().slug}`}
              problem={props.decision.problem}
              note={props.decision.note}
              hint="Approving publishes the page. Requesting changes needs a note."
            />
          </Show>
          {/* What most visitors came for. */}
          <div class={`${panel} grid gap-2.5 p-5`}>
            <CopyText
              text={data().script}
              label="Copy snippet"
              class={buttonAccent}
            />
            <p class="text-[13px] text-fg-3">
              Paste it into your own script in the Portal editor.
            </p>
          </div>
          <Facts>
            <Show when={data().category}>
              {(category) => <Fact name="Category">{category()}</Fact>}
            </Show>
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
