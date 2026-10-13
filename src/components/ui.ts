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

/** Condensed uppercase display type, for headings. */
export const display = 'font-display font-bold tracking-[0.015em] uppercase'
