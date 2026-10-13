/**
 * The sections of the site, in navigation order. The header, the footer and
 * the home page all read this list, so a section is named in one place.
 *
 * `nav` is the short form for the navigation bar. `title` is how the section
 * is named everywhere else.
 */
export const sections = [
  {
    to: '/scripts',
    nav: 'Scripts',
    title: 'Scripts',
    text: 'Rules, logic and interface snippets for the Portal editor.',
  },
  {
    to: '/maps',
    nav: 'Maps',
    title: 'Maps',
    text: 'Custom maps made in the spatial editor.',
  },
  {
    to: '/tools',
    nav: 'Tools & Plugins',
    title: 'Tools and plugins',
    text: 'Editor plugins, command-line tools and add-ons.',
  },
  {
    to: '/guides',
    nav: 'Guides & Docs',
    title: 'Guides and docs',
    text: 'Tutorials and reference written by the community.',
  },
  {
    to: '/library',
    nav: 'Library',
    title: 'Experience library',
    text: 'Every experience shared for Battlefield 6 and Battlefield 2042.',
  },
  {
    to: '/updates',
    nav: 'Updates',
    title: 'Recent updates',
    text: 'What creators have changed, fixed and released.',
  },
  {
    to: '/events',
    nav: 'Events',
    title: 'Events and playtests',
    text: 'Community nights, and experiences that need testers.',
  },
  {
    to: '/forum',
    nav: 'Forum',
    title: 'Forum',
    text: 'Questions, showcases and feedback threads.',
  },
] as const

export type Section = (typeof sections)[number]
export type SectionPath = Section['to']

export function section(to: SectionPath): Section {
  // Every path in the type is in the list.
  return sections.find((item) => item.to === to) as Section
}
