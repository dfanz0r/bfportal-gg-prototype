import { createSignal, For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'

import { type MediaProblem, mediaOf } from '../../shared/media'
import { ImagePreview } from '../forms/image-preview'
import { createHydrated } from '../ui/hydrated'
import { Icon } from '../ui/icon'
import { buttonGhost, field, iconButton, panel } from '../ui/ui'

type Row = { id: number; start: string }

const problems: Partial<Record<MediaProblem, string>> = {
  'not-a-video': 'Not a video',
  'video-site': 'YouTube only',
}

/** The picture at a link, or the video's thumbnail, or what is wrong. */
function MediaPreview(props: { link: string }) {
  const media = () => mediaOf(props.link)
  const shown = () => {
    const now = media()
    return now.kind === 'video' ? now.thumbnail : props.link
  }
  const problem = () => {
    const now = media()
    return now.kind === 'none' ? problems[now.problem] : undefined
  }
  return (
    <ImagePreview
      src={shown()}
      play={media().kind === 'video'}
      problem={problem()}
    />
  )
}

/**
 * A gallery's pictures and videos: a row for each link, with what it shows
 * beside it, in the order they are shown, and a button that adds a row, up to
 * `max`. Each row sends one `name`; the server drops empty ones.
 *
 * Adding, moving and removing a row is the script's. With no script the list
 * starts with one empty row, to fill each time the form is sent.
 */
export function MediaListInput(props: {
  /** Also the first row's id, for the field's label. */
  name: string
  links: string[]
  max: number
}) {
  const hydrated = createHydrated()
  let next = 0
  const [now, setNow] = createStore<Record<number, string>>({})
  const rowOf = (url: string): Row => {
    const row = { id: next++, start: url }
    setNow(row.id, url)
    return row
  }
  const filled = (row: Row) => (now[row.id] ?? '').trim() !== ''
  const first = props.links.slice(0, props.max).map(rowOf)
  const [rows, setRows] = createSignal(
    first.length < props.max ? [...first, rowOf('')] : first,
  )
  const count = () => rows().filter(filled).length
  /** The one row there is, still empty: nothing to move or take away. */
  const alone = () => rows().length === 1 && !filled(rows()[0])

  let list: HTMLDivElement | undefined
  const inputs = new Map<number, HTMLInputElement>()
  // The form reads its fields as they are typed in. A row moved or taken
  // away changes them too.
  const changed = () =>
    queueMicrotask(() =>
      list?.dispatchEvent(new Event('input', { bubbles: true })),
    )
  /** A new row to type in, or the empty one already at the end. */
  const add = () => {
    const last = rows().at(-1)
    const target = last && !filled(last) ? last : rowOf('')
    if (target !== last) setRows((list) => [...list, target])
    inputs.get(target.id)?.focus()
  }
  const remove = (id: number) => {
    inputs.delete(id)
    setRows((list) => {
      const left = list.filter((row) => row.id !== id)
      return left.length > 0 ? left : [rowOf('')]
    })
    changed()
  }
  const move = (index: number, by: number) => {
    setRows((list) => {
      const moved = [...list]
      ;[moved[index], moved[index + by]] = [moved[index + by], moved[index]]
      return moved
    })
    changed()
  }

  return (
    <div ref={list} class="grid gap-2">
      <For each={rows()}>
        {(row, index) => (
          <div
            class={`${panel} grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-2 sm:grid-cols-[112px_minmax(0,1fr)_auto]`}
          >
            <MediaPreview link={now[row.id] ?? ''} />
            <input
              id={index() === 0 ? props.name : undefined}
              name={props.name}
              type="url"
              value={row.start}
              placeholder="https://..."
              aria-label={`Link ${index() + 1}`}
              ref={(input) => inputs.set(row.id, input)}
              onInput={(event) => setNow(row.id, event.currentTarget.value)}
              class={field}
            />
            <Show when={hydrated() && !alone()}>
              <div class="flex gap-1 max-sm:col-span-2 max-sm:justify-end">
                <button
                  type="button"
                  aria-label={`Move link ${index() + 1} up`}
                  disabled={index() === 0}
                  onClick={() => move(index(), -1)}
                  class={`${iconButton} disabled:pointer-events-none disabled:opacity-35`}
                >
                  <Icon name="chevron-up" />
                </button>
                <button
                  type="button"
                  aria-label={`Move link ${index() + 1} down`}
                  disabled={index() === rows().length - 1}
                  onClick={() => move(index(), 1)}
                  class={`${iconButton} disabled:pointer-events-none disabled:opacity-35`}
                >
                  <Icon name="chevron-down" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove link ${index() + 1}`}
                  onClick={() => remove(row.id)}
                  class={iconButton}
                >
                  <Icon name="x" />
                </button>
              </div>
            </Show>
          </div>
        )}
      </For>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <Show when={hydrated() && rows().length < props.max}>
          <button type="button" onClick={add} class={buttonGhost}>
            <Icon name="plus" />
            Add a link
          </button>
        </Show>
        <p class="text-[13px] text-fg-3">
          {count()} of {props.max}
        </p>
      </div>
    </div>
  )
}
