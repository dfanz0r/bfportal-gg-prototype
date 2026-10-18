import { For, Show } from 'solid-js'

import { type Taxonomy, writeTagGroup } from '../functions/admin-taxonomy'
import { defaultGame, gameInfo, gameList } from '../shared/games'
import { CategoryList } from './admin-categories/category-list'
import { TagGroupFields } from './admin-categories/tag-group-fields'
import { TagGroupPanel } from './admin-categories/tag-group-panel'
import { PageHead } from './layout/page-head'
import { Section } from './layout/section'
import { PostForm } from './ui/post-form'
import { Tabs } from './ui/tabs'
import { panel } from './ui/ui'

/**
 * A game's categories, tag groups and tags, each changed where it is listed.
 * Nothing is deleted: what is no longer wanted is hidden, since experiences
 * point at it.
 */
export function AdminCategories(props: { data: Taxonomy }) {
  const data = () => props.data
  const groups = () => data().groups

  return (
    <>
      <PageHead
        bare
        title="Categories and tags"
        lead="What each game's experiences are sorted by. Hide what is no longer wanted; nothing here is deleted. A renamed one keeps its address."
      />
      <Tabs
        label="Games"
        items={gameList.map((game) => ({
          name: game.name,
          href:
            game.id === defaultGame.id
              ? '/admin/categories'
              : `/admin/categories?game=${game.id}`,
          current: data().game === game.id,
        }))}
      />

      <Section
        title="Categories"
        note={`Every ${gameInfo(data().game).name} experience has one.`}
      >
        <CategoryList
          kind="experience_main"
          game={data().game}
          rows={data().experienceCategories}
        />
      </Section>

      <Show when={gameInfo(data().game).snippets === true}>
        <Section title="Snippet categories">
          <CategoryList
            kind="script_main"
            game={data().game}
            rows={data().snippetCategories}
          />
        </Section>
      </Show>

      <Section title="Tags" note="In groups, each with its own settings.">
        <div class="grid gap-4">
          <For each={groups()}>
            {(group, index) => (
              <TagGroupPanel
                group={group}
                groups={groups()}
                game={data().game}
                first={index() === 0}
                last={index() === groups().length - 1}
              />
            )}
          </For>
          <PostForm
            action={writeTagGroup}
            reset
            class={`${panel} grid gap-2 border-dashed p-4`}
            aria-label="New tag group"
          >
            <input type="hidden" name="game" value={data().game} />
            <TagGroupFields />
          </PostForm>
        </div>
      </Section>
    </>
  )
}
