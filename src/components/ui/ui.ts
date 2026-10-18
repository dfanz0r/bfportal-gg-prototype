// Class lists for controls that appear on more than one page.

const button =
  'inline-flex h-10 items-center justify-center gap-2 px-[18px] text-[13px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase transition-colors'

/** The one thing to do on a page. */
export const buttonAccent = `${button} bg-accent text-accent-ink hover:bg-accent-hi`

/** A secondary action that should still stand out. */
export const buttonSteel = `${button} bg-steel text-steel-ink hover:bg-steel-hi`

export const buttonGhost = `${button} border border-line-strong text-fg hover:border-steel hover:bg-steel/6`

/** For what ends something: deleting, removing. */
export const buttonDanger = `${button} border border-danger/50 text-danger hover:border-danger hover:bg-danger/8`

export const iconButton =
  'grid size-9 shrink-0 place-items-center border border-line text-fg-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-fg'

/** Condensed uppercase display type, for headings. Add a size. */
export const display = 'font-display font-bold uppercase'

/** A page's own title, its `<h1>`. */
export const headline =
  'font-display text-[clamp(34px,3.4vw,46px)] leading-[0.96] font-extrabold tracking-[0.005em] text-steel-hi uppercase [overflow-wrap:anywhere]'

/** A paragraph of running text, kept to a readable line length. */
export const body = 'max-w-[46em] text-[15.5px] text-fg-2'

/** A bordered block on the page's surface. */
export const panel = 'border border-line bg-surface-1'

/** The square that says what kind of file a row is: JSON, TS, TSCN. */
export const fileGlyph =
  'grid size-11 shrink-0 place-items-center border border-line bg-surface-3 font-mono text-xs font-semibold tracking-[0.04em] text-steel'

/** A small mono label above or beside something. */
export const label =
  'font-mono text-[11px] font-medium tracking-[0.14em] text-fg-3 uppercase'

/** A small bordered word. Add a border color and a text color. */
export const tag =
  'inline-flex h-5 items-center gap-[5px] border px-[7px] text-xs leading-none whitespace-nowrap'

/**
 * The colors of a status's `tag`, by the word the site shows. Amber is for
 * what needs its owner.
 */
export const statusChips: Record<string, string> = {
  Draft: 'border-line-strong text-fg-2',
  Live: 'border-steel/50 text-steel-hi',
  Delisted: 'border-line text-fg-3',
  Removed: 'border-danger/50 text-danger',
  'In review': 'border-steel/40 text-fg-2',
  'Changes requested': 'border-warn/50 text-warn',
}

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

/**
 * One control in a row of filters: a menu's button, or a `<label>` around a
 * `<select>` that takes `filterSelect`.
 */
export const filterControl =
  'inline-flex h-[34px] items-center gap-2 border border-line-strong px-3 text-[13.5px] font-medium text-fg hover:border-steel'

/** The `<select>` inside a `filterControl`. */
export const filterSelect = 'bg-surface-1 text-fg-3 outline-none'

/** A text field. A `<select>` and a `<textarea>` take it too. */
export const field =
  'min-h-[42px] w-full border border-line-strong bg-base px-3 py-2 text-[15px] text-fg outline-none placeholder:text-fg-3 focus:border-steel'

/**
 * A `field` in a row of them, as the admin edits a list in place. Give it a
 * width; it does not fill the row.
 */
export const fieldCompact =
  'h-[34px] min-w-0 border border-line-strong bg-base px-2.5 text-[14px] text-fg outline-none placeholder:text-fg-3 focus:border-steel'
