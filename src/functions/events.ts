import { createServerFn } from '@tanstack/solid-start'

import { countEvents, listEvents } from '../server/services/events'
import { eventsSearchSchema } from '../shared/feed-search'

/** Events to come, or past ones, with how many there are of each. */
export const fetchEvents = createServerFn({ method: 'GET' })
  .validator(eventsSearchSchema)
  .handler(async ({ data }) => {
    const now = new Date()
    const when = data.when ?? ('upcoming' as const)
    const [list, counts] = await Promise.all([
      listEvents({ when, limit: 50 }, now),
      countEvents(now),
    ])
    return { items: list.items, counts, when }
  })

export type Events = Awaited<ReturnType<typeof fetchEvents>>
export type EventItem = Events['items'][number]
