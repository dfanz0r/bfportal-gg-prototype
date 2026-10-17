import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import { decideOnEdit, type EditReview } from '../functions/moderation'
import type { DecisionSearch } from '../shared/decision'
import { gameInfo } from '../shared/games'
import { Avatar } from './avatar'
import { DateText } from './date-text'
import { DecisionForm } from './decision-form'
import { PageLayout } from './page-layout'
import { ProjectFileList } from './project-file-list'
import { buttonGhost, label, panel } from './ui'

const columns =
  'grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]'

/** Reviewing an edit to a live experience: each change beside what is live. */
export function AdminEdit(props: {
  data: EditReview
  /** What a decision posted with no script and refused brought back. */
  decision: DecisionSearch
}) {
  const edit = () => props.data.edit
  const experience = () => edit().experience

  return (
    <PageLayout
      title={experience().title}
      lead={`An edit to a live ${gameInfo(experience().game).name} experience.`}
      actions={
        <>
          <a href={`/experiences/${experience().slug}`} class={buttonGhost}>
            See its page
          </a>
          <Link to="/admin" class={buttonGhost}>
            Back to the queue
          </Link>
        </>
      }
    >
      <div
        class="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_380px] min-[1100px]:gap-10"
        data-game={experience().game}
      >
        <div class="grid min-w-0 gap-6">
          <div class={`${panel} divide-y divide-line`}>
            <div class={`${columns} max-sm:hidden`}>
              <span class={label}>Field</span>
              <span class={label}>Live now</span>
              <span class={label}>Proposed</span>
            </div>
            <For each={edit().changes}>
              {(change) => (
                <div class={`${columns} text-sm`}>
                  <span class="font-semibold">{change.field}</span>
                  <span class="text-fg-2">
                    <span class="text-fg-3 sm:hidden">Live now: </span>
                    {change.live}
                  </span>
                  <span class="text-fg">
                    <span class="text-fg-3 sm:hidden">Proposed: </span>
                    {change.proposed}
                  </span>
                </div>
              )}
            </For>
          </div>
          {/* As they are now: the change above says what approving does. */}
          <ProjectFileList
            files={edit().files}
            isTemplate={experience().isTemplate}
          />
          <Show when={experience().filesUrl}>
            {(url) => (
              <p class="text-sm">
                <span class="text-fg-3">Larger files: </span>
                <a
                  href={url()}
                  rel="noopener noreferrer"
                  class="text-steel-hi underline [overflow-wrap:anywhere]"
                >
                  {url()}
                </a>
              </p>
            )}
          </Show>
        </div>

        <aside class="grid gap-4">
          <DecisionForm
            decide={decideOnEdit}
            id={edit().id}
            back={`/admin/edits/${edit().id}`}
            problem={props.decision.problem}
            note={props.decision.note}
            hint="Approving changes the live page. Requesting changes needs a note, which its owner sees on the page."
          />
          <div class={`${panel} p-5`}>
            <h2 class={`${label} mb-3`}>Asked for by</h2>
            <p class="flex items-center gap-2.5 text-sm">
              <Avatar
                name={edit().submitter.name}
                image={edit().submitter.image}
                class="size-7"
              />
              <span class="font-semibold">{edit().submitter.name}</span>
              <span class="ml-auto font-mono text-xs text-fg-3">
                <DateText value={edit().submittedAt} now={props.data.now} />
              </span>
            </p>
          </div>
        </aside>
      </div>
    </PageLayout>
  )
}
