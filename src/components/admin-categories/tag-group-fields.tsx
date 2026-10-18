import { For } from 'solid-js'

import type { Taxonomy } from '../../functions/admin-taxonomy'
import {
  tagGroupFilterLabels,
  tagGroupFilters,
  tagGroupPickLabels,
  tagGroupPicks,
} from '../../shared/content'
import { buttonGhost, fieldCompact, filterSelect } from '../ui/ui'
import { Box } from './box'

type Group = Taxonomy['groups'][number]

const select = `${filterSelect} h-[34px] border border-line-strong px-2 text-fg`

/**
 * A tag group's settings, as fields: for a group being changed, or empty for
 * one being added.
 */
export function TagGroupFields(props: { group?: Group }) {
  return (
    <>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          name="name"
          value={props.group?.name ?? ''}
          required
          minlength={2}
          maxlength={60}
          placeholder={props.group ? undefined : 'New tag group'}
          aria-label="Name of the group"
          class={`${fieldCompact} w-56 font-semibold`}
        />
        <label class="inline-flex items-center gap-2 text-[13.5px] text-fg-2">
          In the Library
          <select name="filter" class={select}>
            <For each={tagGroupFilters}>
              {(filter) => (
                <option
                  value={filter}
                  selected={(props.group?.filter ?? 'shared') === filter}
                >
                  {tagGroupFilterLabels[filter]}
                </option>
              )}
            </For>
          </select>
        </label>
        <label class="inline-flex items-center gap-2 text-[13.5px] text-fg-2">
          Tags per experience
          <select name="pick" class={select}>
            <For each={tagGroupPicks}>
              {(pick) => (
                <option
                  value={pick}
                  selected={(props.group?.pick ?? 'any') === pick}
                >
                  {tagGroupPickLabels[pick]}
                </option>
              )}
            </For>
          </select>
        </label>
      </div>
      <input
        name="description"
        value={props.group?.description ?? ''}
        maxlength={300}
        placeholder="What the group is for, in a line"
        aria-label="Description"
        class={`${fieldCompact} w-full max-w-[640px]`}
      />
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Box
          name="creatorSelectable"
          checked={props.group?.creatorSelectable ?? true}
        >
          Creators choose these
        </Box>
        <Box name="showOnCard" checked={props.group?.showOnCard ?? false}>
          Shown on cards
        </Box>
        <button type="submit" class={`${buttonGhost} h-[34px] px-3 text-xs`}>
          {props.group ? 'Save' : 'Add group'}
        </button>
      </div>
    </>
  )
}
