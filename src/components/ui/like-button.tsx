import { useLocation } from '@tanstack/solid-router'
import { createEffect, createSignal } from 'solid-js'

import { likeExperience, likeSnippet } from '../../functions/likes'
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
  // At the end of a row in a list.
  row: {
    button:
      'inline-flex h-[34px] items-center gap-1.5 border border-transparent px-2.5 font-mono text-[13px] text-fg-2 tabular-nums transition-colors hover:border-line hover:text-accent aria-pressed:text-accent',
    icon: 'size-4',
  },
}

/** What can be liked, and the function that likes each. */
const likes = { experience: likeExperience, snippet: likeSnippet }

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
  /** What `slug` is the address of. An experience unless it says. */
  kind?: keyof typeof likes
  slug: string
  likes: number
  liked: boolean
  signedIn?: boolean
  look?: keyof typeof looks
  class?: string
}) {
  const like = () => likes[props.kind ?? 'experience']
  const location = useLocation()
  // What the page was loaded with, until the visitor presses the button.
  const [state, setState] = createSignal({
    liked: props.liked,
    likes: props.likes,
  })
  createEffect(() => setState({ liked: props.liked, likes: props.likes }))
  // The experience whose answer is awaited. The router can hand this button
  // another experience before it comes, and that one's state is not to be
  // touched by it.
  const [sending, setSending] = createSignal<string | null>(null)
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
    const slug = props.slug
    if (sending() === slug) return
    setSending(slug)
    const before = state()
    const liked = !before.liked
    // Show it at once, and put it back if the server says otherwise.
    setState({ liked, likes: before.likes + (liked ? 1 : -1) })
    try {
      const result = await like()({ data: { slug, liked } })
      if (props.slug !== slug) return
      if (result.ok) {
        setState({ liked: result.liked, likes: result.likes })
      } else {
        setState(before)
        if (result.reason === 'signed-out') window.location.assign('/login')
      }
    } catch {
      if (props.slug === slug) setState(before)
    } finally {
      if (sending() === slug) setSending(null)
    }
  }

  return (
    <form
      method="post"
      action={like().url}
      onSubmit={submit}
      class={props.class}
    >
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="liked" value={String(!state().liked)} />
      <input type="hidden" name="back" value={back()} />
      <button
        type="submit"
        aria-pressed={state().liked}
        aria-busy={sending() === props.slug}
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
