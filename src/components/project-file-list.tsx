import { For, Show } from 'solid-js'

import type { FileKind } from '../shared/content'
import { formatBytes } from '../shared/dates'
import { fileGlyphs } from '../shared/project-files'
import { fileGlyph, label, panel } from './ui'

/**
 * A project's files for a moderator: who may download them, then each with
 * its size, whether it came out of the export, and a link to download it.
 */
export function ProjectFileList(props: {
  files: {
    id: number
    kind: FileKind
    filename: string
    sizeBytes: number
    fromExport: boolean
  }[]
  /** Whether they are offered as a template, which makes them public. */
  isTemplate: boolean
}) {
  return (
    <Show when={props.files.length > 0}>
      <div>
        <h2 class={`${label} mb-2`}>Files</h2>
        <p class="mb-2 text-[13px] text-fg-2">
          <Show
            when={props.isTemplate}
            fallback={
              <>
                <b class="font-semibold text-fg">Private.</b> It is not a
                template, so only its owner and the moderators can download
                these.
              </>
            }
          >
            <b class="font-semibold text-fg">Public once published.</b> It is
            offered as a template, so anyone can download these.
          </Show>
        </p>
        <ul class={`${panel} divide-y divide-line`}>
          <For each={props.files}>
            {(file) => (
              <li class="flex items-center gap-3 px-3 py-2">
                <span class={`${fileGlyph} size-9`} aria-hidden="true">
                  {fileGlyphs[file.kind]}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm font-semibold">
                  {file.filename}
                  <Show when={file.fromExport}>
                    <span class="ml-2 font-normal text-fg-3">
                      from the export
                    </span>
                  </Show>
                </span>
                <span class="font-mono text-xs text-fg-3">
                  {formatBytes(file.sizeBytes)}
                </span>
                <a
                  href={`/files/${file.id}`}
                  class="text-sm text-steel-hi underline"
                >
                  View
                </a>
                <a
                  href={`/api/files/${file.id}`}
                  download={file.filename}
                  class="text-sm text-steel-hi underline"
                >
                  Download
                </a>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  )
}
