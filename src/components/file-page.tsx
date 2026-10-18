import { Show } from 'solid-js'

import type { FileView } from '../functions/files'
import { formatBytes } from '../shared/dates'
import { fileGlyphs, fileLanguages } from '../shared/project-files'
import { safeBackPath } from '../shared/results'
import { PageLayout } from './layout/page-layout'
import { CodeView } from './ui/code-view'
import { CopyText } from './ui/copy-text'
import { Icon } from './ui/icon'
import { buttonGhost, panel } from './ui/ui'

const count = (value: number) => value.toLocaleString('en-US')

/**
 * One of a project's files, to read without downloading it: for a moderator
 * looking over a submission, or anyone looking at a template.
 */
export function FilePage(props: {
  data: FileView
  /** The page it was opened from, if it says; else its experience's page. */
  back?: string
}) {
  const data = () => props.data
  const file = () => data().file
  const cut = () => data().truncated
  const experiencePage = () => `/experiences/${data().experience.slug}`
  // Only one of this site's own pages.
  const back = () => {
    const given = props.back ? safeBackPath(props.back) : '/'
    return given === '/' ? experiencePage() : given
  }
  const backLabel = () =>
    back().startsWith('/admin/') ? 'Back to the review' : 'Back'

  return (
    <PageLayout
      title={file().filename}
      lead={`${fileGlyphs[file().kind]}, ${formatBytes(file().sizeBytes)}.${file().fromExport ? ' Taken from its export.' : ''}`}
      crumbs={[
        {
          label: data().experience.title,
          href: `/experiences/${data().experience.slug}`,
        },
        { label: 'Files' },
      ]}
      actions={
        <>
          <a href={back()} class={buttonGhost}>
            <Icon name="arrow-right" class="size-4 rotate-180" />
            {backLabel()}
          </a>
          <a
            href={data().download}
            download={file().filename}
            class={buttonGhost}
          >
            <Icon name="download" />
            Download
          </a>
        </>
      }
    >
      <Show when={!data().experience.isTemplate}>
        <p class="mb-4 border-l-2 border-steel bg-steel/8 px-4 py-3 text-sm text-fg-2">
          <b class="font-semibold text-fg">Private.</b> It is not a template, so
          only its owner and the moderators can see this file.
        </p>
      </Show>
      <div class={panel}>
        <p class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5 font-mono text-xs text-fg-3">
          <span>
            {count(data().lines)} {data().lines === 1 ? 'line' : 'lines'}
            <Show when={data().reformatted}>
              , indented to read. Long base64 data is shown as its size. The
              download is the file as it was uploaded.
            </Show>
          </span>
          <Show when={!cut()}>
            <CopyText text={data().text} label="Copy" />
          </Show>
        </p>
        <CodeView
          text={data().text}
          language={fileLanguages[file().kind]}
          class="max-h-[75vh]"
        />
        <Show when={cut()}>
          <p class="border-t border-line px-4 py-3 text-sm text-fg-2">
            <Show
              when={data().shownLines < data().lines}
              fallback="Only the start of this file is shown."
            >
              The first {count(data().shownLines)} of {count(data().lines)}{' '}
              lines.
            </Show>{' '}
            Download it for the rest.
          </p>
        </Show>
      </div>
    </PageLayout>
  )
}
