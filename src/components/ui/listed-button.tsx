import { list } from '../../functions/admin-content'
import { PostForm } from './post-form'
import { buttonGhost } from './ui'

/** Takes something live off the listings, or lists it again. */
export function ListedButton(props: {
  kind: 'experience' | 'snippet'
  slug: string
  /** Whether it is live now. */
  listed: boolean
}) {
  return (
    <PostForm action={list}>
      <input type="hidden" name="kind" value={props.kind} />
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="listed" value={String(!props.listed)} />
      <button type="submit" class={`${buttonGhost} h-[34px] px-3 text-xs`}>
        {props.listed ? 'Delist' : 'List again'}
      </button>
    </PostForm>
  )
}
