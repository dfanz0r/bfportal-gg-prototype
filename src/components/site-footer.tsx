import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import { links } from '../shared/links'
import { type SectionPath, section } from '../shared/sections'
import { Icon, type IconName } from './icon'
import { Logo } from './logo'
import { iconButton } from './ui'

const SOCIAL: { name: IconName; label: string; href: string }[] = [
  { name: 'discord', label: 'Discord', href: links.discord },
  { name: 'twitter', label: 'Twitter', href: links.twitter },
  { name: 'github', label: 'GitHub', href: links.github },
  { name: 'patreon', label: 'Patreon', href: links.patreon },
]

// A footer link is a page of the site or somewhere else.
type FooterLink =
  | { to: SectionPath | '/submit'; label: string }
  | { href: string; label: string }

const page = (to: SectionPath): FooterLink => ({ to, label: section(to).title })

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Browse',
    links: [page('/library'), page('/scripts'), page('/maps'), page('/tools')],
  },
  {
    title: 'Create',
    links: [
      { to: '/submit', label: 'Submit an experience' },
      page('/guides'),
      page('/updates'),
    ],
  },
  {
    title: 'Community',
    links: [
      { href: links.discord, label: 'Discord server' },
      page('/events'),
      page('/forum'),
      { href: links.patreon, label: 'Support us on Patreon' },
    ],
  },
]

const columnLink = 'text-sm text-fg-2 hover:text-fg'

function FooterItem(props: { link: FooterLink }) {
  return (
    <Show
      when={'to' in props.link && props.link}
      fallback={
        <a href={(props.link as { href: string }).href} class={columnLink}>
          {props.link.label}
        </a>
      }
    >
      {(internal) => (
        <Link to={internal().to} class={columnLink}>
          {internal().label}
        </Link>
      )}
    </Show>
  )
}

export function SiteFooter() {
  return (
    <footer class="mt-24 bg-surface-1">
      <div class="wrap grid gap-10 py-12 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div class="sm:col-span-3 lg:col-span-1">
          <Logo label="bfportal.gg" />
          <p class="mt-4 max-w-[340px] text-sm text-fg-2">
            Made with <span class="text-accent">♥</span>
            <span class="sr-only">love</span> by the Battlefield Portal
            Community. Run by volunteers and paid for by supporters.
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

        <For each={COLUMNS}>
          {(column) => (
            <div>
              <h2 class="mb-3.5 font-mono text-[11px] font-medium tracking-[0.14em] text-fg-3 uppercase">
                {column.title}
              </h2>
              <ul class="grid gap-[9px]">
                <For each={column.links}>
                  {(link) => (
                    <li>
                      <FooterItem link={link} />
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )}
        </For>
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
