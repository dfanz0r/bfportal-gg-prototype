import { createSignal, onCleanup } from 'solid-js'

/**
 * Copying to the clipboard, with a `copied` signal that stays true for a
 * moment afterwards so a button can say so.
 */
export function createCopy() {
  const [copied, setCopied] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timer)
      timer = setTimeout(() => setCopied(false), 1500)
    } catch {
      // No clipboard access. What was to be copied is on the page to select.
    }
  }
  return { copied, copy }
}
