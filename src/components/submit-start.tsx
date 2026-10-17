import { Link } from '@tanstack/solid-router'
import { For, type JSX, Show } from 'solid-js'

import type { Game } from '../shared/content'
import { defaultGame, gameInfo, gameList } from '../shared/games'
import { FormSection } from './form-section'
import { Icon } from './icon'
import { choiceCard, choiceCardOff } from './ui'

type Kind = 'experience' | 'snippet'

const SNIPPET_LINE =
  'A small, reusable bit of script that others can copy into their own experience.'

// The router marks a link current when the page's address starts with the
// link's, and "/submit" starts every address here. Each card says itself
// whether it is the one chosen.
const EXACT = { exact: true }

/**
 * One choice, as a link to the form it leads to. Each game and each kind has
 * its own address, so choosing one is going there: it works with no script,
 * and the page that comes back is that game's form and nothing left over
 * from the other's.
 *
 * With a script, the browser fades from the old form to the new one. Fading
 * each color by itself does not work here: the accent is a variable, and
 * Firefox draws a transition of a color made from a changing variable
 * toward the wrong end and then jumps.
 */
function Card(props: {
  game: Game
  kind: Kind
  current: boolean
  /** The form this page is a kept one: the other game's form keeps it too. */
  keepDraft?: boolean
  /** Asked before going: false keeps the visitor here. */
  mayLeave?: () => boolean
  class?: string
  children: JSX.Element
}) {
  const current = () => (props.current ? 'true' : undefined)
  // What the card is filled in by: it changes with the page's data, in the
  // same step as the game's colors.
  const chosen = () => (props.current ? '' : undefined)
  const classes = () => `${choiceCard} ${props.class ?? ''}`
  const onClick = (event: MouseEvent) => {
    if (props.mayLeave && !props.mayLeave()) event.preventDefault()
  }
  return (
    <Show
      when={props.kind === 'snippet'}
      fallback={
        <Link
          to="/submit"
          search={{
            ...(props.game === defaultGame.id ? {} : { game: props.game }),
            // Without it the form loses what it was filled in from.
            ...(props.keepDraft ? { draft: true as const } : {}),
          }}
          activeOptions={EXACT}
          resetScroll={false}
          viewTransition
          onClick={onClick}
          aria-current={current()}
          data-chosen={chosen()}
          class={classes()}
        >
          {props.children}
        </Link>
      }
    >
      <Link
        to="/submit/snippet"
        activeOptions={EXACT}
        resetScroll={false}
        viewTransition
        onClick={onClick}
        aria-current={current()}
        data-chosen={chosen()}
        class={classes()}
      >
        {props.children}
      </Link>
    </Show>
  )
}

/**
 * The top of both submit forms, the same on each word for word: which game,
 * then what is being shared. A game with no snippets still shows that
 * choice, with the reason, and it cannot be taken.
 *
 * Choosing the other game keeps what is filled in below. Choosing the other
 * kind is another form, so when `filledIn` says there is something to lose,
 * the visitor is asked first.
 */
export function SubmitStart(props: {
  game: Game
  kind: Kind
  /** The page is a kept form, `?draft=true`, which the other game keeps. */
  draft?: boolean
  /** Whether anything is filled in below that leaving would lose. */
  filledIn?: () => boolean
}) {
  const info = () => gameInfo(props.game)
  /** Going to the other kind's form, after asking if there is anything to lose. */
  const mayLeave = (kind: Kind) => () =>
    kind === props.kind ||
    !props.filledIn?.() ||
    window.confirm(
      `Go to the ${kind === 'snippet' ? 'snippet' : 'experience'} form? What you have filled in here is not kept.`,
    )
  const whyNot = () => {
    const { snippets } = info()
    return snippets === true ? '' : snippets.why
  }
  const body = 'col-start-2 text-[13px] text-fg-3'
  // One width for the picture in every card, the logos' width, so the text
  // in all four starts at the same place.
  const layout =
    'grid-cols-[2rem_minmax(0,1fr)] content-center items-center gap-x-3'
  const icon = 'row-span-2 size-[22px] justify-self-center'
  // Everything the snippet choice can say under its name: what a snippet is,
  // or why a game has none. All of it is laid in the one place and only the
  // line that applies is shown, so the card is as tall as its longest line
  // for every game, and nothing below it moves from one game's form to the
  // next.
  const snippetLines = [
    ...new Set([
      SNIPPET_LINE,
      ...gameList.flatMap((game) =>
        game.snippets === true ? [] : [game.snippets.why],
      ),
    ]),
  ]
  const snippetLine = (shown: string) => (
    <span class={`${body} grid`}>
      <For each={snippetLines}>
        {(line) => (
          <span
            class="col-start-1 row-start-1"
            classList={{ invisible: line !== shown }}
            aria-hidden={line === shown ? undefined : 'true'}
          >
            {line}
          </span>
        )}
      </For>
    </span>
  )

  return (
    <>
      <FormSection title="Which game is it for?">
        <div class="grid gap-2.5 sm:grid-cols-2">
          <For each={gameList}>
            {(game) => (
              <Card
                game={game.id}
                // Choosing a game keeps what is being shared where that
                // game has it.
                kind={
                  props.kind === 'snippet' && game.snippets === true
                    ? 'snippet'
                    : 'experience'
                }
                current={game.id === props.game}
                keepDraft={props.draft && props.kind === 'experience'}
                mayLeave={mayLeave(
                  props.kind === 'snippet' && game.snippets === true
                    ? 'snippet'
                    : 'experience',
                )}
                class={`${layout} group`}
              >
                {/* Drawn through a mask so it takes the card's colors: steel,
                    and the game's accent once chosen. */}
                <span
                  aria-hidden="true"
                  class="row-span-2 size-8 bg-steel mask-contain mask-center mask-no-repeat group-data-chosen:bg-accent"
                  style={{ 'mask-image': `url(${game.logo})` }}
                />
                <b class="text-[15px] font-semibold">{game.name}</b>
                <small class={body}>{game.submitNote}</small>
              </Card>
            )}
          </For>
        </div>
      </FormSection>

      <FormSection title="What are you sharing?">
        <div class="grid gap-2.5 sm:grid-cols-2">
          <Card
            game={props.game}
            kind="experience"
            current={props.kind === 'experience'}
            mayLeave={mayLeave('experience')}
            class={layout}
          >
            <Icon name="box" class={`${icon} text-steel`} />
            <b class="text-[15px] font-semibold">Experience</b>
            <span class={body}>Something to play, by its code.</span>
          </Card>
          <Show
            when={info().snippets === true}
            fallback={
              <div class={`${choiceCardOff} ${layout}`}>
                <Icon name="code" class={`${icon} text-fg-3`} />
                <b class="text-[15px] font-semibold text-fg-3">Snippet</b>
                {snippetLine(whyNot())}
              </div>
            }
          >
            <Card
              game={props.game}
              kind="snippet"
              current={props.kind === 'snippet'}
              mayLeave={mayLeave('snippet')}
              class={layout}
            >
              <Icon name="code" class={`${icon} text-steel`} />
              <b class="text-[15px] font-semibold">Snippet</b>
              {snippetLine(SNIPPET_LINE)}
            </Card>
          </Show>
        </div>
      </FormSection>
    </>
  )
}
