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
