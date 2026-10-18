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
time, not a scheduled session. A "snippet" is a small, reusable piece for
Battlefield 6 that others copy into their own, not a whole experience. "Script"
means TypeScript, what a snippet or an experience is made of, and never the snippet
itself: it is a snippet in the site's text and in code (`SnippetRow`,
`fetchSnippets`), in the Snippets section at `/snippets`. Each snippet is TypeScript
for now; do not build in that it must be, since one of blocks may come.

Write the site's own text short and plain: one fact a line, said the ordinary way.
No asides, no reassurance, nothing clipped or clever. "Submitted 5 hours ago. 4th of
7 in the queue." Before adding a rule or a warning, check it is true of Battlefield
Portal: a Portal script cannot make a web request, so it has no secrets to leak.

A submission's status has one word each, from `contentStatusLabels` in
`src/shared/content.ts`: Draft, In review, Changes requested, Live, Delisted, Removed.
A moderator "requests changes"; nothing is "rejected" or "turned down". Never show a
creator which moderator reviewed something: a note is a "Moderator note".

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
| `src/server` | Database, auth, configuration, and `services`, which hold the queries and rules. Never imported by client code, types included: take a type from the server function instead |
| `src/shared` | Constants, types and text used on both sides |
| `src/styles.css` | Design tokens and the few custom utilities |
| `tests` | Test database setup. Tests sit beside the code they cover |
| `seed` | Sample data for local development and the script that loads it, `pnpm db:seed`, which empties the content tables first. The reference rows every database needs (categories, tags, maps, SDK releases) are `load-reference.ts`, which `pnpm db:reference` runs anywhere: it only adds what is missing. The production image runs it after migrating |
| `mockups` | The design reference. Git-ignored; its images are not ours to publish |

Rules that hold the structure together:

- **Client code never imports `src/server`.** A route may use it inside
  `server.handlers`; everything else goes through a server function. The build fails
  when this is broken.
- **A route guard is not protection.** It keeps a page out of view. Every server
  function checks the session and the role itself, and has a test that each role it
  should refuse is refused.
