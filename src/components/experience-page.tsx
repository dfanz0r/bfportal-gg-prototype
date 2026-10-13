import { For, Show } from 'solid-js'

import type { Experience } from '../functions/experience'
import { formatBytes } from '../shared/dates'
import { gameInfo } from '../shared/games'
import { Avatar } from './avatar'
import { DateText } from './date-text'
import { ExperienceCard } from './experience-card'
import { ExperienceSide } from './experience-side'
import { Gallery } from './gallery'
import { LibraryLink } from './library-link'
import { LikeButton } from './like-button'
import { PersonLink } from './person-link'
import { Section } from './section'
import { buttonGhost, panel } from './ui'
import { UpdatePost } from './update-post'

const FILE_GLYPHS = {
  export: 'JSON',
  script: 'TS',
  spatial: 'JSON',
  scene: 'TSCN',
  strings: 'JSON',
  other: 'FILE',
} as const

const smallButton = `${buttonGhost} h-[34px] px-3 text-xs`

/** The head of an experience page, for search engines and link previews. */
export function experienceHead(data: Experience | undefined) {
  if (!data) return {}
  const title = `${data.title} · bfportal.gg`
  const address = `${data.siteUrl}/experiences/${data.slug}`
  const description =
    data.summary || `A ${gameInfo(data.game).name} Portal experience.`
  const image = data.images[0]
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: data.title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: address },
      { property: 'og:type', content: 'article' },
      { property: 'og:site_name', content: 'bfportal.gg' },
      ...(image
        ? [
            { property: 'og:image', content: image },
            { name: 'twitter:card', content: 'summary_large_image' },
          ]
        : [{ name: 'twitter:card', content: 'summary' }]),
    ],
    links: [{ rel: 'canonical', href: address }],
  }
}

