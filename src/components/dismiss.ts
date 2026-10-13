import { useRouter } from '@tanstack/solid-router'
import { onCleanup, onMount } from 'solid-js'

/**
 * Makes a `<details>` menu close itself: when a link inside it is followed,
 * when the page changes, when Escape is pressed, and on a click outside it.
 * Returns the `ref` for the `<details>`.
 *
 * The header outlives a page change, so without this an open menu would stay
 * open on top of the next page.
 *
 * `staysOpen` is for a menu of choices that each change the page, such as a
 * list of filters: it closes on Escape and on a click outside, and stays open
 * while someone is still choosing.
 */
export function createDismiss(options: { staysOpen?: boolean } = {}) {
  let details: HTMLDetailsElement | undefined
  const router = useRouter()

  onMount(() => {
    const close = () => {
      if (details) {
        details.open = false
      }
    }
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!details?.open) {
        return
      }
      const inside = details.contains(target)
      // Following a link in the menu closes it; so does a click elsewhere.
      if (!inside || (!options.staysOpen && target?.closest('a'))) {
        close()
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details?.open) {
        close()
        details.querySelector('summary')?.focus()
      }
    }

    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    // Back and forward change the page without a click.
    const unsubscribe = options.staysOpen
      ? () => {}
      : router.subscribe('onResolved', close)
    onCleanup(() => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
      unsubscribe()
    })
  })

  return (element: HTMLDetailsElement) => {
    details = element
  }
}
