// Class lists for controls that appear on more than one page.

const button =
  'inline-flex h-10 items-center justify-center gap-2 px-[18px] text-[13px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase transition-colors'

/** The one thing to do on a page. */
export const buttonAccent = `${button} bg-accent text-accent-ink hover:bg-accent-hi`

/** A secondary action that should still stand out. */
export const buttonSteel = `${button} bg-steel text-steel-ink hover:bg-steel-hi`

export const buttonGhost = `${button} border border-line-strong text-fg hover:border-steel hover:bg-steel/6`

export const iconButton =
  'grid size-9 shrink-0 place-items-center border border-line text-fg-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-fg'

/** Condensed uppercase display type, for headings. Add a size. */
export const display = 'font-display font-bold uppercase'

/** A paragraph of running text, kept to a readable line length. */
export const body = 'max-w-[46em] text-[15.5px] text-fg-2'

/** A bordered block on the page's surface. */
export const panel = 'border border-line bg-surface-1'

/** A small mono label above or beside something. */
export const label =
  'font-mono text-[11px] font-medium tracking-[0.14em] text-fg-3 uppercase'

/** A small bordered word. Add a border color and a text color. */
export const tag =
  'inline-flex h-5 items-center gap-[5px] border px-[7px] text-xs leading-none whitespace-nowrap'

/** One choice in a row of filter links. Mark the current one `aria-current`. */
export const pill =
  'inline-flex h-[34px] items-center gap-2 border border-line-strong px-3 text-[13.5px] font-medium text-fg-2 hover:border-steel hover:text-fg aria-[current=true]:border-accent aria-[current=true]:text-fg'

/**
 * A choice drawn as a card that cannot be taken: the card's shape, dashed,
 * with nothing that answers the pointer.
 */
export const choiceCardOff =
  'relative grid gap-0.5 border border-dashed border-line-strong px-3.5 pt-[11px] pb-3'

/**
 * A choice drawn as a card: a name and a line about it. A link to where the
 * choice leads, filled in when it is marked `data-chosen`. Not by
 * `aria-current`: the router writes that on a link as soon as the address
 * changes, before the page's data has loaded, so the card would fill in the
 * old page's colors and then change to the new ones.
 */
export const choiceCard =
  'relative grid cursor-pointer gap-0.5 border border-line-strong px-3.5 pt-[11px] pb-3 transition-colors duration-200 hover:border-steel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-chosen:border-accent data-chosen:bg-accent/12'

/** A text field. A `<select>` and a `<textarea>` take it too. */
export const field =
  'min-h-[42px] w-full border border-line-strong bg-base px-3 py-2 text-[15px] text-fg outline-none placeholder:text-fg-3 focus:border-steel'
