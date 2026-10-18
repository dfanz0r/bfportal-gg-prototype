import { createSignal, For, onCleanup, Show } from 'solid-js'

import { type FoundPerson, searchPeople } from '../../functions/people'
import { Avatar } from '../ui/avatar'
import { Icon } from '../ui/icon'
import { field } from '../ui/ui'

type Option =
  | { kind: 'account'; person: FoundPerson }
  | { kind: 'name'; name: string }

const sameName = (one: string, other: string) =>
  one.toLocaleLowerCase() === other.toLocaleLowerCase()

/** A credit chosen: a ticked box, so what is sent is what is shown. */
const chip =
  'relative inline-flex h-7 cursor-pointer items-center gap-1.5 border border-line-strong bg-surface-2 pr-1.5 text-sm text-fg hover:border-steel has-focus-visible:outline-2 has-focus-visible:outline-accent not-has-checked:line-through not-has-checked:opacity-50'

/**
 * The people to credit: accounts here, chosen from a list that searches as a
 * name is typed, and names of anyone else. Each is a ticked box that sends
 * `creditAccounts` (a Discord id) or `credits` (a name).
 *
 * The search is the script's. With no script, what is typed in the box is
 * sent as a name, and a chosen one is taken off by unticking it.
 */
export function CreditsInput(props: {
  id: string
  names: string[]
  accounts: FoundPerson[]
  max: number
}) {
  const [accounts, setAccounts] = createSignal(props.accounts)
  const [names, setNames] = createSignal(props.names)
  const [text, setText] = createSignal('')
  const [found, setFound] = createSignal<FoundPerson[]>([])
  const [open, setOpen] = createSignal(false)
  const [active, setActive] = createSignal(0)
  const full = () => accounts().length + names().length >= props.max
  const typed = () => text().trim()
  const listId = `${props.id}-people`

  /** Accounts not chosen yet, then what was typed, as a name. */
  const options = (): Option[] => [
    ...found()
      .filter(
        (person) =>
          !accounts().some((chosen) => chosen.discordId === person.discordId),
      )
      .map((person) => ({ kind: 'account' as const, person })),
    ...(typed() && !names().some((name) => sameName(name, typed()))
      ? [{ kind: 'name' as const, name: typed() }]
      : []),
  ]
  const showing = () => open() && options().length > 0

  let timer: ReturnType<typeof setTimeout> | undefined
  // Answers can come back out of order. Only the last question's counts.
  let asked = 0
  const search = (value: string) => {
    clearTimeout(timer)
    const mine = ++asked
    const query = value.trim()
    if (query.length < 2) {
      setFound([])
      return
    }
    timer = setTimeout(async () => {
      try {
        const answer = await searchPeople({ data: { query } })
        if (mine === asked) setFound(answer.ok ? answer.people : [])
      } catch {
        // No list this time. The text can still be added as a name.
        if (mine === asked) setFound([])
      }
    }, 200)
  }
  onCleanup(() => clearTimeout(timer))

  const choose = (option: Option) => {
    if (full()) return
    if (option.kind === 'account') {
      setAccounts((list) => [...list, option.person])
    } else {
      setNames((list) => [...list, option.name])
    }
    asked += 1
    setText('')
    setFound([])
    setActive(0)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const count = options().length
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault()
      setActive(open() ? Math.min(active() + 1, count - 1) : 0)
      setOpen(true)
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault()
      setActive(Math.max(active() - 1, 0))
    } else if (event.key === 'Escape' && showing()) {
      event.preventDefault()
      setOpen(false)
    } else if (event.key === 'Enter' && typed()) {
      // Enter adds the one picked, and does not send the form.
      event.preventDefault()
      const option = showing() ? options()[active()] : options().at(-1)
      if (option) choose(option)
    }
  }

  return (
    <div class="relative">
      <div
        class={`${field} flex flex-wrap items-center gap-1.5 py-1.5 focus-within:border-steel`}
      >
        <For each={accounts()}>
          {(person) => (
            <label class={chip}>
              <input
                type="checkbox"
                name="creditAccounts"
                value={person.discordId}
                checked
                onChange={() =>
                  setAccounts((list) =>
                    list.filter((item) => item.discordId !== person.discordId),
                  )
                }
                class="sr-only"
              />
              <Avatar name={person.name} image={person.image} class="size-7" />
              {person.name}
              <Icon name="x" class="size-3.5 text-fg-3" />
            </label>
          )}
        </For>
        <For each={names()}>
          {(name) => (
            <label class={`${chip} border-dashed pl-2`}>
              <input
                type="checkbox"
                name="credits"
                value={name}
                checked
                onChange={() =>
                  setNames((list) => list.filter((item) => item !== name))
                }
                class="sr-only"
              />
              {name}
              <Icon name="x" class="size-3.5 text-fg-3" />
            </label>
          )}
        </For>
        <input
          id={props.id}
          name="credits"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showing()}
          aria-controls={listId}
          aria-activedescendant={
            showing() ? `${listId}-${active()}` : undefined
          }
          autocomplete="off"
          maxlength={60}
          disabled={full()}
          placeholder={full() ? `Up to ${props.max}` : 'Type a name'}
          value={text()}
          onInput={(event) => {
            setText(event.currentTarget.value)
            setActive(0)
            setOpen(true)
            search(event.currentTarget.value)
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          class="h-7 min-w-[12ch] flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
        />
      </div>
      <Show when={showing()}>
        <div
          id={listId}
          role="listbox"
          aria-label="People to credit"
          class="absolute inset-x-0 top-full z-20 mt-1 grid border border-line-strong bg-surface-1 py-1 shadow-lg"
        >
          <For each={options()}>
            {(option, index) => (
              // Focus stays in the box, which names the option picked. A
              // press is taken before the box loses focus, which would
              // close the list first.
              <div
                id={`${listId}-${index()}`}
                role="option"
                tabIndex={-1}
                aria-selected={index() === active()}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(option)
                }}
                onMouseMove={() => setActive(index())}
                class="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-fg-2 aria-selected:bg-surface-2 aria-selected:text-fg aria-selected:shadow-[inset_2px_0_0_var(--color-steel)]"
              >
                <Show
                  when={option.kind === 'account' && option.person}
                  fallback={
                    <>
                      <span class="grid size-7 place-items-center border border-dashed border-line-strong">
                        <Icon name="plus" class="size-3.5" />
                      </span>
                      Add “{option.kind === 'name' && option.name}” as a name
                    </>
                  }
                >
                  {(person) => (
                    <>
                      <Avatar
                        name={person().name}
                        image={person().image}
                        class="size-7"
                      />
                      {person().name}
                    </>
                  )}
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
