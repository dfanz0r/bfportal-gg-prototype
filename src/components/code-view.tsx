import type {
  GrammarState,
  HighlighterCore,
  ThemeRegistration,
} from 'shiki/core'
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from 'solid-js'

import type { CodeLanguage } from '../shared/project-files'

/** The four kinds of word that are colored, and the class for each. */
const kinds = {
  keyword: 'text-code-keyword',
  string: 'text-code-string',
  comment: 'text-code-comment',
  name: 'text-code-name',
}
type Kind = keyof typeof kinds

const color = (kind: Kind) => `var(--color-code-${kind})`

const classOf: Record<string, string> = Object.fromEntries(
  Object.entries(kinds).map(([kind, name]) => [color(kind as Kind), name]),
)

// The mockup's four colors, given to what each grammar calls its words.
// Operators and punctuation stay plain, as they are in the mockup.
const theme: ThemeRegistration = {
  name: 'site',
  type: 'dark',
  colors: { 'editor.foreground': 'var(--color-code-text)' },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: color('comment') },
    },
    {
      scope: ['keyword', 'storage.type', 'storage.modifier'],
      settings: { foreground: color('keyword') },
    },
    {
      scope: ['keyword.operator', 'punctuation', 'storage.type.function.arrow'],
      settings: { foreground: 'var(--color-code-text)' },
    },
    {
      scope: ['keyword.operator.new', 'keyword.operator.expression'],
      settings: { foreground: color('keyword') },
    },
    {
      scope: ['string', 'punctuation.definition.string'],
      settings: { foreground: color('string') },
    },
    {
      scope: [
        'constant.numeric',
        'constant.language',
        'entity.name.function',
        'support.function',
        'entity.name.type',
        'support.type',
        'punctuation.support.type.property-name',
      ],
      settings: { foreground: color('name') },
    },
  ],
}

const grammars = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  gdresource: () => import('shiki/langs/gdresource.mjs'),
} satisfies Record<CodeLanguage, unknown>

/** Lines colored at a time, so a long file does not hold up the page. */
const BATCH_LINES = 400
/** A line longer than this, such as minified data, is left plain. */
const MAX_LINE_LENGTH = 2000

type Word = { text: string; class?: string }

let highlighter: Promise<HighlighterCore> | undefined

async function highlighterFor(language: CodeLanguage) {
  // Never called on the server. Saying so lets the server build leave Shiki out.
  if (import.meta.env.SSR) throw new Error('Code is colored in the browser.')
  highlighter ??= Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
  ]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
    createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [theme],
      langs: [],
    }),
  )
  const loaded = await highlighter
  if (!loaded.getLoadedLanguages().includes(language)) {
    await loaded.loadLanguage(grammars[language])
  }
  return loaded
}

/** Colors the lines a batch at a time, handing each batch over as it is done. */
async function colorLines(
  lines: string[],
  language: CodeLanguage,
  add: (batch: Word[][]) => void,
  wanted: () => boolean,
) {
  const loaded = await highlighterFor(language)
  let state: GrammarState | undefined
  for (let start = 0; start < lines.length && wanted(); start += BATCH_LINES) {
    const result = loaded.codeToTokens(
      lines.slice(start, start + BATCH_LINES).join('\n'),
      {
        lang: language,
        theme: theme.name as string,
        grammarState: state,
        tokenizeMaxLineLength: MAX_LINE_LENGTH,
      },
    )
    state = result.grammarState
    add(
      result.tokens.map((line) =>
        line.map((token) => ({
          text: token.content,
          class: token.color ? classOf[token.color] : undefined,
        })),
      ),
    )
    // Let the page draw and answer input before the next batch.
    await new Promise((resolve) => setTimeout(resolve))
  }
}

/**
 * Text shown as code, a numbered line at a time. Nothing here runs it, and
 * the numbers are drawn by the page, so copying the text does not pick them
 * up. Long lines scroll sideways.
 *
 * With a language, it is colored once the page is running. The server sends
 * it plain, so the page carries the text only once and draws the same thing
 * on both sides.
 */
export function CodeView(props: {
  text: string
  language?: CodeLanguage | null
  class?: string
}) {
  // A file ends with a line break, which is not a line.
  const lines = createMemo(() => props.text.replace(/\n$/, '').split('\n'))
  const [colored, setColored] = createSignal<Word[][]>([])

  createEffect(
    on([lines, () => props.language], ([all, language]) => {
      setColored([])
      if (!language) return
      let wanted = true
      onCleanup(() => {
        wanted = false
      })
      colorLines(
        all,
        language,
        (batch) => setColored((done) => [...done, ...batch]),
        () => wanted,
      ).catch(() => {
        // Without the highlighter, say offline, the code stays plain.
      })
    }),
  )

  return (
    <pre
      class={`overflow-auto bg-base py-4 font-mono text-[13px] leading-[1.7] text-code-text ${props.class ?? ''}`}
    >
      <code class="block [counter-reset:line]">
        <For each={lines()}>
          {(line, index) => (
            <span class="block pr-4 whitespace-pre before:mr-4 before:inline-block before:w-[52px] before:text-right before:text-fg-3/60 before:content-[counter(line)] before:[counter-increment:line]">
              <Show
                when={colored()[index()]?.length ? colored()[index()] : null}
                fallback={line || ' '}
              >
                {(words) => (
                  <For each={words()}>
                    {(word) => (
                      <Show when={word.class} fallback={word.text}>
                        <span class={word.class}>{word.text}</span>
                      </Show>
                    )}
                  </For>
                )}
              </Show>
            </span>
          )}
        </For>
      </code>
    </pre>
  )
}
