import { browserTimeZone, formatDayAndMonth } from '../../shared/dates'
import { createHydrated } from './hydrated'

/**
 * A date as a small block, the day over the month, for something that
 * happens on a day. Like `DateText`, the server writes it in UTC and it moves
 * to the visitor's time zone once the page is running.
 */
export function DateBlock(props: { value: Date }) {
  const hydrated = createHydrated()
  const parts = () =>
    formatDayAndMonth(props.value, hydrated() ? browserTimeZone() : 'UTC')

  return (
    <time
      datetime={props.value.toISOString()}
      class="grid w-11 shrink-0 justify-items-center border border-line-strong bg-base px-1 pt-1.5 pb-1"
    >
      <b class="font-display text-2xl leading-none font-bold text-fg">
        {parts().day}
      </b>
      <span class="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-accent uppercase">
        {parts().month}
      </span>
    </time>
  )
}
