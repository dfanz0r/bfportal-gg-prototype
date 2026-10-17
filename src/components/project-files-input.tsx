import { createSignal, For, type JSX, Show } from 'solid-js'

import type { SubmitPageData } from '../functions/submit'
import { formatBytes } from '../shared/dates'
import {
  ADDED_FILE_TYPES,
  type ExportSummary,
  fileGlyphs,
  MAX_EXPORT_BYTES,
  MAX_FILE_BYTES,
} from '../shared/project-files'
import { FieldError } from './field-error'
import { createHydrated } from './hydrated'
import { Icon } from './icon'
import { buttonGhost, fileGlyph, label, panel } from './ui'

type HeldFile = SubmitPageData['held'][number]

/** Which file input a file was chosen in. */
export type FileSlot = 'exportFile' | 'addedFiles'

const MB = 1024 * 1024
const count = (value: number) => value.toLocaleString('en-US')
const row = 'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5'

/** What an export holds, in the order Portal's editor shows it. */
function facts(summary: ExportSummary): [string, string][] {
  const players = summary.teams.reduce((sum, team) => sum + team.players, 0)
  const bots = summary.teams.reduce((sum, team) => sum + team.bots, 0)
  return [
    ['Name', summary.name || 'None'],
    ['Lobby size', `Up to ${count(players)} players`],
    ['Bots', bots > 0 ? count(bots) : 'None'],
    ['Maps', count(summary.maps.length)],
    [
      'Script',
      summary.scriptLines > 0 ? `${count(summary.scriptLines)} lines` : 'None',
    ],
    ['Blocks', summary.blocks > 0 ? count(summary.blocks) : 'None'],
    [
      'Spatial layouts',
      summary.spatialLayouts > 0 ? count(summary.spatialLayouts) : 'None',
    ],
  ]
}

/**
 * A file input. With the page's script it is a button, and choosing a file
 * hands it to `onChoose`; with none it is the browser's own, which shows
 * what was chosen, and the file is sent with the form.
 */
function FilePick(props: {
  name: FileSlot
  label: string
  accept: string
  multiple?: boolean
  icon?: 'plus' | 'upload'
  disabled?: boolean
  onChoose: (input: HTMLInputElement, slot: FileSlot) => void
}) {
  const hydrated = createHydrated()
  return (
    <label
      class={
        hydrated()
          ? `${buttonGhost} h-[34px] cursor-pointer px-3 text-xs has-disabled:pointer-events-none has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:outline-accent`
          : 'contents'
      }
    >
      <Show when={hydrated()}>
        <Icon name={props.icon ?? 'upload'} />
        {props.label}
      </Show>
      <input
        type="file"
        // The script sends what it reads, so the input itself sends nothing.
        name={hydrated() ? undefined : props.name}
        accept={props.accept}
        multiple={props.multiple}
        disabled={props.disabled}
        aria-label={props.label}
        onChange={(event) => props.onChoose(event.currentTarget, props.name)}
        class={
          hydrated()
            ? 'sr-only'
            : 'max-w-full text-sm text-fg-2 file:mr-3 file:h-[34px] file:cursor-pointer file:border file:border-line-strong file:bg-transparent file:px-3 file:font-mono file:text-xs file:tracking-[0.08em] file:text-fg file:uppercase'
        }
      />
    </label>
  )
}

/**
 * A file the form holds: a ticked box, so what is sent is what is shown.
 * Unticking it takes it off the form; with no script it is struck through
 * and left behind when the form is sent.
 */
function HeldRow(props: {
  file: HeldFile
  onRemove: () => void
  children?: JSX.Element
}) {
  return (
    <div class={`${row} group not-has-checked:opacity-50`}>
      <span class={fileGlyph} aria-hidden="true">
        {fileGlyphs[props.file.kind]}
      </span>
      {/* At least this wide, so on a phone the controls go under it. */}
      <span class="min-w-[min(14rem,60%)] flex-1 truncate text-[15px] font-semibold group-not-has-checked:line-through">
        {props.file.filename}
      </span>
      <span class="font-mono text-xs text-fg-3">
        {formatBytes(props.file.sizeBytes)}
      </span>
      {props.children}
      <label class="grid size-8 cursor-pointer place-items-center border border-line text-fg-2 hover:border-line-strong hover:text-fg has-focus-visible:outline-2 has-focus-visible:outline-accent">
        <input
          type="checkbox"
          name="files"
          value={props.file.id}
          checked
          aria-label={`Keep ${props.file.filename}`}
          onChange={() => props.onRemove()}
          class="sr-only"
        />
        <Icon name="x" class="size-3.5" />
      </label>
    </div>
  )
}

/**
 * The files behind an experience: its Portal export, read into the form, and
 * files added beside it, such as a Godot scene. Each chosen file is held for
 * the form until it is sent; the form sends their ids as `files`.
 *
 * With the page's script a file is read as soon as it is chosen. With none,
 * "Upload files" sends the form to be read and shown again.
 */
