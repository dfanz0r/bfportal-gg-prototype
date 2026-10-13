import { createEffect, createSignal } from 'solid-js'

import { likeExperience } from '../functions/likes'
import { Icon } from './icon'

/**
 * The like count, which is also the button to like or unlike. It is a form
 * posted to the same function the script calls, so it works before the
 * page's script has loaded; a visitor who is not signed in is sent to sign in.
 */
export function LikeButton(props: {
  slug: string
  likes: number
  liked: boolean
  signedIn: boolean
}) {
  // What the page was loaded with, until the visitor presses the button.
  const [state, setState] = createSignal({
    liked: props.liked,
    likes: props.likes,
  })
  createEffect(() => setState({ liked: props.liked, likes: props.likes }))
  const back = () => `/experiences/${props.slug}`

  const submit = async (event: SubmitEvent) => {
    // Signing in is a full page load; let the form go there.
    if (!props.signedIn) return
    event.preventDefault()
    const before = state()
    const liked = !before.liked
    // Show it at once, and put it back if the server says otherwise.
    setState({ liked, likes: before.likes + (liked ? 1 : -1) })
    try {
      const result = await likeExperience({ data: { slug: props.slug, liked } })
      setState(
        result.ok ? { liked: result.liked, likes: result.likes } : before,
      )
    } catch {
      setState(before)
    }
  }

  return (
    <form method="post" action={likeExperience.url} onSubmit={submit}>
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="liked" value={String(!state().liked)} />
      <input type="hidden" name="back" value={back()} />
      <button
        type="submit"
        aria-pressed={state().liked}
        class="inline-flex h-[38px] items-center gap-2 border border-line-strong px-3 text-[13.5px] font-semibold transition-colors hover:border-steel hover:bg-steel/6 aria-pressed:border-accent aria-pressed:text-accent"
      >
        <Icon
          name="heart"
          class={state().liked ? 'size-4 fill-current' : 'size-4'}
        />
        {state().likes}
        <span class="sr-only">
          {state().liked ? ' likes. You like this.' : ' likes. Like this.'}
        </span>
      </button>
    </form>
  )
}
