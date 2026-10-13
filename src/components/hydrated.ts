import { createSignal, onMount } from 'solid-js'

/**
 * False while the server renders and while the browser first matches what the
 * server sent; true once the page is running. For the few things that may
 * only differ from the server's HTML after that, such as a time zone.
 */
export function createHydrated() {
  const [hydrated, setHydrated] = createSignal(false)
  onMount(() => setHydrated(true))
  return hydrated
}
