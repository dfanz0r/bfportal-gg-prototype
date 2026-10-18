import { Show } from 'solid-js'

import { spotlight } from '../../functions/admin-content'
import { PostForm } from './post-form'

const track =
  'relative inline-flex h-[18px] w-[34px] items-center border p-[2px] transition-colors'
const on = 'justify-end border-accent bg-accent/20'
const off = 'justify-start border-line-strong bg-surface-2'
const knob = 'size-3'

/**
 * Whether an experience or a snippet is featured, or trending: a switch an
 * admin presses, which applies at once. A moderator sees where it stands.
 */
export function SpotlightSwitch(props: {
  kind: 'experience' | 'snippet'
  slug: string
  title: string
  field: 'featured' | 'trending'
  on: boolean
  canChange: boolean
}) {
  const name = () => (props.field === 'featured' ? 'Featured' : 'Trending')
  return (
    <Show
      when={props.canChange}
      fallback={
        <span class={`${track} ${props.on ? on : off} opacity-70`}>
          <span class={`${knob} ${props.on ? 'bg-accent' : 'bg-fg-3'}`} />
          <span class="sr-only">
            {name()}: {props.on ? 'yes' : 'no'}
          </span>
        </span>
      }
    >
      <PostForm action={spotlight}>
        <input type="hidden" name="kind" value={props.kind} />
        <input type="hidden" name="slug" value={props.slug} />
        <input type="hidden" name={props.field} value={String(!props.on)} />
        <button
          type="submit"
          role="switch"
          aria-checked={props.on}
          aria-label={`${name()}: ${props.title}`}
          class={`${track} ${props.on ? on : off} cursor-pointer hover:border-steel`}
        >
          <span class={`${knob} ${props.on ? 'bg-accent' : 'bg-fg-3'}`} />
        </button>
      </PostForm>
    </Show>
  )
}
