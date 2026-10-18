import { For, type JSX } from 'solid-js'

/** A cell of a `DataTable` row. */
export const cell = 'border-b border-line px-3 py-2.5 align-middle'

/**
 * A table of rows, as the admin lists them: column names over the rows, and
 * scrolled sideways on a window too narrow for it. Each row is a `<tr>` of
 * `<td class={cell}>`.
 */
export function DataTable(props: {
  label: string
  columns: { name: string; numeric?: boolean; hidden?: boolean }[]
  /** Below this width, in pixels, the table scrolls instead of squeezing. */
  minWidth: number
  children: JSX.Element
}) {
  return (
    // Relative, so a hidden column name, placed absolutely, scrolls with
    // the table and does not widen the page.
    <div class="relative overflow-x-auto">
      <table
        aria-label={props.label}
        class="w-full border-collapse text-[14px]"
        style={{ 'min-width': `${props.minWidth}px` }}
      >
        <thead>
          <tr>
            <For each={props.columns}>
              {(column) => (
                <th
                  scope="col"
                  class={`border-b border-line-strong px-3 py-2.5 text-[13px] font-normal whitespace-nowrap text-fg-3 ${column.numeric ? 'text-right' : 'text-left'}`}
                >
                  <span class={column.hidden ? 'sr-only' : undefined}>
                    {column.name}
                  </span>
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  )
}
