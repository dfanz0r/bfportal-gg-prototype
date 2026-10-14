import type { JSX } from 'solid-js'

import { type Crumb, PageHead } from './page-head'

/** A page with the standard head band and its content in the column. */
export function PageLayout(props: {
  title: string
  lead?: string
  crumbs?: Crumb[]
  meta?: JSX.Element
  actions?: JSX.Element
  children?: JSX.Element
}) {
  return (
    <main id="content">
      <PageHead
        title={props.title}
        lead={props.lead}
        crumbs={props.crumbs}
        meta={props.meta}
        actions={props.actions}
      />
      <div class="wrap py-8">{props.children}</div>
    </main>
  )
}
