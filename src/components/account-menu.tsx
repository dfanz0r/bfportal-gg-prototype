import { Link } from '@tanstack/solid-router'
import { Show } from 'solid-js'

import type { SessionUser } from '../functions/session'
import { isStaff } from '../shared/roles'
import { Avatar } from './avatar'
import { createDismiss } from './dismiss'

const menuItem =
  'block w-full px-2.5 py-2 text-left text-sm text-fg-2 hover:bg-surface-2 hover:text-fg'

/**
 * The signed-in user's picture, opening a menu with sign out, and the way
 * into moderation for moderators and admins.
 */
export function AccountMenu(props: { user: SessionUser }) {
  const dismiss = createDismiss()

  return (
    <details class="relative" ref={dismiss}>
      <summary aria-label={`Your account, ${props.user.name}`}>
        <Avatar name={props.user.name} image={props.user.image} />
      </summary>
      <div class="absolute top-11 right-0 w-56 border border-line-strong bg-surface-1 p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.6)]">
        <p class="truncate px-2.5 py-2 text-sm font-semibold">
          {props.user.name}
        </p>
        <Show when={isStaff(props.user.role)}>
          <Link to="/admin" class={menuItem}>
            Review
          </Link>
        </Show>
        <form method="post" action="/logout">
          <button type="submit" class={menuItem}>
            Sign out
          </button>
        </form>
      </div>
    </details>
  )
}
