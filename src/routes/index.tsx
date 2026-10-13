import { createFileRoute, Link } from '@tanstack/solid-router'
import { For, onCleanup, onMount } from 'solid-js'

import { Icon } from '../components/icon'
import { buttonSteel, display } from '../components/ui'

export const Route = createFileRoute('/')({ component: Home })

const SECTIONS = [
  {
    to: '/library',
    title: 'Experience library',
    text: 'Every experience shared for Battlefield 6 and Battlefield 2042.',
  },
  {
    to: '/scripts',
    title: 'Scripts',
    text: 'Rules, logic and interface snippets for the Portal editor.',
  },
  {
    to: '/updates',
    title: 'Recent updates',
    text: 'What creators have changed, fixed and released.',
  },
  {
    to: '/events',
    title: 'Events and playtests',
    text: 'Community nights, and experiences that need testers.',
  },
] as const

function Home() {
  let search: HTMLInputElement | undefined

  // "/" jumps to the search field, unless something is already being typed.
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      if (event.key === '/' && !typing) {
        event.preventDefault()
        search?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    onCleanup(() => document.removeEventListener('keydown', onKey))
  })

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
          <search>
            <form
              action="/library"
              class="frame mt-5 flex h-[50px] max-w-[560px] items-center border border-line-strong bg-surface-1/90 focus-within:border-steel"
            >
              <Icon name="search" class="ml-4 size-5 text-steel" />
              <input
                type="search"
                name="q"
                ref={(element) => {
                  search = element
                }}
                placeholder="Search experiences, scripts, maps and guides"
                aria-label="Search bfportal.gg"
                autocomplete="off"
                class="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[15.5px] text-fg outline-none placeholder:text-fg-3"
              />
              <span
                class="mr-3 border border-line-strong px-1.5 py-px font-mono text-[10.5px] text-fg-3 max-sm:hidden"
                aria-hidden="true"
              >
                /
              </span>
              <button
                type="submit"
                class={`${buttonSteel} -my-px -mr-px h-[50px]`}
              >
                Search
              </button>
            </form>
          </search>
        </div>
      </section>

      <div class="wrap grid gap-5 pt-10 sm:grid-cols-2 lg:grid-cols-4">
        <For each={SECTIONS}>
          {(section) => (
            <Link
              to={section.to}
              class="card-hover group border border-line bg-surface-1 p-5"
            >
              <h2
                class={`${display} flex items-center justify-between gap-3 text-2xl leading-none`}
              >
                {section.title}
                <Icon
                  name="arrow-right"
                  class="size-4 text-fg-3 transition-transform group-hover:translate-x-1 group-hover:text-accent"
                />
              </h2>
              <p class="mt-2.5 text-sm text-fg-2">{section.text}</p>
            </Link>
          )}
        </For>
      </div>
    </main>
  )
}
