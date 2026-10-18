import { Icon } from './icon'
import { panel } from './ui'

/** A project's source repository, as a panel that links to it. */
export function RepoLink(props: { url: string }) {
  const name = () => props.url.replace(/^https?:\/\/(www\.)?github\.com\//, '')
  return (
    <a
      href={props.url}
      rel="noopener"
      class={`${panel} flex items-center gap-3 px-5 py-4 hover:border-line-strong`}
    >
      <Icon name="github" class="size-5 text-fg-2" />
      <span class="min-w-0">
        <b class="block truncate text-sm font-semibold">{name()}</b>
        <small class="text-xs text-fg-3">Source repository</small>
      </span>
      <Icon name="arrow-right" class="ml-auto size-4 text-fg-3" />
    </a>
  )
}
