import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { SessionUser } from '../functions/session'
import { links } from '../shared/links'
import { Icon } from './icon'
import { buttonAccent, buttonGhost, iconButton } from './ui'

const NAV = [
  { to: '/scripts', label: 'Scripts' },
  { to: '/maps', label: 'Maps' },
  { to: '/tools', label: 'Tools & Plugins' },
  { to: '/guides', label: 'Guides & Docs' },
  { to: '/library', label: 'Library' },
  { to: '/updates', label: 'Updates' },
  { to: '/events', label: 'Events' },
  { to: '/forum', label: 'Forum' },
] as const

// The bar under the current section is drawn on the header's bottom border.
const navLink =
  "relative flex items-center px-2.5 text-[13px] font-semibold tracking-[0.09em] whitespace-nowrap text-fg-2 uppercase transition-colors hover:text-fg data-[status=active]:text-fg data-[status=active]:after:absolute data-[status=active]:after:inset-x-2.5 data-[status=active]:after:-bottom-px data-[status=active]:after:h-0.5 data-[status=active]:after:bg-accent data-[status=active]:after:content-['']"

function initials(name: string) {
  return (
    name
      .replace(/[^\p{L}]/gu, '')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

function AccountMenu(props: { user: SessionUser }) {
  return (
    <details class="relative">
      <summary
        class="grid size-9 place-items-center overflow-hidden bg-steel font-mono text-xs font-semibold text-steel-ink"
        aria-label={`Your account, ${props.user.name}`}
      >
        <Show when={props.user.image} fallback={initials(props.user.name)}>
          {(image) => (
            <img src={image()} alt="" class="size-full object-cover" />
          )}
        </Show>
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

export function SiteHeader(props: { user: SessionUser | null }) {
  return (
    <header class="sticky top-0 z-50 h-[60px] border-b border-line bg-base/90 backdrop-blur-md">
      <div class="wrap flex h-full items-center gap-5 xl:gap-9">
        <Link to="/" class="shrink-0" aria-label="bfportal.gg home">
          <img
            src="/logo.svg"
            alt=""
            width="148"
            height="28"
            class="w-32 sm:w-[148px]"
          />
        </Link>

        <nav class="flex self-stretch max-[1099px]:hidden" aria-label="Main">
          <For each={NAV}>
            {(item) => (
              <Link to={item.to} class={navLink}>
                {item.label}
              </Link>
            )}
          </For>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <Link
            to="/library"
            class={iconButton}
            aria-label="Search the library"
          >
            <Icon name="search" />
          </Link>
          <a
            href={links.discord}
            class={`${iconButton} max-sm:hidden`}
            aria-label="Join the Discord"
          >
            <Icon name="discord" />
          </a>
          <Show
            when={props.user}
            fallback={
              <a href="/login" class={`${buttonGhost} h-9 px-3.5`}>
                Sign in
              </a>
            }
          >
            {(user) => (
              <>
                <Link
                  to="/submit"
                  class={`${buttonAccent} h-9 max-sm:w-9 max-sm:px-0`}
                  aria-label="Submit an experience"
                >
                  <Icon name="plus" />
                  <span class="max-sm:hidden">Submit</span>
                </Link>
                <AccountMenu user={user()} />
              </>
            )}
          </Show>

          <details class="min-[1100px]:hidden">
            <summary class={iconButton} aria-label="Menu">
              <Icon name="menu" />
            </summary>
            <nav
              class="absolute inset-x-0 top-[60px] grid border-b border-line bg-base px-4 py-2 sm:px-6"
              aria-label="Main"
            >
              <For each={NAV}>
                {(item) => (
                  <Link
                    to={item.to}
                    class="border-b border-line py-3 text-sm font-semibold tracking-[0.08em] text-fg-2 uppercase last:border-b-0 hover:text-fg data-[status=active]:text-accent"
                  >
                    {item.label}
                  </Link>
                )}
              </For>
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
