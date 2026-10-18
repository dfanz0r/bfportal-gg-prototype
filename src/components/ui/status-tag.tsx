import { type ContentStatus, contentStatusLabels } from '../../shared/content'
import { statusChips, tag } from './ui'

/** A submission's status, in its one word, as a tag. */
export function StatusTag(props: { status: ContentStatus }) {
  const word = () => contentStatusLabels[props.status]
  return <span class={`${tag} ${statusChips[word()]}`}>{word()}</span>
}
