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
  'grid gap-x-6 gap-y-1 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]'

/**
 * Reviewing an edit to a live experience: each change beside what is live,
 * and what approving it does. The page is named for the edit, not the
 * experience, so it is not taken for a new submission.
 */
export function AdminEdit(props: {
  data: EditReview
  /** What a decision posted with no script and refused brought back. */
  decision: DecisionSearch
}) {
  const edit = () => props.data.edit
  const experience = () => edit().experience
  const count = () =>
    edit().changes.length === 1
      ? '1 change'
      : `${edit().changes.length} changes`

  return (
    <PageLayout
      title={`Edit to ${experience().title}`}
      lead={`Its owner asks to change this live ${gameInfo(experience().game).name} experience. The live page stays as it is until you approve.`}
      crumbs={[
        { label: 'Review queue', href: '/admin' },
        { label: 'Edit to a live experience' },
      ]}
      meta={
        <span class="inline-flex items-center gap-2">
          Asked for by
          <Avatar
            name={edit().submitter.name}
            image={edit().submitter.image}
            class="size-5 text-[9px]"
          />
          <span class="text-fg">{edit().submitter.name}</span>
          <DateText value={edit().submittedAt} now={props.data.now} />
        </span>
      }
      actions={
        <>
          <a href={`/experiences/${experience().slug}`} class={buttonGhost}>
            See the live page
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
          <section>
            <h2 class={`${label} mb-2 flex justify-between gap-4`}>
              What changes
              <span>{count()}</span>
            </h2>
            <div class={`${panel} divide-y divide-line`}>
              <div class={`${columns} px-4 py-3 max-sm:hidden`}>
                <span class={label}>Field</span>
                <span class={label}>Live now</span>
                <span class={label}>Once approved</span>
              </div>
              <For
                each={edit().changes}
                fallback={
                  <p class="px-4 py-3.5 text-sm text-fg-2">
                    It asks for nothing that differs from the live page.
                  </p>
                }
              >
                {(change) => (
                  <div class="grid gap-2 px-4 py-3.5 text-sm">
                    <div class={columns}>
                      <span class="font-semibold">{change.field}</span>
                      <span
                        class={`text-fg-2 [overflow-wrap:anywhere] ${change.long ? 'whitespace-pre-wrap' : ''}`}
                      >
                        <span class="text-fg-3 sm:hidden">Live now: </span>
                        {change.live}
                      </span>
                      <span
                        class={`font-semibold text-steel-hi [overflow-wrap:anywhere] ${change.long ? 'whitespace-pre-wrap' : ''}`}
                      >
                        <span class="font-normal text-fg-3 sm:hidden">
                          Once approved:{' '}
                        </span>
                        {change.proposed}
                      </span>
                    </div>
                    <Show when={change.effect}>
                      <p class="border-l-2 border-steel bg-steel/8 px-3 py-2 text-[13px] text-fg-2">
                        {change.effect}
                      </p>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <p class="mt-2 text-[13px] text-fg-3">
              <Show
                when={edit().unchanged.length > 0}
                fallback="Nothing else on its page changes."
              >
                Unchanged: {edit().unchanged.join(', ')}. Nothing else on its
                page changes.
              </Show>
            </p>
          </section>
          <ProjectFileList
            files={edit().files}
            isTemplate={experience().isTemplate}
            becomePublic={edit().offersFiles}
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
            version={edit().version}
            back={`/admin/edits/${edit().id}`}
            problem={props.decision.problem}
            note={props.decision.note}
            hint="Approving applies this edit to the live page. Requesting changes leaves the page as it is and needs a note, which its owner sees."
          />
        </aside>
      </div>
    </PageLayout>
  )
}