export function ProjectFilesInput(props: {
  held: HeldFile[]
  errors: Record<string, string>
  /** Where the form is sent to read the files, with no script. */
  readUrl: string
  /** The names of files being read now, if any. */
  reading: string | null
  onChoose: (input: HTMLInputElement, slot: FileSlot) => void
  /**
   * What it was submitted with before, for one sent back. These stay unless
   * new files are chosen, which take their place.
   */
  submitted?: {
    id: string
    kind: HeldFile['kind']
    filename: string
    sizeBytes: number
  }[]
}) {
  const hydrated = createHydrated()
  // Taken off with the script. What is offered can change under it when the
  // form comes back with more files, so this is only what was taken off.
  const [removed, setRemoved] = createSignal<string[]>([])
  const shown = () => props.held.filter((file) => !removed().includes(file.id))
  const exported = () => shown().find((file) => file.kind === 'export')
  const added = () => shown().filter((file) => file.kind !== 'export')
  const remove = (id: string) => {
    if (hydrated()) setRemoved((list) => [...list, id])
  }
  const error = () =>
    props.errors.exportFile ?? props.errors.addedFiles ?? props.errors.files

  const submitted = () => props.submitted ?? []

  return (
    <div class="grid gap-2">
      <Show when={submitted().length > 0}>
        <div class={`${panel} divide-y divide-line`}>
          <p class="px-3 py-2.5 text-[13px] text-fg-2">
            <Show
              when={shown().length === 0}
              fallback={
                <>
                  <b class="font-semibold text-fg">Submitted before.</b> The
                  files chosen below take their place when it is resubmitted.
                </>
              }
            >
              <b class="font-semibold text-fg">Submitted with these.</b> They
              stay unless you choose new files below.
            </Show>
          </p>
          <For each={submitted()}>
            {(file) => (
              <div class={`${row} ${shown().length > 0 ? 'opacity-50' : ''}`}>
                <span class={fileGlyph} aria-hidden="true">
                  {fileGlyphs[file.kind]}
                </span>
                <span class="min-w-[min(14rem,60%)] flex-1 truncate text-[15px] font-semibold">
                  {file.filename}
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
              </div>
            )}
          </For>
        </div>
      </Show>
      <div class={`${panel} divide-y divide-line`}>
        <Show
          when={exported()}
          fallback={
            <div class={row}>
              <span
                class={`${fileGlyph} border-dashed bg-transparent`}
                aria-hidden="true"
              >
                JSON
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-[15px] font-semibold">Portal export</p>
                <p class="text-[13px] text-fg-3">
                  .json, up to {MAX_EXPORT_BYTES / MB} MB
                </p>
              </div>
              <FilePick
                name="exportFile"
                label="Upload export"
                accept=".json,application/json"
                disabled={props.reading !== null}
                onChoose={props.onChoose}
              />
            </div>
          }
        >
          {(file) => (
            <>
              <HeldRow file={file()} onRemove={() => remove(file().id)}>
                <span class="flex items-center gap-1 font-mono text-xs text-steel">
                  <Icon name="check" class="size-3.5" />
                  Read
                </span>
                <FilePick
                  name="exportFile"
                  label="Replace"
                  accept=".json,application/json"
                  disabled={props.reading !== null}
                  onChoose={props.onChoose}
                />
              </HeldRow>
              <Show when={file().summary}>
                {(summary) => (
                  <dl class="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3.5 sm:grid-cols-4">
                    <For each={facts(summary())}>
                      {([name, value]) => (
                        <div class="min-w-0">
                          <dt class={label}>{name}</dt>
                          <dd class="mt-0.5 truncate text-sm text-fg">
                            {value}
                          </dd>
                        </div>
                      )}
                    </For>
                  </dl>
                )}
              </Show>
            </>
          )}
        </Show>
        <For each={added()}>
          {(file) => <HeldRow file={file} onRemove={() => remove(file.id)} />}
        </For>
        <Show when={props.reading}>
          {(names) => (
            <p class={`${row} text-sm text-fg-2`} role="status">
              Uploading {names()}
            </p>
          )}
        </Show>
        <div class={row}>
          <FilePick
            name="addedFiles"
            label="Add files"
            accept={ADDED_FILE_TYPES.join(',')}
            multiple
            icon="plus"
            disabled={props.reading !== null}
            onChoose={props.onChoose}
          />
          <span class="ml-auto font-mono text-xs text-fg-3">
            Godot scenes and other {ADDED_FILE_TYPES.join(', ')} files, up to{' '}
            {MAX_FILE_BYTES / MB} MB each
          </span>
        </div>
      </div>
      <Show when={!hydrated()}>
        <div>
          <button
            type="submit"
            formaction={props.readUrl}
            formenctype="multipart/form-data"
            formnovalidate
            class={`${buttonGhost} h-[34px] px-3 text-xs`}
          >
            Upload files
          </button>
        </div>
      </Show>
      <FieldError message={error()} />
    </div>
  )
}
