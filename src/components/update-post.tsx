import { Show } from 'solid-js'

import { Byline } from './byline'
import { DateText } from './date-text'
import { display } from './ui'

/**
 * An update post in full, on its project's own page: the date in a column,
 * then the title, what was written and who wrote it.
 */
export function UpdatePost(props: {
  update: {
    title: string
    bodyHtml: string
    publishedAt: Date | null
    author: { name: string; image: string | null; discordId: string } | null
  }
  now: Date
}) {
  return (
    <article class="grid gap-1 border-t border-line py-5 first:border-t-0 first:pt-0 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-5">
      <p class="pt-1 font-mono text-xs text-fg-3">
        <Show when={props.update.publishedAt}>
          {(published) => <DateText value={published()} now={props.now} />}
        </Show>
      </p>
      <div>
        <h3 class={`${display} text-[25px] leading-[1.05] tracking-[0.015em]`}>
          {props.update.title}
        </h3>
        {/* Rendered and sanitized from Markdown when it was saved. */}
        <div class="prose mt-2" innerHTML={props.update.bodyHtml} />
        <Byline person={props.update.author} class="mt-3" />
      </div>
    </article>
  )
}
