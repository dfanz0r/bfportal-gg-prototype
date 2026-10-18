import { For, Show } from 'solid-js'

import {
  type Taxonomy,
  writeTag,
  writeTagGroup,
} from '../../functions/admin-taxonomy'
import type { Game } from '../../shared/content'
import { PostForm } from '../ui/post-form'
import { buttonGhost, fieldCompact, filterSelect, label, panel } from '../ui/ui'
import { Box } from './box'
import { MoveButtons } from './move-buttons'
import { TagGroupFields } from './tag-group-fields'

type Group = Taxonomy['groups'][number]

const save = `${buttonGhost} h-[34px] px-3 text-xs`

/**
 * One tag group: its settings, its tags each changed in place, and a row to
 * add a tag to it. A tag moves to another of the game's groups by its menu.
 */
export function TagGroupPanel(props: {
  group: Group
  groups: Group[]
  game: Game
  first: boolean
  last: boolean
}) {
  const tags = () => props.group.tags
  return (
    <section class={`${panel} p-4`} aria-label={props.group.name}>
      <div class="flex items-start gap-3">
        <PostForm action={writeTagGroup} class="grid min-w-0 flex-1 gap-2">
          <input type="hidden" name="id" value={props.group.id} />
          <TagGroupFields group={props.group} />
        </PostForm>
        <MoveButtons
          what="tag-group"
          id={props.group.id}
          name={props.group.name}
          first={props.first}
          last={props.last}
        />
      </div>

      <h3 class={`${label} mt-5 mb-1`}>Tags</h3>
      <ul class="border-t border-line">
        <For each={tags()}>
          {(item, index) => (
            <li class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-2">
              <PostForm
                action={writeTag}
                class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2"
                aria-label={item.name}
              >
                <input type="hidden" name="id" value={item.id} />
                <input
                  name="name"
                  value={item.name}
                  required
                  minlength={2}
                  maxlength={60}
                  aria-label="Name"
                  class={`${fieldCompact} w-48`}
                />
                <Box name="visible" checked={item.visible}>
                  Shown
                </Box>
                <select
                  name="groupId"
                  aria-label="Group"
                  class={`${filterSelect} h-[34px] border border-line-strong px-2 text-fg`}
                >
                  <For each={props.groups}>
                    {(group) => (
                      <option
                        value={group.id}
                        selected={group.id === props.group.id}
                      >
                        {group.name}
                      </option>
                    )}
                  </For>
                </select>
                <button type="submit" class={save}>
                  Save
                </button>
              </PostForm>
              <span class="font-mono text-xs text-fg-3">
                {item.used} using it
                <Show when={item.portalId}> · from Portal</Show>
              </span>
              <MoveButtons
                what="tag"
                id={item.id}
                name={item.name}
                first={index() === 0}
                last={index() === tags().length - 1}
              />
            </li>
          )}
        </For>
        <li class="pt-3">
          <PostForm
            action={writeTag}
            reset
            class="flex flex-wrap items-center gap-x-4 gap-y-2"
            aria-label={`New tag in ${props.group.name}`}
          >
            <input type="hidden" name="game" value={props.game} />
            <input type="hidden" name="groupId" value={props.group.id} />
            <input
              name="name"
              required
              minlength={2}
              maxlength={60}
              placeholder="New tag"
              aria-label={`Name of a new tag in ${props.group.name}`}
              class={`${fieldCompact} w-48`}
            />
            <Box name="visible" checked>
              Shown
            </Box>
            <button type="submit" class={save}>
              Add
            </button>
          </PostForm>
        </li>
      </ul>
    </section>
  )
}
