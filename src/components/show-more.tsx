import { type JSX, Show } from 'solid-js'

/**
 * "Showing 12 of 40", and the link to a longer page when there is more. A
 * listing only grows so far: past `lastPage` it says to narrow the search,
 * because a link to a page the address will not accept goes back to the start.
 */
export function ShowMore(props: {
  shown: number
  total: number
  page: number
  lastPage: number
  children: JSX.Element
}) {
  return (
    <div class="flex flex-col items-center gap-3 pt-9 text-[13.5px] text-fg-3">
      <span>
        Showing {props.shown} of {props.total}
      </span>
      <Show when={props.shown < props.total}>
        <Show
          when={props.page < props.lastPage}
          fallback={<span>Narrow the search to see the rest.</span>}
        >
          {props.children}
        </Show>
      </Show>
    </div>
  )
}
