import { createFileRoute } from '@tanstack/solid-router'
import { For } from 'solid-js'

import { PageLayout } from '../components/layout/page-layout'
import { body } from '../components/ui/ui'
import { disclaimer, eaContentPolicyUrl } from '../shared/legal'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/disclaimer')({
  head: () => pageTitle('Disclaimer'),
  component: DisclaimerPage,
})

function DisclaimerPage() {
  return (
    <PageLayout
      title="Disclaimer"
      lead="bfportal.gg is a fan site, made by the community and not by Electronic Arts."
    >
      <div class={`${body} grid gap-4`}>
        <For each={disclaimer}>{(paragraph) => <p>{paragraph}</p>}</For>
        <p>
          Electronic Arts sets out how fans may use its game content in its{' '}
          <a href={eaContentPolicyUrl} class="text-fg underline">
            content policy
          </a>
          .
        </p>
      </div>
    </PageLayout>
  )
}
