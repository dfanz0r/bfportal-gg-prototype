import {
  browserTimeZone,
  formatAgo,
  formatDate,
  formatDateTime,
} from '../../shared/dates'
import { createHydrated } from './hydrated'

/**
 * A date. The server writes it in UTC; once the page's script is running it
 * switches to the visitor's own time zone. Given `now`, the time the page's
 * data was read, something from the last week is written as "5 hours ago".
 */
export function DateText(props: { value: Date; now?: Date }) {
  const hydrated = createHydrated()
  const zone = () => (hydrated() ? browserTimeZone() : 'UTC')
  const ago = () => (props.now ? formatAgo(props.value, props.now) : null)

  return (
    <time
      datetime={props.value.toISOString()}
      title={formatDateTime(props.value, zone())}
    >
      {ago() ?? formatDate(props.value, zone())}
    </time>
  )
}
