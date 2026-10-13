import { createFileRoute, notFound, redirect } from '@tanstack/solid-router'
import { For } from 'solid-js'

import { PageLayout } from '../components/page-layout'
import { body, display } from '../components/ui'
import { getSessionUser } from '../functions/session'
import { pageTitle } from '../shared/page-title'
import { isStaff } from '../shared/roles'

const PLANNED = [
  'One review queue for new submissions, edits, update posts and playtests.',
  'Reports, with the flags an experience carries now.',
  'The experience list, with featured and trending for admins.',
  'Tags, categories, users and settings.',
]

export const Route = createFileRoute('/admin')({
  // Keeps the page away from everyone else. It protects nothing by itself:
  // each server function behind an admin screen checks the role again.
  beforeLoad: async () => {
    const user = await getSessionUser()
    if (!user) {
      throw redirect({ href: '/login' })
    }
    if (!isStaff(user.role)) {
      throw notFound()
    }
    return { user }
  },
  head: () => pageTitle('Moderation'),
  component: AdminPage,
})

function AdminPage() {
  const context = Route.useRouteContext()

  return (
    <PageLayout
      title="Moderation"
      lead={`Signed in as ${context().user.name}, ${context().user.role}.`}
    >
      <h2 class={`${display} text-3xl leading-none`}>
        The moderation screens are not built yet
      </h2>
      <p class={`${body} mt-4`}>What will be here:</p>
      <ul
        class={`${body} mt-3 grid list-[square] gap-1.5 pl-5 marker:text-accent`}
      >
        <For each={PLANNED}>{(item) => <li>{item}</li>}</For>
      </ul>
    </PageLayout>
  )
}
