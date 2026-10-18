import { Link, useLocation } from '@tanstack/solid-router'
import { For, type JSX, Show } from 'solid-js'

import type { AdminMenu } from '../../functions/moderation'
import { type AdminEntry, adminMenu } from '../../shared/admin-menu'
import { isAdmin } from '../../shared/roles'
import { label } from '../ui/ui'

const entryClass =
  'flex h-9 items-center gap-2 border border-line px-3 text-[13.5px] whitespace-nowrap lg:border-0 lg:border-l-2 lg:border-transparent lg:px-2.5'

/**
 * What an entry says beside its name: a count, that it is not built yet, or
 * that it is for admins.
 */
function Note(props: { entry: AdminEntry; menu: AdminMenu }) {
  const note = 'ml-auto text-[11px] text-fg-3'
  return (
    <Show when={props.entry.to} fallback={<span class={note}>Later</span>}>
      <Show when={props.entry.count}>
        {(count) => (
          <Show when={props.menu.counts[count()] > 0}>
            <span class="ml-auto bg-accent px-1.5 font-mono text-[11px] leading-[18px] text-accent-ink">
              {props.menu.counts[count()]}
            </span>
          </Show>
        )}
      </Show>
      <Show when={props.entry.adminsOnly}>
        <span class={note}>Admins</span>
      </Show>
    </Show>
  )
}

/**
 * The admin's frame: its menu beside each screen, or above it on a narrow
 * window. A moderator sees the admins' entries, marked, without links; a
 * screen not built yet is listed without one too, and only on a wide window.
 */
export function AdminShell(props: { menu: AdminMenu; children: JSX.Element }) {
  const location = useLocation()
  const current = (entry: AdminEntry) => {
    const path = location().pathname
    return (
      path === entry.to ||
      (entry.to !== '/admin' && path.startsWith(`${entry.to}/`)) ||
      (entry.also ?? []).some((prefix) => path.startsWith(prefix))
    )
  }
  const open = (entry: AdminEntry) =>
    entry.to !== undefined && (!entry.adminsOnly || isAdmin(props.menu.role))

  return (
    <main
      id="content"
      class="wrap py-6 lg:grid lg:grid-cols-[204px_minmax(0,1fr)] lg:gap-9 lg:py-8"
    >
      <nav aria-label="Admin" class="mb-6 lg:mb-0">
        <ul class="flex gap-2 overflow-x-auto pb-1 lg:block lg:overflow-visible lg:pb-0">
          <For each={adminMenu}>
            {(group) => (
              <>
                <li
                  class={`${label} mt-5 mb-2 px-2.5 first:mt-1 max-lg:hidden`}
                >
                  {group.group}
                </li>
                <For each={group.entries}>
                  {(entry) => (
                    <li class={open(entry) ? '' : 'max-lg:hidden'}>
                      <Show
                        when={open(entry) && entry.to}
                        fallback={
                          <span class={`${entryClass} text-fg-3`}>
                            {entry.label}
                            <Note entry={entry} menu={props.menu} />
                          </span>
                        }
                      >
                        {(to) => (
                          <Link
                            to={to()}
                            data-current={current(entry) ? '' : undefined}
                            aria-current={current(entry) ? 'page' : undefined}
                            activeOptions={{ exact: true }}
                            class={`${entryClass} text-fg-2 hover:text-fg data-current:border-l-2 data-current:border-l-accent data-current:bg-surface-2 data-current:text-fg`}
                          >
                            {entry.label}
                            <Note entry={entry} menu={props.menu} />
                          </Link>
                        )}
                      </Show>
                    </li>
                  )}
                </For>
              </>
            )}
          </For>
        </ul>
      </nav>
      <div class="min-w-0">{props.children}</div>
    </main>
  )
}
