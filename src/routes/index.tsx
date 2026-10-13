import { createFileRoute, Link } from '@tanstack/solid-router'
import { For } from 'solid-js'

import { Icon } from '../components/icon'
import { SearchForm } from '../components/search-form'
import { display } from '../components/ui'
import { type SectionPath, section } from '../shared/sections'

export const Route = createFileRoute('/')({ component: Home })

// Stands in for the home page's real sections until there is data for them.
const TILES: SectionPath[] = ['/library', '/scripts', '/updates', '/events']

function Home() {
  return (
    <main id="content">
      <section class="relative overflow-hidden border-b border-line">
        <div
          class="dot-grid absolute inset-0 [mask-image:linear-gradient(105deg,rgb(0_0_0/0.9),rgb(0_0_0/0.25)_45%,transparent_72%)]"
          aria-hidden="true"
        />
        <div class="wrap relative py-9 sm:py-10">
          <h1 class="font-display text-[clamp(42px,4.6vw,64px)] leading-[0.92] font-extrabold tracking-[0.005em] text-steel-hi uppercase">
            The Portal creator hub
          </h1>
          <p class="mt-3 max-w-[34em] text-base text-fg-2">
            Experiences, scripts, maps and tools made by the community. Find
            something to play tonight, or share what you have built.
          </p>
          <SearchForm
            class="mt-5 block"
            action="/library"
            placeholder="Search experiences, scripts, maps and guides"
            label="Search bfportal.gg"
          />
        </div>
      </section>

      <div class="wrap grid gap-5 pt-10 sm:grid-cols-2 lg:grid-cols-4">
        <For each={TILES.map(section)}>
          {(item) => (
            <Link
              to={item.to}
              class="card-hover group border border-line bg-surface-1 p-5"
            >
              <h2
                class={`${display} flex items-center justify-between gap-3 text-2xl leading-none tracking-[0.015em]`}
              >
                {item.title}
                <Icon
                  name="arrow-right"
                  class="size-4 text-fg-3 transition-transform group-hover:translate-x-1 group-hover:text-accent"
                />
              </h2>
              <p class="mt-2.5 text-sm text-fg-2">{item.text}</p>
            </Link>
          )}
        </For>
      </div>
    </main>
  )
}
