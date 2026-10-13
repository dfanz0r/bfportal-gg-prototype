import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { SessionUser } from '../functions/session'
import { links } from '../shared/links'
import { sections } from '../shared/sections'
import { AccountMenu } from './account-menu'
import { createDismiss } from './dismiss'
import { Icon } from './icon'
import { Logo } from './logo'
import { buttonAccent, buttonGhost, iconButton } from './ui'

// The bar under the current section is drawn on the header's bottom border,
// with a small notch above it.
const navLink =
  "relative flex items-center px-2.5 text-[13px] font-semibold tracking-[0.09em] whitespace-nowrap text-fg-2 uppercase transition-colors hover:text-fg data-[status=active]:text-fg data-[status=active]:after:absolute data-[status=active]:after:inset-x-2.5 data-[status=active]:after:-bottom-px data-[status=active]:after:h-0.5 data-[status=active]:after:bg-accent data-[status=active]:after:content-[''] data-[status=active]:before:absolute data-[status=active]:before:bottom-px data-[status=active]:before:left-1/2 data-[status=active]:before:-translate-x-1/2 data-[status=active]:before:border-4 data-[status=active]:before:border-transparent data-[status=active]:before:border-b-accent data-[status=active]:before:content-['']"

/**
 * The navigation as a menu, for windows too narrow for the bar. Eight items
 * and the tools do not fit beside the logo below about 1240px, so this takes
 * over below Tailwind's `xl` (1280px).
 */
function SectionMenu() {
  const dismiss = createDismiss()

  return (
    <details class="xl:hidden" ref={dismiss}>
      <summary class={iconButton} aria-label="Menu">
        <Icon name="menu" />
      </summary>
      <nav
        class="absolute inset-x-0 top-[60px] grid border-b border-line bg-base px-4 py-2 sm:px-6"
        aria-label="Main"
      >
        <For each={sections}>
          {(item) => (
            <Link
              to={item.to}
              class="border-b border-line py-3 text-sm font-semibold tracking-[0.08em] text-fg-2 uppercase last:border-b-0 hover:text-fg data-[status=active]:text-accent"
            >
              {item.nav}
            </Link>
          )}
        </For>
      </nav>
    </details>
  )
}

export function SiteHeader(props: { user: SessionUser | null }) {
  return (
    <header class="sticky top-0 z-50 h-[60px] border-b border-line bg-base/90 backdrop-blur-md">
      <div class="wrap flex h-full items-center gap-5 xl:gap-9">
        <Link to="/" class="shrink-0" aria-label="bfportal.gg home">
          <Logo class="w-32 sm:w-[148px]" />
        </Link>

        <nav class="flex gap-1 self-stretch max-xl:hidden" aria-label="Main">
          <For each={sections}>
            {(item) => (
              <Link to={item.to} class={navLink}>
                {item.nav}
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
          <SectionMenu />
        </div>
      </div>
    </header>
  )
}
