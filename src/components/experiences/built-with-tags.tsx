import { For, Show } from 'solid-js'

import {
  type ExperienceType,
  experienceTypeLabels,
  type Game,
} from '../../shared/content'
import { LibraryLink } from '../library/library-link'
import { Icon, type IconName } from '../ui/icon'
import { tag } from '../ui/ui'

const TYPE_ICONS: Partial<Record<ExperienceType, IconName>> = {
  script: 'code',
  blocks: 'box',
  spatial: 'map-pin',
}

const strong = `${tag} border-steel/40 text-steel-hi hover:border-steel hover:text-fg`

/**
 * What an experience is built with, and whether it is a template, as list
 * items that each link to the Library filtered the same way. Put them inside
 * a `<ul>`.
 */
export function BuiltWithTags(props: {
  game: Game
  types: ExperienceType[]
  isTemplate: boolean
}) {
  return (
    <>
      <For each={props.types}>
        {(type) => (
          <li>
            <LibraryLink
              game={props.game}
              search={{ built: [type] }}
              class={strong}
            >
              <Show when={TYPE_ICONS[type]}>
                {(icon) => <Icon name={icon()} class="size-3" />}
              </Show>
              {experienceTypeLabels[type]}
            </LibraryLink>
          </li>
        )}
      </For>
      <Show when={props.isTemplate}>
        <li>
          <LibraryLink
            game={props.game}
            search={{ templates: true }}
            class={strong}
          >
            <Icon name="layers" class="size-3" />
            Template
          </LibraryLink>
        </li>
      </Show>
    </>
  )
}