- **Anything that changes state goes through Better Auth's HTTP handler or a POST
  server function,** never a direct call that skips the check of where a request
  came from. `src/server/auth/sign-out.ts` is the example.
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
| A titled part of a page | `Section` |
| A button or link that looks like one | `buttonAccent`, `buttonSteel`, `buttonGhost`, `iconButton` from `ui.ts` |
| A heading or a paragraph | `display` and `body` from `ui.ts` |
| A bordered block, a small label, a tag, a filter link | `panel`, `label`, `tag`, `pill` from `ui.ts` |
| A row of filter links | `Pills` |
| Tabs between the parts of one area, each at its own address | `Tabs` |
| The trail and the "by, when" line above a page's title | `crumbs` and `meta` on `PageLayout` |
| A day as a small block, the day over the month | `DateBlock` |
| "Showing 12 of 40" and the link to more | `ShowMore` |
| An icon | `<Icon name="…" />`; add new ones to `icon.tsx` |
| A menu that opens | `<details>` with `createDismiss()` |
| A user's picture | `Avatar` |
| A person's name, linked to their profile | `PersonLink`; "by …" with a picture is `Byline` |
| The site search | `SearchForm` |
| An experience in a listing | `ExperienceCard` |
| What an experience is built with | `BuiltWithTags` |
| An update post | `UpdateCard` in a listing, `UpdatePost` in full |
| A playtest, an event, a snippet in a listing | `PlaytestCard`, `EventCard`, `SnippetRow` |
| A like count that is also the button to like | `LikeButton`, with `kind="snippet"` for a snippet |
| "Name: value" rows | `Facts` with `Fact`s inside |
| A source repository | `RepoLink` |
| A share code that copies itself | `CopyCode`; any other text is `CopyText` |
| A date or "5 hours ago" | `DateText`, which hydrates safely; never format a date in a component |
| Something that may only differ from the server's HTML once the page runs | `createHydrated()` |
| Text someone wrote, as HTML | the `prose` class |
| A link to a game's Library tab, with filters | `LibraryLink` |
| A field of a form, with its label, hint and error | `FormField`; a checkbox or radio is `Check`; an error with no field of its own is `FieldError` |
| A titled part of a form | `FormSection` |
| A row of choices drawn as boxes that fill in | `ChoiceGroup` with `Choice`s inside, radio or checkbox |
| A choice drawn as a card, such as the game on a submit form | `choiceCard` from `ui.ts` |
| The top of a submit form: which game, then what is being shared | `SubmitStart` |
| A box for code, with line numbers and a file to upload | `CodeInput` |
| A number chosen by dragging or typed, as Portal's settings are | `Slider` |
| How an experience splits its players and bots into teams | `TeamSetupInput` on a form; `describeTeams` in `src/shared/teams.ts` in a line |
| People to credit: accounts found as a name is typed, or plain names | `CreditsInput`, which searches with `searchPeople` |
| The picture at a link someone typed, or why there is none | `ImagePreview` |
| A list of links to pictures and videos, each beside what it shows, in order | `MediaListInput` |
| What a gallery link shows, a picture or a YouTube video to embed | `mediaOf` in `src/shared/media.ts`; never parse a link in a component |
| An experience's pictures and videos, one at a time | `Gallery` |
| A Portal export and the files beside it, held for the form until it is sent | `ProjectFilesInput`; the export is read by `readExport` in `src/server/services/portal-export.ts` |
| The square that says what kind of file a row is | `fileGlyph` from `ui.ts`, with `fileGlyphs` from `src/shared/project-files.ts` |
| A project's files for a moderator, each to download | `ProjectFileList` |
| The owner's switch for offering files as a template | `TemplateOffer` |
| Deleting an experience, or a moderator removing it | `ExperienceManage`, at the foot of its page |
| A button that ends something, such as Delete | `buttonDanger` from `ui.ts` |
| The experience form for one of the owner's: a draft, one sent back, one in review, or one live | `SubmitPage` with `editing` in its data, from `getDraftEditPage`; the form's `editing` field says which. Checking the form and writing it are `prepareExperience` and `writeAround` in `src/server/services/prepare-experience.ts`, shared by a submission and an edit |
| Everything someone has made, and where each stands | `YourSubmissions`, from `listOwnSubmissions` |
| A moderator's screen for a pending edit, each change beside what is live | `AdminEdit`, from `describeEdit` in `src/server/services/experience-edits.ts`; what an edit may change is `editPayloadSchema` in `src/server/services/edit-payload.ts` |
| An item's status and the moderator's note, for its owner | `StatusNote` |
| A moderator's decision: a note, approve or request changes | `DecisionForm` |
| Anything that differs by game | its entry in `src/shared/games.ts` |

How we write them:

- **A file exports one component,** named in kebab case, with its props typed inline.
  A small helper only that component uses stays private in the same file. No barrel
  files.
- **A route file is thin.** It wires the address and the loader to a page component
  in `src/components`; the page itself is not written there.
- **Extract on the second use.** Markup or a long class list that appears twice becomes
  a component or a constant in `ui.ts`. Do not copy it a second time, and do not
  extract something used once.
- **Lists are data.** Navigation, footer columns, tiles and the like are arrays rendered
  with `<For>`, not rows written out by hand.
- **Keep Solid's reactivity.** Do not destructure props. Use `<Show>` and `<For>`, and
  read a value where it is used so it updates when it changes.
- **Read a prop that holds markup once.** Each read builds the markup again, so
  `<Show when={props.actions}>{props.actions}</Show>` builds it twice: the server
  writes one copy, the browser hydrates the other, and the whole page fails. Take it
  through `children(() => props.actions)` and use that. `PageHead` is the example,
  and `page-head.test.tsx` counts the builds.
- **Work without JavaScript where HTML can.** Menus are `<details>`; actions that
  change something are forms that post. Scripts improve them, they do not create them.
- **A choice that changes what the page offers is a link to its own address,** not a
  radio button waiting for a submit. The game on the submit form is the example:
  `SubmitStart`. Choosing it then works with no script, and the page is that choice's
  page and nothing left over from the other.
