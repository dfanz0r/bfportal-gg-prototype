import { useLocation } from '@tanstack/solid-router'
import { createEffect, createSignal } from 'solid-js'

import { likeExperience } from '../functions/likes'
import { Icon } from './icon'

const looks = {
  page: {
    button:
      'inline-flex h-[38px] items-center gap-2 border border-line-strong px-3 text-[13.5px] font-semibold transition-colors hover:border-steel hover:bg-steel/6 aria-pressed:border-accent aria-pressed:text-accent',
    icon: 'size-4',
  },
  // Over a card's picture, where the count used to be: big enough to press.
  card: {
    button:
      'inline-flex h-[38px] items-center gap-2 bg-base/80 px-3 font-mono text-[15px] text-fg tabular-nums backdrop-blur-sm transition-colors hover:bg-base hover:text-accent aria-pressed:text-accent',
    icon: 'size-[18px]',
  },
}

/**
 * The like count, which is also the button to like or unlike. It is a form
 * posted to the same function the script calls, so it works before the
 * page's script has loaded; a visitor who is not signed in is sent to sign in.
 *
 * A card does not know whether its visitor is signed in, so `signedIn` is
 * left out there: the script asks, and a visitor the server says is not
 * signed in goes to sign in.
 */
export function LikeButton(props: {
  slug: string
  likes: number
  liked: boolean
  signedIn?: boolean
  look?: keyof typeof looks
  class?: string
}) {
  const location = useLocation()
  // What the page was loaded with, until the visitor presses the button.
  const [state, setState] = createSignal({
    liked: props.liked,
    likes: props.likes,
  })
  createEffect(() => setState({ liked: props.liked, likes: props.likes }))
  const [sending, setSending] = createSignal(false)
  // Back to the page it was pressed on, a listing's as much as its own.
  const back = () => location().href
  const look = () => looks[props.look ?? 'page']

  const submit = async (event: SubmitEvent) => {
    // Signing in is a full page load; let the form go there.
    if (props.signedIn === false) return
    event.preventDefault()
    // One at a time. A second press before the first is answered would start
    // from a count that is only a guess, and the answers can arrive in either
    // order.
    if (sending()) return
    setSending(true)
    const before = state()
    const liked = !before.liked
    // Show it at once, and put it back if the server says otherwise.
    setState({ liked, likes: before.likes + (liked ? 1 : -1) })
    try {
      const result = await likeExperience({ data: { slug: props.slug, liked } })
      if (result.ok) {
        setState({ liked: result.liked, likes: result.likes })
      } else {
        setState(before)
        if (result.reason === 'signed-out') window.location.assign('/login')
      }
    } catch {
      setState(before)
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      method="post"
      action={likeExperience.url}
      onSubmit={submit}
      class={props.class}
    >
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="liked" value={String(!state().liked)} />
      <input type="hidden" name="back" value={back()} />
      <button
        type="submit"
        aria-pressed={state().liked}
        aria-busy={sending()}
        class={look().button}
      >
        <Icon
          name="heart"
          class={`${look().icon} ${state().liked ? 'fill-current' : ''}`}
        />
        {state().likes}
        <span class="sr-only">
          {state().liked ? ' likes. You like this.' : ' likes. Like this.'}
        </span>
      </button>
    </form>
  )
}
