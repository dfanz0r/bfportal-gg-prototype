/** The `head` of a page that only sets its title. */
export function pageTitle(title: string) {
  return { meta: [{ title: `${title} · bfportal.gg` }] }
}
