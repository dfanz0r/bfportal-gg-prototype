import type { SessionUser } from '../functions/session'
import { Avatar } from './avatar'
import { createDismiss } from './dismiss'

/** The signed-in user's picture, opening a menu with sign out. */
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
        <form method="post" action="/logout">
          <button
            type="submit"
            class="w-full px-2.5 py-2 text-left text-sm text-fg-2 hover:bg-surface-2 hover:text-fg"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  )
}