/** An experience's own page. */
export function ExperiencePage(props: { data: Experience }) {
  const data = () => props.data
  const info = () => gameInfo(data().game)
  const hasFiles = () =>
    data().isTemplate && (data().files.length > 0 || data().filesUrl)

  return (
    <main id="content" data-game={data().game}>
      <section class="dot-grid border-b border-line bg-surface-1">
        <div class="wrap py-6">
          <nav
            class="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-fg-3"
            aria-label="Breadcrumb"
          >
            <LibraryLink game={data().game} class="hover:text-fg">
              Library
            </LibraryLink>
            <span aria-hidden="true">/</span>
            <LibraryLink game={data().game} class="hover:text-fg">
              {info().name}
            </LibraryLink>
            <span aria-hidden="true">/</span>
            <LibraryLink
              game={data().game}
              search={{ category: data().category.slug }}
              class="hover:text-fg"
            >
              {data().category.name}
            </LibraryLink>
          </nav>
          <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div class="min-w-0">
              <h1 class="font-display text-[clamp(34px,3.4vw,46px)] leading-[0.96] font-extrabold tracking-[0.005em] text-steel-hi uppercase [overflow-wrap:anywhere]">
                {data().title}
              </h1>
              <p class="mt-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13.5px] text-fg-2">
                <Show when={data().owner}>
                  {(owner) => (
                    <span class="inline-flex items-center gap-[7px]">
                      <Avatar
                        name={owner().name}
                        image={owner().image}
                        class="size-5 text-[9px]"
                      />
                      <span>
                        by <PersonLink person={owner()} />
                      </span>
                    </span>
                  )}
                </Show>
                <Show when={data().creators.length > 0}>
                  <span>
                    with{' '}
                    {data()
                      .creators.map((creator) => creator.name)
                      .join(', ')}
                  </span>
                </Show>
                <Show when={data().publishedAt}>
                  {(published) => (
                    <span>
                      Published <DateText value={published()} />
                    </span>
                  )}
                </Show>
                {/* Only when it has changed since it was published. */}
                <Show
                  when={
                    data().updatedAt?.getTime() !==
                      data().publishedAt?.getTime() && data().updatedAt
                  }
                >
                  {(updated) => (
                    <span>
                      Updated <DateText value={updated()} now={data().now} />
                    </span>
                  )}
                </Show>
              </p>
            </div>
            <LikeButton
              slug={data().slug}
              likes={data().likes}
              liked={data().viewer.liked}
              signedIn={data().viewer.signedIn}
            />
          </div>
        </div>
      </section>

      <div class="wrap pt-6 pb-20 sm:pt-8 sm:pb-24">
        <Show when={data().unavailable || data().bugged || data().xpFarm}>
          <div class="mb-6 grid gap-1 border-l-2 border-warn bg-warn/8 px-4 py-3 text-sm text-fg-2">
            <Show when={data().unavailable}>
              <p>
                <b class="font-semibold text-fg">This no longer loads.</b> The
                page stays so its description, updates and files are not lost.
              </p>
            </Show>
            <Show when={data().bugged}>
              <p>
                <b class="font-semibold text-fg">Reported as bugged.</b> It
                loads, but something in it does not work as described.
              </p>
            </Show>
            <Show when={data().xpFarm}>
              <p>
                <b class="font-semibold text-fg">Reported as an XP farm.</b>
              </p>
            </Show>
          </div>
        </Show>

        <div class="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10">
          <div class="min-w-0">
            <Show when={data().images.length > 0}>
              <Gallery images={data().images} />
            </Show>

            <section id="about" class="pt-6">
              <h2 class="sr-only">About</h2>
              <Show
                when={data().descriptionHtml}
                fallback={
                  <p class="text-fg-3">Its creator has not described it.</p>
                }
              >
                {/* Rendered and sanitized from Markdown when it was saved. */}
                <div class="prose" innerHTML={data().descriptionHtml} />
              </Show>
            </section>

            <Show when={data().updates.length > 0}>
              <Section id="updates" title="Updates">
                <For each={data().updates}>
                  {(update) => <UpdatePost update={update} now={data().now} />}
                </For>
              </Section>
            </Show>

            <Show when={data().rotation.length > 0}>
              <Section id="rotation" title="Map rotation">
                <ol class="grid gap-3 sm:grid-cols-3">
                  <For each={data().rotation}>
                    {(entry) => (
                      <li class={panel}>
                        <div class="aspect-[2/1] bg-surface-3">
                          <Show when={entry.imageUrl}>
                            {(image) => (
                              <img
                                src={image()}
                                alt=""
                                loading="lazy"
                                referrerpolicy="no-referrer"
                                class="size-full object-cover"
                              />
                            )}
                          </Show>
                        </div>
                        <p class="px-3 pt-[9px] pb-[11px] text-sm font-semibold">
                          {entry.name}
                          <small class="block text-[12.5px] font-normal text-fg-3">
                            {entry.mode}
                            <Show when={entry.players > 0}>
                              , up to {entry.players} players
                            </Show>
                          </small>
                        </p>
                      </li>
                    )}
                  </For>
                </ol>
              </Section>
            </Show>

            <Show when={hasFiles()}>
              <Section id="files" title="Files">
                <p class="mb-4 border-l-2 border-accent bg-accent/8 px-4 py-3.5 text-sm text-fg-2">
                  <b class="font-semibold text-fg">This is a template.</b> Take
                  the files, change what you like and publish your own version.
                </p>
                <ul class={`${panel} divide-y divide-line`}>
                  <For each={data().files}>
                    {(file) => (
                      <li class="flex items-center gap-4 px-4 py-3.5">
                        <span
                          class="grid size-11 shrink-0 place-items-center border border-line bg-surface-3 font-mono text-xs font-semibold tracking-[0.04em] text-steel"
                          aria-hidden="true"
                        >
                          {FILE_GLYPHS[file.kind]}
                        </span>
                        <span class="min-w-0 flex-1 truncate text-[15px] font-semibold">
                          {file.filename}
                        </span>
                        <span class="font-mono text-xs text-fg-3">
                          {formatBytes(file.sizeBytes)}
                        </span>
                        <a
                          href={`/api/files/${file.id}`}
                          class={smallButton}
                          download={file.filename}
                        >
                          Download
                        </a>
                      </li>
                    )}
                  </For>
                  <Show when={data().filesUrl}>
                    {(url) => (
                      <li class="flex items-center gap-4 px-4 py-3.5">
                        <span class="min-w-0 flex-1">
                          <span class="block text-[15px] font-semibold">
                            More files
                          </span>
                          <span class="block text-[13.5px] text-fg-2">
                            Hosted by the creator. Too large to keep here.
                          </span>
                        </span>
                        <a href={url()} class={smallButton} rel="noopener">
                          Open
                        </a>
                      </li>
                    )}
                  </Show>
                </ul>
              </Section>
            </Show>

            <Show when={data().more.length > 0}>
              <Section
                title={
                  data().owner
                    ? `More from ${data().owner?.name}`
                    : 'More from this creator'
                }
              >
                <div class="grid gap-4 min-[680px]:grid-cols-2 min-[680px]:gap-5 min-[1100px]:grid-cols-3">
                  <For each={data().more}>
                    {(card) => <ExperienceCard experience={card} />}
                  </For>
                </div>
              </Section>
            </Show>
          </div>

          <ExperienceSide data={data()} />
        </div>
      </div>
    </main>
  )
}
