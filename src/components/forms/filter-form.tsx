import { useNavigate } from '@tanstack/solid-router'
import type { JSX } from 'solid-js'
import type { z } from 'zod'

import { formFields } from '../../shared/form-input'

/**
 * A row of filters for the page it is on: a GET form, read through the
 * route's own search schema and applied as it changes. What a field leaves
 * empty is left out of the address.
 */
export function FilterForm(props: {
  schema: z.ZodType
  class?: string
  children: JSX.Element
}) {
  const navigate = useNavigate()
  const apply = (event: Event & { currentTarget: HTMLFormElement }) => {
    event.preventDefault()
    const search = props.schema.parse(
      formFields(new FormData(event.currentTarget)),
    )
    void navigate({ to: '.', search: search as never, resetScroll: false })
  }
  return (
    <form
      method="get"
      onChange={apply}
      onSubmit={apply}
      aria-label="Filters"
      class={props.class}
    >
      {props.children}
    </form>
  )
}