- **A page whose data loads again keeps its fields.** The router changes the page in
  place when only the search changes, and two things follow. An input is written to
  whenever the expression for its value runs again, which wipes what was typed: take
  what a field starts from through `createMemo` with an `equals` that compares what
  it says. And the router keeps rows that are equal in both loads, so `<For>` keeps
  their elements and their state: work out what is chosen from what is offered now.
  `submit-page.tsx` does both.
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
  parameters, validated on the route with Zod. A route's search stays in the form
  the address is written in, so reading an address and writing it back change
  nothing; `src/shared/library-search.ts` is the pattern to copy.
- **Render the same thing on the server and in the browser.** No clock, time zone,
  locale, random value, window size or browser storage while rendering. Render dates
  in a fixed form inside `<time datetime>` and localize after hydration; take "now"
  from the loader; keep a visitor's choices in a cookie the server can read.
- **Make links and forms work without script.** Paging is a real link, filters are a
  GET form, actions are forms that post.
- **Await only what the page is about.** Side content may stream in with `Await`.
  Never wait on a third-party service while rendering.
- **The server never fetches an address a user gave.** It calls out only to fixed
  services it names itself: gametools.network for Portal lookups, and Discord to
  sign in. A cover, a gallery link, a video or a file link is loaded by visitors'
  browsers, never by the server: fetching it would show the server's address to
  whoever chose the link, and let them point the server at anything. A check that
  a link works is made in the browser, as `ImagePreview` does.
- **Wrap what cannot render on the server** in `ClientOnly`, with a fallback of the
  same size. Load heavy widgets when they are used.
- **Give every indexed page its head:** title, description, canonical address, Open
  Graph and Twitter tags. Pages not meant for search carry `noindex`.
- **Answer with real statuses:** `notFound()` for what does not exist or is not
  public, a redirect for an old address.
- **Admin routes use `ssr: 'data-only'`:** the guard and data run on the server, the
  screens draw in the browser.

## Writes

Anything that changes something follows `src/functions/likes.ts` and
`src/server/services/likes.ts`, the first one written:

- **The rule lives in a service** that takes an `Actor` (who is acting, or null) and
  returns a result: `{ ok: true, … }` or a `Refusal` with a reason. It never reads the
  request. A refusal the site expects is a value, not an error thrown.
- **Each service has a test that everyone it should refuse is refused:** a visitor who
  is not signed in, and every role below the one it needs.
- **The server function is thin and POST.** It calls `assertFromThisSite()` first,
  then `currentActor()`, then the service. The session cookie alone does not show
  that the visitor meant to do it.
- **It takes a form as well as an object,** with `formOr(schema)`, and answers a form
  with `formAnswer`. The page's `<form>` posts to the function's `.url`, so the
  action works before the script loads; the script then calls the same function.
- **Bad input is a refusal, not an error thrown.** `formOr` hands the handler
  `input: null` and the errors by field; answer `refuse('invalid', data.errors)`.
- **A form that takes typing gets it back when it is refused,** script or not. With
  no script the page is gone by then, so keep what was sent and draw it again:
  `keepDraft` in `src/server/services/drafts.ts`, with `submitForReview` and
  `/submit?draft=true` as the example. Keep every field that passed. A short form
  can come back in the address instead, as a refused decision does
  (`decisionSearchSchema`).
- **What is sent is what the visitor sees.** Never a hidden copy of a field they
  can still change. A second button that does something else with the same
  fields is a button of the same form with its own `formaction`, as "Fetch
  details" on the submit form is.
- **In the page's script, tell three endings apart:** the server said no (show
  why), the server said yes (never show an error after this, whatever the
  navigation does), and no answer came back (say it may or may not have gone
  through; do not say nothing happened). Ignore a second press while one is out.
  An answer that comes after the component was given something else, such as
  another experience, is dropped: `LikeButton` keeps the slug it sent.
- **What costs someone else is limited per account:** a count in the database, in
  the service, for what must hold across restarts; `allow()` from
  `src/server/rate-limit.ts` for calls to a third party. Count in the same
  transaction as the write, under a lock on the account, or two requests at once
  both fit in the last place: `withinLimit` in
  `src/server/services/submission-limits.ts`. A count of what was sent includes
  what has since been deleted, or deleting refills it.
- **Stored text has a size.** Whatever a write keeps, even a draft that lets the
  rest slide, is held to the limits the form has, per field and in total.
