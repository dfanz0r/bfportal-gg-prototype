# Working in this repository

For anyone, human or agent, changing this code. `README.md` covers setup and
`PLAN.md` holds the decisions: the data model, the feature list, what is agreed and what
is still open. Read the part of the plan that covers what you are about to build, and
update it when a decision changes.

## Language

Write American English everywhere: code, comments, names in the database,
documentation, commit messages and the site's own text. `color`, `behavior`, `center`,
`sanitize`, `canceled`, `license`, `gray`. Dates in prose are month first: "October 3",
"Oct 16, 2026".

Use the community's words. An experience offered for others to build on is a
"template", never a "prefab". A playtest is a brief that testers play in their own
time, not a scheduled session.

## Commands

Use pnpm. Before calling a change done, run all four:

```bash
pnpm lint:fix
pnpm typecheck
pnpm test        # needs the local Postgres: pnpm db:up
pnpm build
```

`pnpm build` also regenerates `src/routeTree.gen.ts`, so run it after adding a route
and before type-checking. The route tree is committed; never edit it by hand.

## Project structure

| Path | Contents |
|---|---|
| `src/routes` | One file per page or HTTP endpoint. Thin: a route wires data to components |
| `src/components` | Shared Solid components and `ui.ts`, the shared class lists |
| `src/functions` | Server functions: the only way client code reaches `src/server` |
| `src/server` | Database, auth, configuration. Never imported by client code |
| `src/shared` | Constants, types and text used on both sides |
| `src/styles.css` | Design tokens and the few custom utilities |
| `tests` | Test database setup. Tests sit beside the code they cover |
| `seed` | Sample data for local development |
| `mockups` | The design reference. Git-ignored; its images are not ours to publish |

Rules that hold the structure together:

- **Client code never imports `src/server`.** A route may use it inside
  `server.handlers`; everything else goes through a server function. The build fails
  when this is broken.
- **A route guard is not protection.** It keeps a page out of view. Every server
  function checks the session and the role itself.
- **Configuration is read in one place,** `src/server/env.ts`. Nothing else touches
  `process.env`.
- **A thing is named once.** Sections, external links, legal text and the values behind
  database enums each live in one file under `src/shared`, and everything else reads
  from there.

## Components

Reach for what exists before writing markup:

| Need | Use |
|---|---|
| A page | `PageLayout` (the head band, then content in the column) |
| A page title | `head: () => pageTitle('…')` on the route |
| A section with no pages yet | `SectionPlaceholder` |
| A button or link that looks like one | `buttonAccent`, `buttonSteel`, `buttonGhost`, `iconButton` from `ui.ts` |
| A heading or a paragraph | `display` and `body` from `ui.ts` |
| An icon | `<Icon name="…" />`; add new ones to `icon.tsx` |
| A menu that opens | `<details>` with `createDismiss()` |
| A user's picture | `Avatar` |
| The site search | `SearchForm` |

How we write them:

- **One component per file,** named in kebab case, with a named export and its props
  typed inline. No barrel files.
- **Extract on the second use.** Markup or a long class list that appears twice becomes
  a component or a constant in `ui.ts`. Do not copy it a second time, and do not
  extract something used once.
- **Lists are data.** Navigation, footer columns, tiles and the like are arrays rendered
  with `<For>`, not rows written out by hand.
- **Keep Solid's reactivity.** Do not destructure props. Use `<Show>` and `<For>`, and
  read a value where it is used so it updates when it changes.
- **Work without JavaScript where HTML can.** Menus are `<details>`; actions that
  change something are forms that post. Scripts improve them, they do not create them.
- **Label what has no text.** An icon-only control carries an `aria-label`; icons
  themselves are hidden from screen readers.
- **Comments say why,** not what the next line does.

## Rendering

The server renders a page's first load, for search engines and link previews, and the
browser handles navigation after that. "Rendering" in `PLAN.md` has the reasoning and
which pages get what. The rules when writing a page:

- **Load a page's content in its route loader,** through a server function. A
  component does not fetch what the page is about.
