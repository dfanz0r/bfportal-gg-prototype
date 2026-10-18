import { For, Show } from 'solid-js'

import type { Taxonomy } from '../../functions/admin-taxonomy'
import { writeCategory } from '../../functions/admin-taxonomy'
import type { Game } from '../../shared/content'
import { gameInfo } from '../../shared/games'
import { PostForm } from '../ui/post-form'
import { buttonGhost, fieldCompact, filterSelect, tag } from '../ui/ui'
import { Box } from './box'
import { MoveButtons } from './move-buttons'

type Category = Taxonomy['experienceCategories'][number]

const save = `${buttonGhost} h-[34px] px-3 text-xs`

/**
 * One kind of category, each changed in place and moved in order, and a row
 * to add one. Only an experience's category can mark it a template, and only
 * an experience's can be every game's.
 */
export function CategoryList(props: {
  kind: 'experience_main' | 'script_main'
  game: Game
  rows: Category[]
}) {
  const forExperiences = () => props.kind === 'experience_main'
  return (
    <ul class="border-t border-line">
      <For each={props.rows}>
        {(row, index) => (
          <li class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-2.5">
            <PostForm
              action={writeCategory}
              class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2"
              aria-label={row.name}
            >
              <input type="hidden" name="id" value={row.id} />
              <input
                name="name"
                value={row.name}
                required
                minlength={2}
                maxlength={60}
                aria-label="Name"
                class={`${fieldCompact} w-56`}
              />
              <Box name="visible" checked={row.visible}>
                Shown
              </Box>
              <Box name="selectableOnForm" checked={row.selectableOnForm}>
                On the form
              </Box>
              <Show when={forExperiences()}>
                <Box name="marksTemplate" checked={row.marksTemplate}>
                  Marks a template
                </Box>
              </Show>
              <button type="submit" class={save}>
                Save
              </button>
            </PostForm>
            <Show when={row.game === null}>
              <span class={`${tag} border-steel/40 text-steel-hi`}>
                Every game
              </span>
            </Show>
            <span class="font-mono text-xs text-fg-3">
              /{row.slug} · {row.used} using it
            </span>
            <MoveButtons
              what="category"
              id={row.id}
              name={row.name}
              game={props.game}
              first={index() === 0}
              last={index() === props.rows.length - 1}
            />
          </li>
        )}
      </For>
      <li class="py-3">
        <PostForm
          action={writeCategory}
          reset
          class="flex flex-wrap items-center gap-x-4 gap-y-2"
          aria-label="New category"
        >
          <input type="hidden" name="kind" value={props.kind} />
          <input
            name="name"
            required
            minlength={2}
            maxlength={60}
            placeholder="New category"
            aria-label="Name of a new category"
            class={`${fieldCompact} w-56`}
          />
          <Show
            when={forExperiences()}
            fallback={<input type="hidden" name="game" value={props.game} />}
          >
            <select
              name="game"
              aria-label="Which games"
              class={`${filterSelect} h-[34px] border border-line-strong px-2 text-fg`}
            >
              <option value={props.game}>{gameInfo(props.game).name}</option>
              <option value="all">Every game</option>
            </select>
          </Show>
          <Box name="visible" checked>
            Shown
          </Box>
          <Box name="selectableOnForm" checked>
            On the form
          </Box>
          <Show when={forExperiences()}>
            <Box name="marksTemplate" checked={false}>
              Marks a template
            </Box>
          </Show>
          <button type="submit" class={save}>
            Add
          </button>
        </PostForm>
      </li>
    </ul>
  )
}