- **Read the size and the sender before the body.** A function that takes files
  checks the session and how many and how large they are before reading one.
  `src/start.ts` refuses any body over `MAX_REQUEST_BYTES`, and one with no length.
- **Decide on the row as it is now.** A write that depends on a row's status
  reads it again inside its transaction, `for update`, and its final update
  repeats the conditions, `deleted_at is null` included. Rows are locked in one
  order everywhere: an experience before its revisions, through `lockEdits` in
  `src/server/services/template-offers.ts`.
- **A moderator decides on the version they were shown.** Nobody is locked out
  while a review is open. Whatever its owner can change while it waits has a
  `version` that every change they send moves on; the review screen passes it to
  `DecisionForm`, and the decision is refused if it no longer matches, in the same
  statement or transaction that decides. A new thing owners can change while it
  waits gets the same.
- **What a moderator reviews is what was sent.** Saving the form of something in
  review or live keeps the form (`draft_form`) and nothing else; only sending it
  changes what the moderator sees.
- **A visitor may have the same form open twice.** A write lets go only of what
  this request names, never everything an account holds: `shownFiles` on the
  submit form is the example.
- **Show what is private only to those it is for.** Loader data is in the page's
  HTML, so a field the page hides is still sent: leave it out on the server. The
  link to an experience's larger files follows the same rule as its uploads.
- **A visitor's address comes from `clientIp`** in `src/server/env.ts`, which reads
  the one header the proxy in front sets (`CLIENT_IP_HEADER`). Never another header,
  which anyone can send.

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

- **The game comes first.** In any flow where the game matters, it is the first
  question, and what follows is what that game allows. On submit: the game, then what
  is being shared, then the form.
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
- **Name a column that points at a user by what the user is to the row.** `user_id`
  when the row is simply that user's like, report or membership. A role when they
  hold one: `owner_id`, `author_id`, `host_id`. `<action>_by` when the column records
  who did something to the row: `submitted_by`, `reviewed_by`, `uploaded_by`.
- **One name, one meaning.** `code` is always the Portal share code. Do not reuse a
  column name for something else in another table.
- **Stored text is Markdown, and its HTML is written in one place.** Pages print the
  stored HTML as it is, so every `*_html` column is written only through
  `renderMarkdown` in `src/server/markdown.ts`. Never build that HTML any other way.
- **A person shown in public goes through `publicPerson`.** Select `personColumns`
  and pass the row to it; that is where a hidden name is honored.
- **The site's own address is `siteUrl`** from `src/server/env.ts`, for canonical
  links and previews.
- **What users submit is held for a moderator,** with the exceptions the plan lists.

## Tests

Vitest. Tests that need a database run against a real Postgres, in a `bfportal_test`
database that each run rebuilds from the migrations. Component tests run under
happy-dom: start the file with `// @vitest-environment happy-dom`. Write tests where a
mistake is expensive: constraints, permissions, moderation, login, the import.

Test files share the one test database and run one after another. A file that needs
seed data calls `seed` itself and must not rely on what another file left behind, or
assume nothing else is there. The tests and the seed refuse to run against a database
that is not on this machine; keep it that way.

## How to work here

- Commit only when asked, in the style of the existing history
  (`feat(db): …`, `fix(ui): …`, `docs: …`), and never push without being asked.
- Do only what was asked. Do not add sections to the README or new documents on your
  own; conventions for people changing the code belong in this file.
- Look at visual work. Render the page and its mockup to screenshots and compare
  them, the whole page down to the footer, at a few widths, before calling it done;
  say plainly when something has not been rendered or not been compared. Use the dev
  server that is already running and do not start another.
- Use what you build, not only load it. A screenshot of an address shows how a page
  starts. Anything a visitor clicks, types or chooses is checked by doing that in a
  browser and reading the page afterward: the address, what is chosen, the fields,
  the colors. Each state loaded by its own address is not the same check as getting
  there by a click.
- Say what you verified and what you did not.
- Change files with the editor's own edit and write tools, one visible change at a
  time. Do not create or rewrite files from the command line: no scripts that patch
  source, no `sed -i`, no heredocs or redirects into files. The command line is for
  running things: the checks, the tests, git, the seed, and tools that generate files
  such as `pnpm db:generate` and the formatter.
