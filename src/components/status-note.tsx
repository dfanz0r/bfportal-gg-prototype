import { Show } from 'solid-js'

import { type ContentStatus, contentStatusLabels } from '../shared/content'

/** What each status means, to the owner looking at a page that is not live. */
const STATUS_NOTES: Record<ContentStatus, string> = {
  draft: 'Not submitted yet.',
  pending: 'Waiting for a moderator.',
  changes_requested: 'Changes are needed before this can be published.',
  published: '',
  unpublished: 'Taken off the listings by a moderator.',
  removed: 'Removed by a moderator. It cannot be submitted again.',
}

/**
 * The note at the top of an experience's or a script's own page while it is
 * not public: its status, and what a moderator wrote about it. Only its owner
 * and the moderators get as far as seeing it. Nothing when it is published.
 */
export function StatusNote(props: {
  status: ContentStatus
  note: string | null
}) {
  return (
    <Show when={props.status !== 'published'}>
      <div class="mb-6 grid gap-1 border-l-2 border-steel bg-steel/8 px-4 py-3 text-sm text-fg-2">
        <p>
          <b class="font-semibold text-fg">
            {contentStatusLabels[props.status]}.
          </b>{' '}
          {STATUS_NOTES[props.status]} Only its owner and the moderators can see
          this page.
        </p>
        {/* Headed by what it is, never by who wrote it. */}
        <Show when={props.note}>
          {(note) => <p>Moderator note: {note()}</p>}
        </Show>
      </div>
    </Show>
  )
}
