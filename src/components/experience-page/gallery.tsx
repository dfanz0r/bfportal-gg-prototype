import { createSignal, For, Show } from 'solid-js'

import type { Media } from '../../shared/media'
import { Icon } from '../ui/icon'
import { iconButton } from '../ui/ui'

const kindLabel = (media: Media) => (media.kind === 'video' ? 'Video' : 'Image')

/**
 * An experience's pictures and videos: the cover, then the rest, one at a
 * time. The arrows, the thumbnails and the left and right keys move between
 * them. A video shows its thumbnail until it is played, and only then loads
 * YouTube's player. Before the page's script runs it shows the cover and the
 * thumbnails, and a video's play button opens it on YouTube.
 */
export function Gallery(props: { items: Media[] }) {
  const [chosen, setChosen] = createSignal(0)
  const [playing, setPlaying] = createSignal(false)
  const count = () => props.items.length
  // The items can change under it, when the page moves to another
  // experience. One that is no longer there falls back to the last.
  const index = () => Math.min(chosen(), Math.max(count() - 1, 0))
  const current = () => props.items[index()]
  const video = () => {
    const item = current()
    return item?.kind === 'video' ? item : undefined
  }
  // Moving on stops a video that is playing.
  const show = (at: number) => {
    setChosen(at)
    setPlaying(false)
  }
  const move = (by: number) => show((index() + by + count()) % count())
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') move(-1)
    if (event.key === 'ArrowRight') move(1)
  }
  const arrow = `${iconButton} absolute top-1/2 -translate-y-1/2 bg-base/80 backdrop-blur-sm`
  const playBadge =
    'absolute inset-0 m-auto grid place-items-center bg-base/80 text-fg backdrop-blur-sm'

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys are a shortcut; every item is also reachable through its thumbnail button
    <div onKeyDown={onKey}>
      <div class="relative aspect-video overflow-hidden border border-line bg-surface-3 sm:aspect-[16/7]">
        <Show
          when={video()}
          fallback={
            <img
              src={current()?.url}
              alt=""
              referrerpolicy="no-referrer"
              class="size-full object-cover"
            />
          }
        >
          {(video) => (
            <Show
              when={playing()}
              fallback={
                <a
                  href={video().url}
                  rel="noopener noreferrer"
                  aria-label="Play video"
                  onClick={(event) => {
                    event.preventDefault()
                    setPlaying(true)
                  }}
                  class="group block size-full"
                >
                  <img
                    src={video().thumbnail}
                    alt=""
                    referrerpolicy="no-referrer"
                    class="size-full object-cover"
                  />
                  <span
                    class={`${playBadge} size-14 transition-colors group-hover:bg-accent group-hover:text-base`}
                  >
                    <Icon name="play" class="size-6 fill-current" />
                  </span>
                </a>
              }
            >
              <iframe
                src={video().embed}
                title="YouTube video"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin"
                class="size-full"
              />
            </Show>
          )}
        </Show>
        <Show when={count() > 1}>
          <button
            type="button"
            class={`${arrow} left-3`}
            aria-label="Previous"
            onClick={() => move(-1)}
          >
            <Icon name="arrow-right" class="size-4 rotate-180" />
          </button>
          <button
            type="button"
            class={`${arrow} right-3`}
            aria-label="Next"
            onClick={() => move(1)}
          >
            <Icon name="arrow-right" />
          </button>
          {/* Off while a video plays, where the player has its own controls. */}
          <Show when={!playing()}>
            <span class="absolute right-3 bottom-3 bg-base/80 px-2 py-0.5 font-mono text-[11.5px] text-fg-2 backdrop-blur-sm">
              <b class="font-medium text-fg">{index() + 1}</b> / {count()}
            </span>
          </Show>
        </Show>
      </div>
      <Show when={count() > 1}>
        <div class="mt-2 grid auto-cols-[124px] grid-flow-col gap-2 overflow-x-auto pb-0.5">
          <For each={props.items}>
            {(item, position) => (
              <button
                type="button"
                class="relative aspect-video overflow-hidden border border-line opacity-55 transition-opacity hover:opacity-100 aria-[current=true]:border-accent aria-[current=true]:opacity-100"
                aria-current={position() === index() ? 'true' : undefined}
                aria-label={`${kindLabel(item)} ${position() + 1} of ${count()}`}
                onClick={() => show(position())}
              >
                <img
                  src={item.kind === 'video' ? item.thumbnail : item.url}
                  alt=""
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="size-full object-cover"
                />
                <Show when={item.kind === 'video'}>
                  <span class={`${playBadge} size-6`}>
                    <Icon name="play" class="size-3 fill-current" />
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
