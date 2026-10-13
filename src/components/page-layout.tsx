import type { JSX } from 'solid-js'

import { PageHead } from './page-head'

/** A page with the standard head band and its content in the column. */
export function PageLayout(props: {
  title: string
  lead?: string
  actions?: JSX.Element
  children?: JSX.Element
}) {
  return (
    <main id="content">
      <PageHead title={props.title} lead={props.lead} actions={props.actions} />
      <div class="wrap py-8">{props.children}</div>
    </main>
  )
}
