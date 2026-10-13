import { createSignal, For, Show } from 'solid-js'

import { Icon } from './icon'
import { iconButton } from './ui'

/**
 * An experience's pictures: the cover, then the rest, one at a time. The
 * arrows, the thumbnails and the left and right keys move between them.
 * Before the page's script runs it shows the cover and the thumbnails.
 */
export function Gallery(props: { images: string[] }) {
  const [chosen, setIndex] = createSignal(0)
  const count = () => props.images.length
  // The pictures can change under it, when the page moves to another
  // experience. One that is no longer there falls back to the last.
  const index = () => Math.min(chosen(), Math.max(count() - 1, 0))
  const move = (by: number) => setIndex((index() + by + count()) % count())
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') move(-1)
    if (event.key === 'ArrowRight') move(1)
  }
  const arrow = `${iconButton} absolute top-1/2 -translate-y-1/2 bg-base/80 backdrop-blur-sm`

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys are a shortcut; every picture is also reachable through its thumbnail button
    <div onKeyDown={onKey}>
      <div class="relative aspect-video overflow-hidden border border-line bg-surface-3 sm:aspect-[16/7]">
        <img
          src={props.images[index()]}
          alt=""
          referrerpolicy="no-referrer"
          class="size-full object-cover"
        />
        <Show when={count() > 1}>
          <button
            type="button"
            class={`${arrow} left-3`}
            aria-label="Previous image"
            onClick={() => move(-1)}
          >
            <Icon name="arrow-right" class="size-4 rotate-180" />
          </button>
          <button
            type="button"
            class={`${arrow} right-3`}
            aria-label="Next image"
            onClick={() => move(1)}
          >
            <Icon name="arrow-right" />
          </button>
          <span class="absolute right-3 bottom-3 bg-base/80 px-2 py-0.5 font-mono text-[11.5px] text-fg-2 backdrop-blur-sm">
            <b class="font-medium text-fg">{index() + 1}</b> / {count()}
          </span>
        </Show>
      </div>
      <Show when={count() > 1}>
        <div class="mt-2 grid auto-cols-[124px] grid-flow-col gap-2 overflow-x-auto pb-0.5">
          <For each={props.images}>
            {(image, position) => (
              <button
                type="button"
                class="aspect-video overflow-hidden border border-line opacity-55 transition-opacity hover:opacity-100 aria-[current=true]:border-accent aria-[current=true]:opacity-100"
                aria-current={position() === index() ? 'true' : undefined}
                aria-label={`Image ${position() + 1} of ${count()}`}
                onClick={() => setIndex(position())}
              >
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="size-full object-cover"
                />
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
