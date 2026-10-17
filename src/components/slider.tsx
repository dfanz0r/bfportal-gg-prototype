import { createEffect, createSignal, on } from 'solid-js'

import { Icon, type IconName } from './icon'

/**
 * A number chosen by dragging or typed, drawn as the Portal editor draws its
 * settings: an icon for what it counts, a thin line with a bar to drag, and
 * the number beside it. `label` names it for screen readers; the page shows
 * its name around it. The typed number is the field the form sends, so with
 * no script it can still be typed; the slider is the script's.
 */
export function Slider(props: {
  id: string
  name: string
  label: string
  icon: IconName
  min: number
  max: number
  value: number
  /** Told each time the number changes. */
  onValue?: (value: number) => void
}) {
  const [value, setValue] = createSignal(props.value)
  // What it starts on can change under it, as going to the other game's form
  // does, and both follow.
  createEffect(on(() => props.value, setValue, { defer: true }))
  createEffect(on(value, (now) => props.onValue?.(now), { defer: true }))
  const held = (typed: number) =>
    Math.min(Math.max(Math.round(typed), props.min), props.max)

  return (
    <div class="flex min-w-0 items-center gap-2">
      <Icon name={props.icon} class="size-4 shrink-0 text-fg-3" />
      <div class="flex min-w-0 flex-1 items-center border border-line-strong bg-base px-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
        {/* No name: the number beside it is what is sent. */}
        <input
          type="range"
          aria-label={props.label}
          min={props.min}
          max={props.max}
          value={value()}
          onInput={(event) => setValue(Number(event.currentTarget.value))}
          class="range w-full"
        />
      </div>
      <input
        id={props.id}
        name={props.name}
        type="number"
        inputmode="numeric"
        aria-label={props.label}
        min={props.min}
        max={props.max}
        value={value()}
        // While typing, the slider follows any number in its range. A number
        // outside it, or none, is set right once typing is done.
        onInput={(event) => {
          const typed = event.currentTarget.valueAsNumber
          if (typed >= props.min && typed <= props.max) setValue(typed)
        }}
        onChange={(event) => {
          const typed = event.currentTarget.valueAsNumber
          const kept = Number.isNaN(typed) ? value() : held(typed)
          event.currentTarget.value = String(kept)
          setValue(kept)
          // The form reads what it holds as it is typed in; it has changed.
          event.currentTarget.dispatchEvent(
            new Event('input', { bubbles: true }),
          )
        }}
        class="w-14 shrink-0 [appearance:textfield] border border-line-strong bg-base py-1.5 text-center font-mono text-sm text-fg outline-none focus:border-steel [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  )
}
