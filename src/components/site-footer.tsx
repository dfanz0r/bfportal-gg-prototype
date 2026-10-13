import { Link } from '@tanstack/solid-router'
import { For } from 'solid-js'

import { links } from '../shared/links'
import { Icon, type IconName } from './icon'
import { iconButton } from './ui'

const SOCIAL: { name: IconName; label: string; href: string }[] = [
  { name: 'discord', label: 'Discord', href: links.discord },
  { name: 'twitter', label: 'Twitter', href: links.twitter },
  { name: 'github', label: 'GitHub', href: links.github },
  { name: 'patreon', label: 'Patreon', href: links.patreon },
]

const columnTitle =
  'mb-3.5 font-mono text-[11px] font-medium tracking-[0.14em] text-fg-3 uppercase'
const columnLink = 'text-sm text-fg-2 hover:text-fg'

export function SiteFooter() {
  return (
    <footer class="mt-24 border-t border-line bg-surface-1">
      <div class="wrap grid gap-10 py-12 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div class="sm:col-span-3 lg:col-span-1">
          <img src="/logo.svg" alt="bfportal.gg" width="148" height="28" />
          <p class="mt-4 max-w-[340px] text-sm text-fg-2">
            Made by the Battlefield Portal Community. Run by volunteers and paid
            for by supporters.
          </p>
          <div class="mt-5 flex gap-2">
            <For each={SOCIAL}>
              {(item) => (
                <a href={item.href} class={iconButton} aria-label={item.label}>
                  <Icon name={item.name} />
                </a>
              )}
            </For>
          </div>
        </div>

        <div>
          <h2 class={columnTitle}>Browse</h2>
          <ul class="grid gap-2">
            <li>
              <Link to="/library" class={columnLink}>
                Experience library
              </Link>
            </li>
            <li>
              <Link to="/scripts" class={columnLink}>
                Scripts
              </Link>
            </li>
            <li>
              <Link to="/maps" class={columnLink}>
                Maps
              </Link>
            </li>
            <li>
              <Link to="/tools" class={columnLink}>
                Tools and plugins
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 class={columnTitle}>Create</h2>
          <ul class="grid gap-2">
            <li>
              <Link to="/submit" class={columnLink}>
                Submit an experience
              </Link>
            </li>
            <li>
              <Link to="/guides" class={columnLink}>
                Guides and docs
              </Link>
            </li>
            <li>
              <Link to="/updates" class={columnLink}>
                Recent updates
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 class={columnTitle}>Community</h2>
          <ul class="grid gap-2">
            <li>
              <a href={links.discord} class={columnLink}>
                Discord server
              </a>
            </li>
            <li>
              <Link to="/events" class={columnLink}>
                Events and playtests
              </Link>
            </li>
            <li>
              <Link to="/forum" class={columnLink}>
                Forum
              </Link>
            </li>
            <li>
              <a href={links.patreon} class={columnLink}>
                Support us on Patreon
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-line">
        <p class="wrap py-4 text-[12.5px] text-fg-3">
          © 2026 bfportal.gg. A community project, not affiliated with
          Electronic Arts or DICE.
        </p>
      </div>
    </footer>
  )
}