- **Treat loader data as public.** It is written into the HTML. Return only what the
  page shows.
- **Keep state in the address.** Filters, sort, tab and page number are search
  parameters, validated on the route with Zod.
- **Render the same thing on the server and in the browser.** No clock, time zone,
  locale, random value, window size or browser storage while rendering. Render dates
  in a fixed form inside `<time datetime>` and localize after hydration; take "now"
  from the loader; keep a visitor's choices in a cookie the server can read.
- **Make links and forms work without script.** Paging is a real link, filters are a
  GET form, actions are forms that post.
- **Await only what the page is about.** Side content may stream in with `Await`.
  Never wait on a third-party service while rendering.
- **Wrap what cannot render on the server** in `ClientOnly`, with a fallback of the
  same size. Load heavy widgets when they are used.
- **Give every indexed page its head:** title, description, canonical address, Open
  Graph and Twitter tags. Pages not meant for search carry `noindex`.
- **Answer with real statuses:** `notFound()` for what does not exist or is not
  public, a redirect for an old address.
- **Admin routes use `ssr: 'data-only'`:** the guard and data run on the server, the
  screens draw in the browser.

## Design

The mockups in `mockups/site` are the reference, and "Visual direction" in `PLAN.md`
records what was agreed. Build pages to match the mockup; when the app has to differ,
change the mockup or the plan in the same piece of work so the two do not drift.

- **Tokens only.** Colors, fonts and spacing come from the theme in `src/styles.css`.
  Tailwind's default palette is switched off. No hex colors in components.
- **One centered column,** 1360px wide: the `wrap` utility. Nothing grows with the
  window.
- **Check a range of widths,** from 390px to 2660px, including in-between ones such as
  824px (a laptop window zoomed to 160%). The navigation collapses below 1280px.
- **Dense, not big.** Compact rows are preferred to boxed grids, tall banners and
  oversized cards. The hero is short.
- **Orange is for the thing to act on:** one accent button on a page, the active
  navigation item, the logo. Steel is for headings and secondary buttons.
- **Teal means Battlefield 2042** and nothing else. It replaces the accent inside
  `[data-game="bf2042"]`. Success and "verified" states use steel and white.
- **Type.** Big Shoulders Display in capitals for headings, Barlow for text, JetBrains
  Mono for codes and small labels.
- **Framed things have corner ticks:** `frame` on a control, `card-hover` on a card
  that opens. Motion stays small and is off under reduced motion.

## Data

- **What differs by game is data, not code.** Tags, tag groups, categories, maps and
  SDK versions are rows scoped to a game that an admin can edit. Do not branch on a
  game's name, and do not name a column or an enum after one game's concept. A new
  title should be an addition.
- **The schema is `src/server/db/content-schema.ts`.** The values behind its enums are
  in `src/shared/content.ts`, shared with forms and the API. Better Auth's tables are
  generated: change the auth configuration and run `pnpm auth:generate`.
- **Migrations** come from `pnpm db:generate --name <what_changed>`. Read the SQL it
  writes; it has needed reordering by hand. Never edit a migration that has been
  committed.
- **Let the database refuse what it can.** Constraints first, a check in the service
  for what a constraint cannot say, and a test for each.
- **Timestamps carry a time zone.**
- **Stored text is Markdown;** the HTML shown is rendered and sanitized on write.
- **What users submit is held for a moderator,** with the exceptions the plan lists.

## Tests

Vitest. Tests that need a database run against a real Postgres, in a `bfportal_test`
database that each run rebuilds from the migrations. Component tests run under
happy-dom: start the file with `// @vitest-environment happy-dom`. Write tests where a
mistake is expensive: constraints, permissions, moderation, login, the import.

## How to work here

- Commit only when asked, in the style of the existing history
  (`feat(db): …`, `fix(ui): …`, `docs: …`), and never push without being asked.
- Do only what was asked. Do not add sections to the README or new documents on your
  own; conventions for people changing the code belong in this file.
- Ask before starting a browser or a local server to check something. Say when a
  change has not been looked at in a browser.
- Say what you verified and what you did not.
