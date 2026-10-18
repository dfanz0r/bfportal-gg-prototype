import { createEffect, createSignal, on, onMount, Show } from 'solid-js'

import { Icon } from '../ui/icon'
import { label } from '../ui/ui'

const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * The picture at a link someone typed, in a 16:9 frame, or why there is none.
 * Their browser loads it, so a link that does not lead to a picture shows
 * before the form is sent. `note` is a small label over the picture, `play`
 * marks it as a video's, and `problem` says what is wrong with the link in
 * place of the picture.
 */
export function ImagePreview(props: {
  src?: string | null
  note?: string
  play?: boolean
  problem?: string
  class?: string
}) {
  const typed = () => props.src?.trim() ?? ''
  const src = () => (isHttps(typed()) && !props.problem ? typed() : undefined)
  const [broken, setBroken] = createSignal(false)
  createEffect(on(src, () => setBroken(false), { defer: true }))
  let picture: HTMLImageElement | undefined
  // A picture the server's HTML named may have failed before the page's
  // script was running to hear it.
  onMount(() => {
    if (picture?.complete && picture.naturalWidth === 0) setBroken(true)
  })
  const problem = () => {
    if (props.problem) return props.problem
    if (typed() && !src()) return 'Needs https://'
    if (broken()) return 'Does not load'
    return undefined
  }

  return (
    <div
      class={`relative grid aspect-video place-items-center overflow-hidden border border-line bg-base text-fg-3 ${props.class ?? ''}`}
    >
      <Show
        when={src() && !broken()}
        fallback={
          <Show
            when={problem()}
            fallback={<Icon name="image" class="size-5" />}
          >
            {(text) => (
              <span class="grid justify-items-center gap-1 px-1 text-center text-[11px] whitespace-nowrap text-warn">
                <Icon name="alert" class="size-3.5" />
                {text()}
              </span>
            )}
          </Show>
        }
      >
        <img
          ref={picture}
          src={src()}
          alt=""
          referrerpolicy="no-referrer"
          // A link typed a letter at a time names other addresses on the
          // way, and one that fails can say so after it was replaced.
          onError={(event) => {
            const image = event.currentTarget
            if (image.isConnected && image.getAttribute('src') === src()) {
              setBroken(true)
            }
          }}
          class="absolute inset-0 size-full object-cover"
        />
      </Show>
      <Show when={props.play && src() && !broken()}>
        <span class="absolute inset-0 m-auto grid size-8 place-items-center bg-base/80 text-fg backdrop-blur-sm">
          <Icon name="play" class="size-3.5 fill-current" />
        </span>
      </Show>
      <Show when={props.note && src() && !broken()}>
        <span
          class={`${label} absolute bottom-0 left-0 bg-base/85 px-1.5 py-0.5 text-fg-2`}
        >
          {props.note}
        </span>
      </Show>
    </div>
  )
}
