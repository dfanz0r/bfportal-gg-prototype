# bfportal.gg rewrite: project plan

Written 2026-10-12. This describes the approach, the structure and the data model for
rewriting bfportal.gg in TypeScript. It is not a task list. References such as
`core/views.py:326` point into the current site's repository (`bfportal.gg`, under its
`bfportal/` directory) so you can see the behavior being replaced.

## Goal

A better, more stable version of the current site:

- Feature complete with the current site, implemented more cleanly.
- Additions the current site does not have, all worked out in the mockups:
  - update posts on projects, with a site-wide feed, and a source repository link;
  - a gallery of pictures and YouTube videos on each experience;
  - uploading the Portal export to fill in the submit form, and offering a project's
    files as a template;
  - tags for what a Battlefield 6 experience is built with;
  - playtests, replacing the Discord playtest bot;
  - events and time-limited banners.
- Visually centered on Battlefield 6, with the Battlefield 2042 library kept.
- TypeScript on the front end and the back end.

Requirements that shaped the stack:

- The public front end is lightweight.
- The admin and moderation panel is a separate JavaScript bundle that public pages never load.
- Pages are server-rendered wherever possible.
- One render tree for the whole app, not independent islands.

Not goals:

- Keeping the Django/Wagtail database schema. Data moves once into a new schema.
- Building the planned BF6 sections (Maps, Tools & Plugins, Guides & Docs, Forum). They
  are placeholders today and stay placeholders, but the structure should make them cheap
  to add. Events are the exception: see "Events and banners".

## Stack

Versions are the latest stable releases on npm as of 2026-10-12. Once a package is
installed, `package.json` and the lockfile are the record of its version, not this table.

| Concern | Choice | Version | Status |
|---|---|---|---|
| Framework | TanStack Start, Solid adapter (`@tanstack/solid-start`) | 1.168.58 | Agreed |
| Routing | `@tanstack/solid-router` | 1.170.39 | Comes with the framework |
| UI | SolidJS | 1.9.17 | Agreed |
| Build | Vite | 8.3.4 | Comes with the framework |
| Runtime | Node | 22.12 or newer | Required by the framework |
| Server | Nitro, Node preset | 3.0 beta | Comes with the scaffold; a pre-release |
| Package manager | pnpm | 11.28.5 | Agreed |
| Database | Postgres | 18 in development; 14 in production today | Agreed; production version open |
| Postgres driver | Postgres.js (`postgres`), through `drizzle-orm/postgres-js` | 3.4.9 | Agreed |
| ORM and migrations | Drizzle (`drizzle-orm`, `drizzle-kit`) | 0.45.4, 0.31.11 | Agreed |
| Login | Better Auth, Discord provider | 1.7.7 | Proposed; wired into the scaffold |
| Validation | Zod | 4.6.7 | In use for the environment; proposed for forms and the API |
| Styling | Tailwind (current site is on 3.3.2) | 4.3.3 | In use. The theme holds the mockup's tokens, and Tailwind's default palette is switched off |
| Markdown | `marked` with `sanitize-html`, server side | 18.1.1, 2.18.0 | Proposed |
| Admin tables and forms | TanStack Table, Form, Query (Solid adapters) | 9.3.1, 1.33.5, 5.104.2 | Proposed, admin routes only |
| Tests | Vitest, Playwright | 5.0.4, 1.64.0 | Vitest in use, with happy-dom for component tests; Playwright proposed, and needed for anything that clicks through pages |
| Lint and format | Biome | 2.5.15 | Agreed |

What was measured on a throwaway TanStack Start + Solid app:

- Every page loads 48.3 kB of gzipped JavaScript before any application code. That is
  about what the current site ships (roughly 43 kB of vendored scripts plus two CDN
  libraries), so this is parity with today, not a reduction.
- An admin route using TanStack Table built into its own 8.6 kB chunk. Neither public
  page referenced it.
- All routes came back as server-rendered HTML.

What each choice replaces:

| Current | Replaced by |
|---|---|
| Django views, Wagtail page tree and routable pages | File-based routes and server functions |
| Wagtail admin, snippets, settings, ModelAdmin | Hand-built admin routes in the same app |
| Wagtail moderation (`submitted_for_moderation` revisions) | A revisions table and a small state machine |
| django-allauth (Discord only) | Better Auth |
| Django forms, pydantic | Zod schemas shared by forms, server functions, the API and the import |
| Markdown + bleach | `marked` + `sanitize-html` |
| Django templates, jQuery, jQuery UI, anime.js, Popper, Waypoints | Solid components |
| django-taggit, modelcluster | Plain join tables |
| Wagtail API v2, DRF serializers, drf-spectacular | Server routes under `/api` |
| gunicorn, WhiteNoise | The framework's Node server |

## Architecture

One application and one deployable. It has four kinds of code, and the rules between
them are what keep it clean:

- **Routes** render pages and call server functions. They hold no business rules.
- **Services** hold the rules: submitting, moderating, liking, reporting, validating.
  Server functions, API routes, scheduled jobs and the import all call the same services.
- **Database** is the Drizzle schema and the queries. Only server code imports it.
- **Integrations** wrap Discord webhooks, gametools.network and Cloudflare, each with a
  timeout and a failure path that never blocks the user's action.

Rules worth holding from day one:

- **Server-only code stays in server functions.** Route loaders can run in the browser,
  so database access and markdown rendering must never be imported by a loader directly.
  The build enforces this: client code that imports anything under `src/server` fails
  it. Client code reaches the server through the server functions in `src/functions`,
  or through a route's own server handlers.
- **Admin-only libraries are imported only from admin routes.** Anything the root layout
  or a public route imports lands in the shared bundle.
- **Every mutating server function checks the caller's role.** A separate bundle keeps
  the public site light; it is not access control.
- **One set of field definitions per entity, one schema per operation.** The rules for
  a field (how long a game's code is, what a Portal link must look like) are written
  once and shared by the forms, the server
  functions, the API and the import. Each operation then builds its own schema from
  them, listing exactly the fields that caller may send. The owner's edit schema has no
  `featured`, `owner_id` or `role`; the admin's does. Ownership and privileged values
  are set by the server, never read from the request. Checking the caller's role is not
  enough if the schema would have accepted the field.

Suggested layout:

```
src/
  routes/
    (public)/        home, library, experiences, scripts, updates, events, playtests,
                     users, submit, and placeholders for maps, tools, guides and forum
    admin/           overview, review queue, reports, experiences, snippets, update posts,
                     playtests, events and banners, categories, tags, users, settings
    api/             public JSON API, sitemap.xml, robots.txt, auth callback
  components/        shared Solid components (header, footer, page layout, search, avatar,
                     icons, cards, filters, markdown view)
  functions/         server functions: the only way client code calls into server/
  server/            never imported by client code; the build fails if it is
    services/        experiences, snippets, moderation, likes, reports, users, categories
    db/              schema, queries, migrations
    integrations/    discord, gametools, cloudflare
    auth/            Better Auth setup, role checks
  shared/            Zod schemas, types and constants used on both sides, including the
                     one list of site sections that the header, footer and home page read
jobs/                validate experiences, sync tags, post playtests and reminders (run as
                     CLI entry points)
tools/import/        the one-off legacy data import
```

## Rendering

Planned 2026-10-13, while there are few pages to change. The site is a hybrid: the
server renders a page's first load so search engines and link previews see real
content, and from then on the browser takes over and moves between pages without full
reloads.

What the framework gives, checked against the installed TanStack Start (1.168):

| Need | Mechanism |
|---|---|
| Server-rendered first load, then client navigation | The default. Every route is rendered on the server and hydrated today |
| Choosing per route | `ssr` on a route: `true`, `false`, or `'data-only'`, which runs the guard and the loader on the server and leaves the drawing to the browser. `defaultSsr` sets it for the whole router |
| A part of a page that cannot be drawn on the server | `ClientOnly` with a fallback, and `useHydrated` |
| Data that should not hold up the page | A promise returned from the loader and shown with `Await`; the server streams it in |
| Response headers per route | `headers` on a route |
| Pages built ahead of time | `prerender` in the Vite plugin |

Solid hydrates the whole page, not islands, but hydration there attaches to the
server's markup without drawing it again, so its cost is the script a page ships. "Only
hydrate what needs it" therefore means: ship little script to pages people only read.

Which pages get what:

| Pages | Rendering | Indexed | Why |
|---|---|---|---|
| Home, Library, an experience, the scripts list, a script, updates and one update post, events, playtests and one playtest, a profile, the disclaimer and other static pages | Server, then hydrated | Yes | These are what search engines and Discord link previews land on. Everything a visitor reads is in the server's HTML |
| Submit, edit, start a playtest, account settings | Server, then hydrated | No | They are forms and must work before any script loads. Signed-out visitors are redirected |
| Admin | `'data-only'` | No | No search value. The guard and the data run on the server, so a refused request gets a real status; the screens draw in the browser and their code stays out of every public page |
| The API, Atom feeds, sitemap, robots | Server routes | | Nothing to hydrate |

Rules that make this work, to hold from the first real page:

- **A page's content comes from its route loader,** which calls a server function. The
  same loader runs on the server for a first load and through a request for a client
  navigation, so there is one code path. A component does not fetch what the page is
  about.
- **Loader data is public.** It is written into the HTML for hydration. A server
  function returns only what the page shows; emails and admin-only fields never leave
  the server.
- **The address is the state.** Filters, sort, tab and page number are search
  parameters, validated with a Zod schema on the route. A filtered listing can be
  linked, reloaded and rendered on the server.
- **Server and browser must draw the same thing.** No clock, time zone, locale,
  random value, window size or browser storage in what is rendered. Specifically:
  - a date is rendered as a fixed American form in UTC inside `<time datetime>`, and
    switches to the visitor's time zone after hydration;
  - "5 hours ago" is worked out from a time the loader supplies, not from the clock;
  - what a visitor dismissed or chose (a banner, a tab) is kept in a cookie the server
    can read, not in browser storage.
- **Links and forms work without script.** Paging is a real link to `?page=2` that the
  browser turns into "show more"; filters are a GET form; like, report and submit are
  forms that post. Search engines follow links, not buttons.
- **Only what is needed up front holds up the page.** The title, description and main
  content are awaited. Side panels such as "More from this creator" may stream in.
  Nothing a page shows waits on gametools at request time: what it reports is stored
  by the nightly check.
- **Heavy code loads when used.** The Markdown editor, the admin screens and anything
  like them are separate chunks. Routes are split automatically; a large widget inside
  a public page is loaded on interaction.
- **Each indexed page sets its own head:** title, description, a canonical address, and
  Open Graph and Twitter tags with the cover image. A filtered or paged listing points
  its canonical at the unfiltered first page.
- **Statuses are real.** An experience that is missing, deleted or in any status but
  published answers 404 from the server to anyone but its owner and the moderators, an old address answers 301, and pages that are not for search
  carry `noindex`.

Session and caching. The root loader reads the signed-in user on the server, so the
header is right on first paint. That makes HTML differ per visitor, which is why the
plan had no HTML caching. Deferred on 2026-10-13, as a reasonable thing to do later:
a response to a request with no session cookie is
the same for everyone, so it could be sent with a short shared cache lifetime and
Cloudflare would serve it to the next anonymous visitor and to crawlers; a request
with a session cookie would skip the cache. That is one rule at Cloudflare and one
`headers` function, and nothing in the pages changes. It needs purging, or a short
lifetime, when a page is approved or edited. Until it is picked up, HTML is not
cached.

Checks:

- A test for each indexed page asks the server for it and reads the HTML without
  running any script: the title, description, canonical address and the main content
  must be there.
- A hydration mismatch warning fails the browser tests.
- One browser flow runs with scripts off: browse, filter, page, open an experience.

## URLs

Addresses of existing pages are kept so links, embeds and search results keep working.
The mockups add a Library that holds both games, and new sections; where that moves a
listing, the old address redirects.

| Path | Purpose |
|---|---|
| `/` | Home: see "Feature inventory" |
| `/library/`, `/library/bf2042/` | New. The experience listing, with a tab per game. Agreed 2026-10-13: each game's tab has its own path, so search engines see two pages and not one page with a parameter. Filters, sort and page number are search parameters |
| `/experiences/`, `/experiences/featured/` | Old listing. Redirect to `/library/` with the matching filter. The old query parameters are honored, `?tag=<name>` above all, since every tag chip on the old site is such a link |
| `/experiences/<slug>/`, `/experiences/<slug>/edit/` | Detail page; owner's edit form |
| `/category/<name>/` | Old category listing; `_` stands for a space. Redirects to `/library/` with that category selected |
| `/submit/` | Submit form for an experience (login required). The game is the first question; `?draft=true` draws a refused form again |
| `/submit/snippet/` | New. Submit form for a snippet, Battlefield 6 only (login required). `?draft=true` draws a refused form again |
| `/submissions/` | New. The signed-in visitor's own experiences and snippets, with the state of each. Not built |
| `/users/<discord_id>/`, `…/experiences/`, `…/liked/` | Profile and its two lists |
| `/users/admin/` | Profile of the legacy admin-owned experiences |
| `/scripts/`, `/scripts/snippets/`, `/scripts/experiences/`, `/scripts/featured/`, `/scripts/<slug>/` | BF6 scripts section |
| `/updates/` | New. Recent update posts across the site, with filters; `/updates/feed.xml` is the Atom feed |
| `/experiences/<slug>/updates/<id>/` | New. One update post; the experience page lists them |
| `/events/` | New. Upcoming and past events |
| `/playtests/`, `/playtests/<id>/`, `/playtests/new/` | New. Open playtests; one playtest's brief, with a link to its Discord thread; the form to start one |
| `/maps/`, `/tools/`, `/guides/`, `/forum/` | Sections in the navigation with a "not open yet" page |
| `/tutorials/` | Old placeholder. Redirects to `/guides/` |
| `/disclaimer/` | New. The fan site notice, which the footer also shows on every page |
| `/login/`, `/logout/` | Straight to Discord; no password or email flows. Logout is a POST |
| `/sitemap.xml`, `/robots.txt` | Generated from the database |
| `/api/experiences/`, `/api/users/` | Public read API |
| `/api/tags/`, `/api/categories/` | Autocomplete sources |
| `/admin/…` | Admin and moderation |

Changes to the URL surface:

- `/api/like/<id>/` and `/api/report/<type>/` become server functions. Liking is a GET
  today (`core/views.py:326`); it must not stay one.
- `/django-admin/`, `/documents/`, `/markdownx/`, `/ajax_select/` and the allauth
  password and email paths disappear.
- The repository does not show how the BF2042 home page and the BF6 home page are
  mounted in production (both are Wagtail root pages). The rewrite has one home page;
  2042 is a tab of the Library. Whatever address the 2042 home has today needs a
  redirect to `/library/bf2042/`.

## Data model

Flat tables, one row per thing, no inheritance. Names are suggestions.

### Users

Better Auth owns `user`, `session`, `account` and `verification`. Their Drizzle schema
is generated from the auth configuration, so the site's own fields are declared there
as Better Auth additional fields and survive regeneration. They sit on the user row,
which also puts the role on every session without a second query:

| Field | Note |
|---|---|
| `discord_id` | Unique. Profile URLs and the import key on it |
| `discord_username`, `avatar` | Refreshed on each login |
| `role` | `user`, `moderator` or `admin` |
| `hide_username` | Hides the name on cards, profiles and the sitemap |
| `legacy_id` | Old Django user id, kept for the import and for debugging |

Roles replace three things in the current site: the superuser flag, the "Moderators"
group and the "self edit" group that every user is added to. Regular users no longer
enter the admin at all; what they did there (see their own experiences, toggle
`hide_username`) moves to an account page on the public site. The `OWNERS` environment
variable, a list of Discord ids shown with an owner badge on profiles, stays as it is.

Who may write these fields:

- `discord_id`, `discord_username`, the display name and the avatar come from the
  Discord profile and are refreshed on each login. Better Auth only accepts provider
  values for fields it also accepts as client input, so its profile-update endpoint is
  disabled; nothing lets a user edit them.
- `role`, `hide_username` and `legacy_id` are written by server code only.

Better Auth's generated tables use timestamps without a time zone. The site's own
tables use `timestamptz` throughout.

### Experiences

| Field | Note |
|---|---|
| `id` | Old numeric ids are kept (the public API exposes them) |
| `slug` | Unique; kept from the old site |
| `game` | `bf2042` or `bf6` |
| `types` | New, Battlefield 6 only. What it is built with: any of `script` (TypeScript), `blocks` (the rules editor) and `spatial` (custom map data), or `verified` alone for a verified mode, which is official settings and a map rotation with none of the three. Read from an uploaded export, otherwise chosen on the form. Shown as tags on cards and pages, and filterable |
| `status` | `draft`, `pending`, `changes_requested`, `published`, `unpublished` or `removed`. See "Submission states" |
| `title`, `description_md`, `description_html` | Markdown is stored; HTML is rendered and sanitized on write |
| `owner_id` | The submitter. One per experience; the only one who can delete it or change who else works on it |
| `category_id` | Main category |
| `code` | Six characters in 2042, four or five in Battlefield 6 |
| `playground_id` | New. Portal's own id for the experience. Both of its pages on EA's side are addressed by it; see "The two Portal pages of an experience" |
| `copy_allowed` | New. Whether its creator lets others copy it in the Portal editor. Empty when nobody has said |
| `exp_url` | The link the old site stored, kept as imported. New experiences store the playground id instead, and the column goes once the import has shown every old link carries one |
| `cover_img_url` | An external URL, as today. The old `vid_url` moves into `experience_media` |
| `repo_url` | New. The project's source repository; owner-editable, so it goes through moderation like any edit |
| `files_url` | New. A link to files too large to upload: Dropbox, Google Drive or GitHub |
| `max_players`, `max_bots` | All its people and all its bots. Worked out from `team_setup` where there is one, and kept for listings to show and filter on |
| `team_setup` | New. For each team in order, how many people and how many bots, as its creator set them out. Null for an experience from the old site, which never asked; its page falls back to Portal's sizes for the first map |
| `featured`, `trending` | Admin only |
| `bugged`, `broken`, `xp_farm` | Health flags, set by people: the owner, an admin, or a moderator acting on reports. The nightly check no longer writes `broken` |
| `portal_state`, `portal_checked_at`, `portal_state_since` | New. What the nightly check last saw on Portal, when it looked, and since when the answer has been what it is. See "Whether a code is still published" |
| `xp_mode` | New. The progression mode gametools reports, stored by the nightly check: `portal-default` earns full XP |
| `requires_full_game` | New. Whether playing it needs the paid game or the free version will do. Empty when not known, and for 2042, which has no free version. See "Whether a code is still published" for the check that fills it |
| `sdk_version_id` | New, Battlefield 6 only. The SDK release that was current when it was submitted. Set by the site, not chosen; see "SDK versions" |
| `is_template` | New. The community's word for what the old site called a prefab: the creator offers the files so others can publish their own version with their own changes. Set on creation; shows a Template tag and makes the files downloadable. The import sets it for every experience in the old Prefab category. On submit it is a choice on the form where the game's Portal has an export (`hasExport` in the games registry), and otherwise follows the category: see `marks_template` under "Categories" |
| `allow_editing` | Stored and exposed by the API today but never enforced; keep the column, decide its meaning later |
| `reviewed_by`, `reviewed_at`, `review_note` | The moderator's decision on the submission itself; edits are reviewed on their revision. `reviewed_by` is for the moderators' screens and is never shown to the creator |
| `review_field_notes` | New. What the moderator wrote about particular fields when requesting changes, as JSON keyed by the form's field names. The form reopened to fix it shows each note at its field. Empty unless changes were requested |
| `copied_from_id` | New. On a playtest copy, the live experience it was copied from. Empty on everything else. See "Submission states" |
| `deleted_at` | Set when the owner deletes it; the row stays and is hidden everywhere |
| `submitted_at`, `first_published_at`, `last_published_at` | Today "first published" is set at submission (`core/views.py:204`); the new schema separates the two |
| `announced_at` | When the Discord announcement went out; replaces the `first_publish` flag |
| `meta_title`, `meta_description`, `meta_image`, `include_in_sitemap` | Embed overrides |

Join tables:

- `experience_creators`: the people it is by, besides the owner. See "Creators and
  collaborators"
- `experience_media` (experience, position, url). New. The gallery on the experience
  page after the cover image, up to eight links in order: each to a picture or to a
  YouTube video. The link is kept as typed; whether it is a picture or a video, and the
  video's thumbnail and player, are worked out from it when it is shown (`mediaOf` in
  `src/shared/media.ts`), so another video site is an addition there. Changed
  2026-10-16 from a list of pictures beside one `vid_url`, which this replaces: the
  import makes an old `vid_url` the first link, and one on Twitch or Vimeo, which
  cannot be embedded, is kept but not shown. Owner-editable, so they are part of an
  edit's payload.
- `experience_tags` (experience, tag, source). Tags belong to a game and to one of its
  groups; see "Tags and filters per game". `source` says whether the creator chose the
  tag, Portal reported it for the code, or it came from a map in the rotation.
- There is no subcategory table. What the old site called subcategories, and the form
  calls "Style", is a tag group: Casual, Competitive, Showcase and Example. The old
  "Jam" subcategory is imported as a hidden tag, so its experiences keep it but it is
  no longer offered.
- `experience_likes` (experience, user, created_at). One store, replacing the two
  that exist today (`core/models/users.py:41`, `core/models/experience.py:157`).
- `experience_reports` (experience, user, type, created_at), where type is `bugged`,
  `broken` or `xp_farm`. Replaces three separate join tables.

### Creators and collaborators

Asked for on 2026-10-13. The old site lets an owner list "additional creators", who
are credited and nothing else: every permission check there is "is this the owner".
The rewrite keeps the credit and adds people who can edit.

A row of `experience_creators` is a name or an account, and the database refuses a
row that is both or neither. An account may also be given edit access:

| Kind | What it is | What they can do |
|---|---|---|
| A name | Someone with no account here. The owner types the name | Nothing. It is a credit on the page |
| A credited account | A user the owner lists. Their name links to their profile | Nothing more than a name can. This is what the old site's "additional creators" are |
| A collaborator | A credited account the owner has given edit access | Everything the owner can, except the three things below |

| Field | Note |
|---|---|
| `user_id` or `name` | Exactly one |
| `position` | The order shown under "Made by", after the owner |
| `can_edit` | Off unless the owner turns it on. The database refuses it on a name |
| `accepted_at` | For an account: when that user accepted being listed. Empty means invited |
| `created_at` | |

Edit access is always an explicit choice, agreed 2026-10-13. Being listed never
grants it, and nothing turns it on in bulk: not the import, and not a default on the
form.

What a collaborator can do: edit the experience, post updates, start a playtest, say
which SDK release it works with, and mark it bugged or broken. Their edits and posts
go through moderation exactly as the owner's do, and the review screen shows who made
them.

What only the owner can do: delete the experience, add or remove creators, give or
withdraw edit access, and edit the named credits. A collaborator cannot add another,
so access never spreads past the people the owner chose.

How each is added:

- **A named credit is text someone typed,** so it is part of an edit and a moderator
  sees it before it appears.
- **An account is added by the owner, and accepts.** Until they accept they are not
  shown on the page, so nobody is credited on something they had no part in, and no
  moderator is needed. The request is shown on that user's account page. They can
  leave at any time, and the owner can remove them at once.
- **Edit access is a separate switch** beside each credited account. The owner can
  turn it on when adding someone or later, and off again at once. It has no effect
  until the account has accepted.
- **Turning a name into an account** is the owner adding the account once the person
  has one, and deleting the name.

On a credited account's profile the experience is listed among theirs, marked as a
collaboration, whether or not they can edit it. Likes received count for the owner only.

With more than one editor, the rule that an experience has one pending revision
matters more: a second edit replaces the first. The edit form therefore opens on the
pending revision when there is one, with a note of who submitted it, so a collaborator
adds to the owner's waiting edit instead of silently overwriting it.

`snippet_creators` has the same shape.

Proposed, not yet agreed: the accept step for a newly added account, and that
transferring ownership stays an admin action.

### Pending changes

A `revisions` table holds proposed changes; the experience row always holds what the
public sees.

| Field | Note |
|---|---|
| `experience_id` | |
| `kind` | `edit` or `clear_flags` (the owner asking for bugged/broken to be cleared) |
| `payload` | The editable fields as JSON, including tags and named credits. Credited accounts and their edit access are not in it; the owner changes those immediately. Admin-only fields are never in it, so approving an edit cannot revert a change to `featured` or a health flag made while it waited |
| `status` | `pending`, `approved` or `changes_requested` |
| `submitted_by`, `submitted_at` | |
| `reviewed_by`, `reviewed_at`, `review_note`, `review_field_notes` | As on an experience |

An experience has at most one pending revision, enforced by the database; a second edit
replaces the first. Approving applies the payload to the experience in one transaction. A new submission
needs no revision: it is simply an experience with status `pending`.

An edit that a moderator sends back is not thrown away. Its payload stays on the
revision, with the notes, and its owner reopens it from there, fixes it and sends it
again; the live page is unchanged throughout.

### Submission states

Set out by the owner on 2026-10-13 and worked through in the mockups the same day.
This is the model; "Submitting, and following a submission: the mockups" under
"Visual direction" is how it is drawn.

The pipeline, in the owner's words:

```
Draft
├─ Submitted, in review for publishing
│  ├─ Live
│  │  ├─ Delisted: gone from the game, or delisted by hand. Much like a draft again
│  │  ├─ Edit in review
│  │  └─ Update post in review
│  └─ Changes requested ─→ back to in review when resubmitted
├─ Draft submitted for playtest review
│  ├─ Playtest approved ─→ playtest completed, and it is a draft again
│  └─ Playtest changes requested ─→ back to playtest review when resubmitted
└─ Removed by a moderator: spam, or something badly wrong. No resubmission
```

**Three things are said about an item, and kept apart.** What it is, what was sent to
the moderators about it, and where that stands. They were first drawn as one row of
labels, then as "type" and "state", and settled as three columns:

| Column | What it says | Values |
|---|---|---|
| Status | What the item is right now | Draft, Playtest, Live, Delisted, Removed |
| Request | What was sent to the moderators about it, if anything | Submission, Edit, Update |
| Review | Where that request stands | In review, Changes requested |

So a live page with an edit waiting reads "Live, Edit, In review". A draft whose
playtest brief was sent back reads "Playtest, Submission, Changes requested". A review
word means the same thing whatever the request: anything waiting on a moderator is
"In review" and nothing more specific. An item with nothing sent in has a status and
nothing else.

**How each is kept.** The status column is not one stored value; it is read from
several.

| On the screen | In the database |
|---|---|
| Status: Draft | `status = 'draft'` on the experience or snippet. Also `pending` and `changes_requested`: something not yet approved is a draft to its owner, with a request beside it |
| Status: Playtest | A draft with a playtest that is not over: `playtests.status` is `pending`, `changes_requested`, or `approved` and not yet closed. Read from the playtest, not stored on the experience |
| Status: Live | `status = 'published'` |
| Status: Delisted | `status = 'unpublished'`, or `published` with `portal_state` `unpublished` or `missing` |
| Status: Removed | `status = 'removed'` |
| Request: Submission | The item itself is `pending` or `changes_requested`; or its playtest brief is |
| Request: Edit | A row in `revisions` that is `pending` or `changes_requested` |
| Request: Update | A row in `updates` that is `pending` or `changes_requested` |
| Review: In review | `pending` on whichever row the request is |
| Review: Changes requested | `changes_requested` on that row, with `review_note` and `review_field_notes` |

The values behind `status`, as of migration 0023:

| Value | Meaning | The site's word |
|---|---|---|
| `draft` | Saved by its owner and not sent in. Only they see it | Draft |
| `pending` | Sent in, waiting for a moderator | In review |
| `changes_requested` | Sent back with notes. The owner fixes it and sends it again, which makes it `pending` once more. Was `rejected`, which was an end state | Changes requested |
| `published` | Public | Live |
| `unpublished` | Taken off the listings by a moderator | Delisted |
| `removed` | Ended by a moderator, with a note, for spam or something badly wrong. It cannot be sent in again. Its owner still sees it in their list, so they know what happened | Removed |

`revisions.status` and `playtests.status` had `rejected` too, and it is
`changes_requested` there as well. A playtest has no "completed" status: an approved
playtest is over when it is closed, which `closes_at` says.

**A moderator's notes.** A decision to request changes carries a note about the whole
thing (`review_note`) and notes on particular fields (`review_field_notes`, JSON by
field name). The creator sees them on the form reopened to fix it, each at its field,
and never sees who wrote them.

**Playtests.** A draft that goes to playtest is shown as "Playtest", not "Draft", from
the brief being sent in until the playtest is over. Then it is a draft again, and its
line says when the playtest was completed.

**Playtesting something that is already live.** Agreed 2026-10-13. A playtest is never
run on the live listing. Its owner opens the live experience and chooses "Playtest";
that clones it as a new submission, which starts as a draft and records what it was
copied from (`copied_from_id`). The copy is its own row in the owner's list ("Playtest
copy"), goes through playtest like any draft, and when the playtest is over is marked
completed and can be discarded. The live page is untouched throughout.

**What is in place, and what is not.** The database holds all of the above as of
migration 0023, which also gave snippets the review columns experiences have. The
site does the least it must to agree with it:

| Piece | State |
|---|---|
| The six statuses, and `changes_requested` in place of `rejected` everywhere | Done. The experience page names the status to its owner; the moderators' button is "Request changes" |
| The SDK release set at submit and not asked for | Done |
| Sample data with a draft, one with changes requested and field notes, and one removed | Done, in the seed |
| Saving a draft without submitting | Not built. Submitting still creates `pending` |
| Fixing something with changes requested and sending it again | Not built. Nothing moves `changes_requested` back to `pending` yet |
| Writing notes against fields, and removing something for good | Not built. The review screen has one note box and two buttons |
| "Your submissions" | Not built |
| Submitting a snippet | Done, 2026-10-13. It is created `pending`; its owner sees it at its own address with its status, and nobody else does until it is approved |
| Reviewing a snippet | Done, the least of it: waiting snippets are in the review queue, and Approve and Request changes are on the snippet's own page for a moderator |
| The playtest copy | Not built. No playtest can be started from the site yet |
| A snippet held to a size | Done in the form and the service: 400 lines, `MAX_SNIPPET_LINES` in `src/shared/snippet-form.ts`. The number is still a placeholder, and the column itself has no limit |

`submission_drafts` is not the draft status. It keeps one refused form per user so a
page posted with no script can be drawn again filled in, and may hold values a real
row would refuse. Once drafts are built it may fold into them. Both submit forms use
it, so the kept form says which it was for (`kind: 'snippet'`), and each page ignores
the other's.

**Not decided.** Raised on 2026-10-13 and left open:

- **Several requests at once.** A live page can have an edit and an update post both
  in review, and an open playtest copy besides. The mockup's row shows one request,
  the most recent.
- **Who can delist, and who can undo it.** The outline has "delisted by hand" without
  saying whose hand. Portal no longer having the code undoes itself when the code is
  back; a moderator's unpublish exists; an owner delisting their own, and listing it
  again, is drawn in the mockup and is not in the schema.
- **The owner's own way out:** withdrawing something from review back to a draft, and
  what deleting keeps.
- **How what a playtest copy taught reaches the live page.** The copy is discarded, so
  presumably by an ordinary edit to the live one. Nothing carries the changes across.
- **The copy's code.** A build under test is usually a different experience on Portal
  with its own code, so the copied code would need replacing before the playtest.
- **What discarding a copy keeps:** the playtest's page and its feedback, or not.
- **A live page with a mark on it:** bugged, broken or XP farm, and the owner's request
  to have a mark cleared, which is reviewed too, are not in the three columns.
- **A history of decisions.** `review_note` holds the last note only, so a moderator
  looking at something sent in again does not see what was asked for before. The
  `moderation_log` table suggested under "Shown in the mockups, not yet in the
  schema" would hold it.
- **What a legacy "rejected" becomes at import:** `changes_requested` or `removed`.

The alternative is a fully relational versions table, where an experience points at its
live version and every join hangs off a version. It gives history for free, but every
listing query gets more complicated. Pending edits are short-lived and read on one
screen, so the JSON payload is the better trade.

### Categories

Today there are four tables with identical columns (experience main, experience sub,
script main, script sub). One `categories` table with a `kind` column covers three of
them; experience subcategories became a tag group:

| Field | Note |
|---|---|
| `kind` | `experience_main`, `script_main` or `script_sub` |
| `game` | Empty for a category both games use. The old "Prefab" category is renamed "Templates" and belongs to Battlefield 2042 only; for Battlefield 6 a template is a flag, not a category |
| `name`, `slug` | Unique per kind |
| `icon_svg` | Sanitized SVG markup stored in the row |
| `visible`, `selectable_on_form`, `not_ready` | Same meaning as today |
| `marks_template` | New in migration 0024. What is submitted in this category is a template. Set on Battlefield 2042's "Templates", whose form has no template choice of its own because its Portal has no export. The import must set it on the old Prefab category |
| `description_md`, `meta_title`, `meta_description`, `meta_image` | |
| `sort_order` | New; ordering is by id today |

The cost is that "an experience's main category must be of kind `experience_main`" is
checked in the service, not by a plain foreign key.

Storing icons as text means the new site needs no upload storage at all: experience
cover images are external URLs, and the Wagtail image library is only used by a few
staff-written home page blocks.

### Tags and filters per game

The two games do not share a set of filters, noted 2026-10-13. Battlefield 2042's
Portal mixed content from four games, so its experiences are told apart by era:
Battlefield 2042, 1942, Bad Company 2 and Battlefield 3. Battlefield 6 has no eras; its
experiences are told apart by what they are built with.

The tags come from Portal itself, through gametools.network
(`/<game>/availabletags/`, checked 2026-10-13), and the two lists are different:

| | Battlefield 2042 | Battlefield 6 |
|---|---|---|
| Tags | 40 | 11 |
| Eras | Four of the tags: `kingston_era` (shown as "2042"), `1942_era`, `bc2_era`, `bf3_era`. Each means the experience includes a faction from that game. `mapdefault_era` ("Map faction") means each map uses its own | None |
| Grouping | Portal puts each tag in one of three groups: general, mode or package | All in one group |
| Names | English names and a one-line description come with the list | Ids only (`custom_scripted`, `Core_Modes`, `Short_Experience`); the site has to supply the names |
| Same id, different meaning | `custom_scripted` is "Custom logic", the rules editor | `custom_scripted` is a script or blocks |

So a tag is not one thing across both games, and the `tags` table as built (a name and
a slug, each unique across the site) is not enough.

#### The tag system

Direction set 2026-10-13: tags are flexible, admins shape them per game without a
deploy, and a future Battlefield title fits in without redesign. The rule that follows
is that nothing about a particular game's tags or filters is written in code. Era is
not a column or an enum value; it is a group of tags that 2042 happens to have.

Three tables replace the one:

`tag_groups`, a named set of tags within one game. Admins create, rename, order and
remove them.

| Field | Note |
|---|---|
| `game` | A group belongs to one game |
| `name`, `slug` | "Era", "Rules", "Topic". Unique per game |
| `sort_order` | The order in the Library's filter row and on the experience page |
| `filter` | `own` gives the group its own filter in the Library, as Era has; `shared` puts its tags in the general Tags picker; `none` keeps it off the filter row |
| `pick` | `any` or `one`: whether an experience may carry several tags from the group |
| `creator_selectable` | Whether creators choose from this group on the submit form. Off for a group only Portal or an admin sets. As seeded 2026-10-13 the form asks for Style and Topic; Rules (both games) and Era (2042) are Portal's own tags and are off, which is what makes the 2042 form the short one in its mockup |
| `show_on_card` | Whether a card shows a tag from this group |
| `description` | A hint on the form and in the filter |

`tags`, changed:

| Field | Note |
|---|---|
| `game`, `group_id` | A tag belongs to one game and one group of that game |
| `name`, `slug` | What the site shows. Unique per game. Admins edit it |
| `portal_id`, `portal_name` | Portal's id and its own name for the tag, which the nightly sync and the code lookup match on. Empty for a tag an admin added. The sync never overwrites `name` |
| `description` | Starts as Portal's one-line description |
| `sort_order`, `visible` | A hidden tag stays on experiences and in the API but leaves the filters and the form |

`tag_aliases` (game, alias, tag). Other names a tag answers to. It is what makes a
merge safe: merging `BFBC2` into `BC2` moves the experiences across and leaves `BFBC2`
as an alias, so an old link such as `/experiences/?tag=BFBC2` still lands on the right
filter. Portal's upper-case names from old links are aliases too.

How it behaves:

- **The Library builds its filter row from the selected game's groups.** No filter is
  named in code. The filters that are not tags (players, health, sort, and "built
  with" where a game has exports) come from the game's entry in the registry below.
- **The nightly sync only adds.** A tag Portal has and the site lacks arrives in the
  game's "New from Portal" group, hidden, for an admin to name and place. The sync
  does not rename, move or delete anything an admin has touched.
- **Creators pick, admins create.** As on the old site, the submit form offers existing
  tags and does not let a creator invent one. Tags set from a code lookup are added for
  them.
- **One address parameter.** A tag's slug is unique within its game, so every tag
  filter, whatever group it is in, is the one `tag` parameter. Several are joined with
  dots, `?tag=bc2.bf3`: the router would write a real list as JSON and a comma would be
  percent-encoded, while a dot is neither and no slug contains one. A repeated
  `tag=…&tag=…`, which a form sends without script, is read the same way. A slug the
  selected game does not have is ignored, so a link survives switching tabs. Within a
  group any chosen tag will do; across groups all must hold.
- **Admins manage it on one screen per game** (Categories and tags, admins only):
  groups in order, the tags in each with how many experiences use them, and add,
  rename, hide, move to another group, and merge.

How the two games start out:

| | Battlefield 2042 | Battlefield 6 |
|---|---|---|
| Era (`own`, any) | 2042, 1942, BC2, BF3, Map Faction | No such group |
| Rules (`shared`, any) | Portal's other 35 tags | Portal's 11, named by an admin |
| Style (`own`, any, shown on cards) | Casual, Competitive, Showcase, Example, and whatever production's subcategories are | Casual, Competitive, Showcase, Example |
| Topic (`shared`, any) | Zombies, Gun Game and the like; the 2022 import's mode and size tags land here | The same idea, its own list |

The rest of each tab's filter row, which is not tags:

| Filter | Battlefield 6 | Battlefield 2042 |
|---|---|---|
| Category tabs | The Battlefield 6 categories (see "Open decisions") | Multiplayer, Co-op, Solo, Templates |
| Built with | Script, blocks, custom map, verified mode | No. 2042 has nothing to export; "Custom logic" is one of its rules tags |
| Templates | A switch | A category tab |
| Players | Yes | Yes |
| XP | Full XP only. The Battlefield 6 lookup reports a progression mode too (`portal-unranked` for `1264G`) | Full XP only |
| SDK version | By season, and current season only | No |
| Free or full game | Works on the free version | No. 2042 has no free version |
| Health | Hide bugged or unavailable | Hide ones that no longer load, on by default |
| Default sort | Trending this week | Most liked, all time |

#### Games

What a game is, kept in one place so the next title is an addition and not a search
through the code. `src/shared/games.ts` holds one entry per game:

| Entry | Battlefield 2042 | Battlefield 6 |
|---|---|---|
| Name, short name, order of the Library tabs | | |
| Code format | Six letters and digits | Four or five |
| gametools path | `bf2042` | `bf6` |
| Public page of an experience | None | `www.ea.com/games/battlefield/battlefield-6/portal/buy/creation/<playground id>` |
| Editor link of an experience | `portal.battlefield.com/experience/rules?playgroundId=<playground id>` | `portal.battlefield.com/bf6/experience?id=<playground id>` |
| Accent | Teal | The site's orange |
| Open for submissions | Yes | Yes |
| Takes an export, and has "built with" | No | Yes |
| Maps have eras | Yes | No |
| Reports an XP mode | Yes | Yes |
| Has a free version | No | Yes, so maps and experiences say whether they need the paid game |
| Has SDK releases, and where the latest is published | No | Yes, `download.portal.battlefield.com/versions.json` |
| Default sort and health filter | See above | See above |

Pages, forms, validation and jobs read from that entry; none of them tests for a
particular game by name. `[data-game]` on the page picks the accent.

Adding a title is then: an entry in the registry, one new value for the `game` column,
and whatever is truly new about it, such as how its code lookup answers or what its
export looks like. Its categories, tag groups and tags are data an admin enters, and
the Library tab, filters and submit form follow from those.

The `game` column stays a fixed list in the database. Making games rows in a table
would let an admin add one without a deploy, but a new title always needs code for its
lookup and its files, so the table would only add a way to create a game that does not
work.

The schema is built this way as of 2026-10-13: `tag_groups`, the reshaped `tags`,
`tag_aliases`, `maps`, `map_tags`, `sdk_versions`, `experience_tags.source` and
`experiences.xp_mode`.
The database refuses a tag in another game's group and an alias pointing at another
game's tag. It cannot say "a tag of this experience's game", so the service checks
that, as it does for categories. Not built yet: the registry in `src/shared/games.ts`,
which arrives with the first page that reads it, the nightly sync, and the admin
screen.

#### SDK versions

Asked for on 2026-10-13: a Battlefield 6 experience shows which release of the Portal
SDK it works with. Scripts and custom maps are built against a release, and a new one
can break them, so the version tells a visitor whether a template or script is likely
to work today.

Where the version comes from:

- **Nothing reports it per experience.** Neither the export nor the gametools lookup
  carries an SDK version; the `version` fields in an export are attachment revision
  numbers. Changed 2026-10-13: the form does not ask. Battlefield 6 only ever runs the
  latest release, so anything submitted is for the latest one, and the site records
  that release on the submission itself. The form says which release that is. This
  holds for snippets and experiences alike. The experience form had a "Works with
  SDK" choice; it came out the same day, and `submitExperience` sets the game's
  newest release. A game with no releases recorded, as 2042 is, gets none.
- **Portal names only the latest release.** `https://download.portal.battlefield.com/versions.json`
  answered on 2026-10-13 with one entry, `1.4.3.0`, and a file size. It has no history,
  dates or season names. It answered without a browser user-agent from here, but it is
  reported to want one, so the job sends one.
- **The history is entered once.** Releases so far, newest first:

| Season | Releases |
|---|---|
| Season 4 | 1.4.3.0, 1.4.2.0, 1.4.1.0 |
| Season 3 | 1.3.3.0, 1.3.2.0, 1.3.1.1, 1.3.1.0 |
| Season 2 | 1.2.3.0, 1.2.2.0, 1.2.1.0 |
| Season 1 | 1.1.3.0, 1.1.2.0, 1.1.1.0 |
| Launch (season 0) | 1.0.1.0 |

`sdk_versions` holds them, per game:

| Field | Note |
|---|---|
| `game`, `version` | Unique together. 2042 has no SDK and no rows; a later title has its own |
| `season` | A label an admin can edit: "Season 4", "Launch". For Battlefield 6 the second number of the version is the season, which the job uses as its first guess |
| `sort_order` | Newer is higher. Version strings do not sort as text (`1.4.10.0` against `1.4.9.0`) |
| `released_at` | When the job first saw it. Empty for the releases entered by hand |

`experiences.sdk_version_id` and `snippets.sdk_version_id` point at one release: the
one that was current when it was submitted, set by the site and not chosen on the
form. The database refuses a release from another game. This is its own table and not a tag group, although it is shown as a tag,
because it has an order, a latest and a date, and because scripts need it and scripts
have no tags.

What the site does with it:

- **Shown as a tag** beside "built with" on the experience and script pages, with its
  season. When it is behind the latest release, it says by how much: "SDK 1.3.2.0,
  Season 3, five releases ago".
- **A Library and Scripts filter:** by season, and "current season only".
- **The nightly job** asks for the latest release and adds a row when it is new. It
  changes nothing on experiences; only a creator says an experience works with a
  release.
- **After a release,** owners see "still works on 1.4.3.0?" on their own pages, one
  press to confirm. Proposed before the form stopped asking, and not confirmed since:
  with a game that only runs its latest release, this press is the only way a page's
  release moves forward without being submitted again. The change is immediate and is not held for a moderator. It is
  not part of an edit's payload, so a pending edit neither carries nor reverts it.
- **Not asked for** where it means nothing: a verified mode has no script or custom
  map, so it has no SDK version.

The lookup has a related signal: `attachmentCompileStatus`, which read
`ATTACHMENT_COMPILE_STATUS_OK` for `1264G`. If Portal recompiles scripts after a
release, a failing status would say an experience broke without anyone reporting it.
What it reads for a script a release has broken is not known yet; worth storing from
the nightly check and watching across the next release.

Later, out of scope for now (noted 2026-10-13): checking a project against a release
automatically. Where the site holds an experience's files, which it does for templates
and snippets, it could tell whether they still fit the current SDK without anyone
having to say so.

A release can break any of the three things an experience is built with, and each
needs its own check:

| Built with | What changes between releases | What a check compares | Where the site has it |
|---|---|---|---|
| Script | Functions are removed or their signatures change | The functions `Script.ts` calls, against the release's type declarations. A lighter form checks only that each function still exists; a full type-check also catches a changed signature | The `Script.ts` attachment |
| Blocks | Blocks follow the script API, so when a function goes, so does its block | The type of every block in the rules tree, against the blocks the release offers | `workspace.mod.blocks` in the export |
| Custom map | Spatial objects are renamed, removed or lose a property | The type of every object in the layout, and the properties set on it, against the release's object catalog | Each `*.spatial.json` attachment, and the Godot scene if uploaded |

In the one export examined, a spatial layout is two lists of objects, each with a
`type` such as `HQ_PlayerSpawner`, `SpawnPoint` or `ContainerStandard_01_1280` and its
own properties, and the rules are a tree of blocks each with a `type`. So all three
checks come down to the same thing: the names a file uses, against the names a
release has.

The result is then per part, not one verdict: "script compiles against 1.4.3.0, two
map objects no longer exist". It would let the site suggest the SDK version on upload
and tell an owner after a release which templates broke and what to change, in place
of the "still works?" prompt. Things to settle when it is picked up:

- **Getting each release's catalog.** Three are needed: the type declarations, the
  block definitions and the spatial object list. `versions.json` gives the size of the
  SDK download, about 3.5 GB. Whether the three can be had without the whole archive,
  and where in the SDK the blocks and objects are listed, is not known.
- **Whether the site may keep them.** They are EA's. Using them inside a job is one
  thing; publishing them is another.
- **What a pass means.** Files that fit a release can still behave differently in it.
  A pass is shown as "fits", separate from the creator's "works with".
- **It only reads.** Checking never runs a creator's script.
- **Order.** They can arrive one at a time. The script check is the best understood;
  the spatial one may matter most, since a missing object is hard for a creator to
  spot.

The schema is ready for it: the files are in `project_files` by kind, and releases in
`sdk_versions`. It would add a table of each release's known names by kind (function,
block, object), and a table of results (file, release, outcome, messages, when).

#### Eras and maps on the old site

Read from its code on 2026-10-13. It has no era field
and no era filter; the filter panel offers name, creator, category, tags, a date range
and a sort. Era shows up in four places:

| Where | What |
|---|---|
| The tag list | Portal's four era tags, synced from gametools with the rest (`core/helper.py:128`) and found through the tag filter like any other |
| The 2022 bulk import | `db.json` holds 220 experiences tagged by hand, and `import_db` adds those tags as written. Its era tags are spelled differently from Portal's: `BF2042`, `BF3`, `BFBC2`, `BF1942` against `2042`, `BF3`, `BC2`, `1942`. 95 of the 220 carry at least one. It also has mode tags (Conquest, Rush, Team Deathmatch, Free For All) and size tags |
| The mock data command | A list of 18 of 2042's Portal maps by level id, each with EA's map artwork (`core/management/commands/mock.py:117`), used only to give mock experiences a cover. A note beside it says to use gametools' map list instead |
| The experience page | The browser asks gametools for the rotation and shows each map's name, mode and picture (`core/templates/core/experience_page.html:353`). Nothing is stored, so nothing can be filtered on it |

A live example, read on 2026-10-13: `/experiences/payload-classic/` ("PAYLOAD", code
`AA3HNY`).

- Its tags are chips under the description, and each one links to the listing filtered
  by that tag: `/experiences/?tag=VEHICLE MODIFIERS`. That link is how the old site
  filters by era.
- It has no era tag. It has Map Faction, which means each map brings its own era, and
  its rotation runs across all four: Exposure (2042), Valparaiso (BC2), Battle of the
  Bulge (1942), Caspian Border (BF3) and nine more.
- The creator typed the era beside each map in the description by hand, because the
  page shows the rotation only after "Show Maps Rotation" is pressed.
- The same press shows an XP badge: "XP Full" when gametools reports the progression
  mode `portal-default`, otherwise "XP Restricted". This one is restricted.

Three consequences:

- **Tag links are addresses to keep.** `/experiences/?tag=<name>` redirects to the
  2042 tab with that tag selected. The name in the link is Portal's upper-case one.
- **XP is worth storing.** The nightly check already reads it, so it can be a badge on
  cards and a 2042 filter ("full XP only") instead of something seen after a click.
- **The import has to merge the two spellings.** If production ran `import_db`, it has
  both `BC2` and `BFBC2`, and both `1942` and `BF1942`. The import maps the hand-written
  ones onto Portal's.
- **The era tags are not enough for maps.** Portal's era tag means the experience
  includes a faction from that game. Looked up on 2026-10-13, "Domination CTF"
  (`AAZPR7`) carries only the 2042 tag, and its rotation includes Caspian Border, a
  Battlefield 3 map.

So maps need their own data. The 2042 lookup returns, for each map in the rotation, its
name, its mode and a picture whose file name carries the game it came from
(`Map_Art_BF3_CB`, `Map_Art_BFBC2_AH`, `Map_Art_BF2042_ORB`). Proposed:

- A small `maps` reference table: game, Portal's level id, display name and picture.
  2042's list is finished, so it is entered once. It also supplies the display names
  Battlefield 6 exports need.
- `map_tags` (map, tag). A map carries tags like anything else, so a 2042 map is given
  its era from the Era group. Nothing about eras is built into the table, and a later
  title can tag its maps by whatever sets them apart.
- `experiences.map_rotation` is filled for 2042 as well, and a new `xp_mode` column
  holds the progression mode. The nightly check already looks up every code, so
  neither costs extra requests.
- When a rotation is stored, the experience takes on its maps' tags. `experience_tags`
  gains a `source` (`creator`, `portal` or `map`), so the tags that came from maps can
  be refreshed without touching the ones a creator chose. The Era filter is then an
  ordinary tag filter, and PAYLOAD is found under all four eras.
- A Map filter, grouped by era, can follow from the same data.

### BF6 snippets

`snippets` mirrors experiences where the two overlap (slug, title, description, owner,
status, featured, trending, publish dates, embed overrides) and adds:

| Field | Note |
|---|---|
| `category_id` | A `script_main` category |
| `exp_json` | The Portal export a snippet from the old site was made from. Kept for those; nothing new sets it |
| `script` | The snippet itself. For one from the old site it is the decoded `Script.ts` attachment of its export. The old site calls this column `code`; it is renamed because `code` on an experience and a playtest is the Portal share code |
| `vid_url` | |
| `sdk_version_id` | New. The SDK release that was current when it was submitted. Set by the site, not chosen |
| `reviewed_by`, `reviewed_at`, `review_note`, `review_field_notes` | New in migration 0023. The moderator's decision, as on an experience. Snippets had none, since nobody outside the admin could submit one |

With `snippet_creators`, which holds named credits and collaborators as for experiences, and `snippet_likes`. Snippets have no tags and no subcategories. On the old site
they have no public submit form: they are authored in the admin, and their edit route
is a "coming soon" page (`bf6/models/scripts_page/snippets.py:154`).

What a snippet is, agreed 2026-10-13:

- **A small, reusable piece of script to copy into your own.** Not a whole
  experience: that is submitted as an experience, where its files can be offered as
  a template.
- **Battlefield 6 only.** 2042's Portal had no TypeScript. Whether a game has
  snippets is a field of its entry in `src/shared/games.ts`, not a test of its name.
- **Anyone signed in can submit one,** at `/submit/snippet/`. It is pasted in or
  uploaded as one `.ts` file, and nothing else: no Portal export. The form asks for a
  title, a description, the snippet and a category.
- **It is reviewed like an experience,** with the same statuses, and counts against
  the same limits on how many may be waiting.
- **It is held to a size.** The mockup shows 400 lines; the number is not decided.

Built 2026-10-13, in `src/server/services/snippet-submissions.ts`:

- The form's rules are `snippetFormSchema` in `src/shared/snippet-form.ts`: a title
  of 3 to 80 characters, a description, the snippet (not empty, at most 400 lines)
  and a `script_main` category that exists.
- The game is the one whose registry entry has `snippets: true`, and the SDK release
  is that game's newest, as for an experience. Neither is asked for.
- The limits on waiting and daily submissions are counted across experiences and
  snippets together (`submissionLimit`).
- With no script, a `.ts` file is read on the server: up to 500,000 bytes, and only
  when the box is empty. With script, the file is read into the box in the browser.
- A snippet that is not published is shown at `/scripts/<slug>/` to its owner and to
  moderators, with its status and any note; anyone else gets "not found".

Still to read from production: which `script_main` categories exist. The form offers
whatever rows there are.

Experiences and snippets stay separate tables. A shared "content item" table with
per-type detail tables would make likes, creators and moderation generic, but it is the
same shape as Wagtail's page inheritance, which is what made the current schema awkward.
Revisit it if a third content type arrives.

### Update posts

New in the rewrite. A project page is no longer only a description and a code: its
creators can post updates on it, like a small blog. Release notes, a status report on
something still in progress, a call for testers.

| Field | Note |
|---|---|
| `experience_id`, `snippet_id` | Exactly one is set, enforced by the database. Maps and tools get a column each when they get tables |
| `author_id` | The owner or a collaborator |
| `title`, `body_md`, `body_html` | Markdown, rendered and sanitized on write, as for descriptions |
| `status`, `published_at` | The same four states as an experience. A post starts `pending` and a moderator approves it |
| `reviewed_by`, `reviewed_at`, `review_note` | A moderator's removal or approval |
| `deleted_at` | The author's own delete |

One table for every project type keeps the feed a single query. The alternative, a
shared "project" row that experiences, snippets, maps and tools all hang from, would
make updates, likes and creators generic, but it is the same inheritance shape the plan
already turned down for experiences and snippets.

Where updates show up:

- On the project page, newest first, under the description.
- In a site-wide feed of recent updates, filterable by game and by kind of project
  (experiences, scripts, and later maps and tools), with a short version on the home
  page.
- As an Atom feed for the whole site and for each project, so people can follow a
  project without an account.
- In the public API.

### Project files

New in the rewrite. A creator can upload the files behind a project, and the site can
fill in the submit form from them.

The files that exist for a Battlefield 6 Portal project:

| File | What it is |
|---|---|
| Experience export (`.json`) | Everything Portal exports: name, description, game mode, mutators, team sizes, the map rotation, the rules workspace, and the attachments below, base64-encoded |
| `Script.ts` | The TypeScript script; an attachment inside the export |
| `*.spatial.json` | A map's spatial layout; one per map in the rotation, inside the export |
| `Strings.json` | The script's strings; inside the export |
| `*.tscn` | The Godot scene a spatial layout was built from. Not in the export; uploaded separately |

The easy path is one upload: the creator drops the export on the submit form. Read from
one real export (`movement_probe_experience.json`), it gives:

| Form field | From the export |
|---|---|
| Title, description | `name`, `description`. Portal's default description ("Experience description.") is flagged so it is not published as is |
| Players | The sum of `humanCapacity` across `teamComposition` |
| Game mode | `gameMode` |
| Map rotation | `mapRotation`: a map id and its spatial layout per entry. Map ids need a table of display names |
| Script, rules, strings | The `Script.ts` attachment, the block tree under `workspace.mod.blocks`, and `Strings.json` |

It does not contain the experience code, the Portal link, tags, a category or a cover
image. The code lookup below supplies most of those. Bots were absent from the one export examined; that needs
checking against an experience that has them.

Storage. Every one of these files is text, so they are stored in the database:

| Field | Note |
|---|---|
| `experience_id`, `snippet_id` | Exactly one is set |
| `kind` | `export`, `script`, `spatial`, `scene`, `strings` or `other` |
| `filename`, `size_bytes`, `sha256` | |
| `body` | The file's text. The table is read only when a file is viewed or downloaded |
| `map_index` | For a spatial layout or scene: which map of the rotation |
| `from_export` | Whether it was taken out of the export or added separately |

`experiences.game_mode` and `experiences.map_rotation` hold what the page shows, so a
listing never opens a file.

Rules:

- The export is validated against a Zod port of `bf6/models/bf_experience_export.py`
  before anything is read from it. This is the validator snippets already need.
- Files are shared when the creator offers the experience as a template. Otherwise the
  export only fills the form and nothing is stored.
- Files are served as downloads or shown as escaped text, never as a page: a fixed
  plain-text or JSON content type, `nosniff`, and `Content-Disposition: attachment`.
- 2 MB per file, and only `.json`, `.ts` and `.tscn`. A larger file, typically a big
  Godot scene, is hosted elsewhere and linked through `experiences.files_url`, which
  accepts Dropbox, Google Drive and GitHub addresses.
- Files are part of what a moderator reviews, on submission and on every edit.

Snippets already keep their export in `snippets.exp_json`. They can move to this table
later so there is one way to store a project's files.

### The two Portal pages of an experience

Clarified 2026-10-13. An experience has two pages on EA's side, for two different
people, and the site links to both. Both are addressed by the same playground id.

| | The public page | The editor link |
|---|---|---|
| What it is | The experience's page on EA's Battlefield website, in its public browser of published experiences | The experience opened in the Portal editor |
| Who it is for | Someone who wants to play it | A creator who wants to see how it is built, or start their own from it |
| When it works | Whenever the experience is published | Only when its creator has allowed copying |
| Where | `www.ea.com`, Battlefield 6 only | `portal.battlefield.com`, both games. It is what the old site calls the "Experience URL (for editing and copying)" |
| On the site | "View on Battlefield" | "Open in the Portal editor", shown only when copying is allowed |

What follows:

- **The site stores the id, not the links.** `experiences.playground_id` holds it, and
  each game's entry in the registry says how its two addresses are built. A changed
  address on EA's side is then one line to fix, not a column to rewrite.
- **The id comes with the code.** The lookup returns it, so a creator who gives a code
  types nothing more. A creator who pastes either link gives it too: the form reads
  the id out of the link and looks the experience up by it.
- **A pasted editor link comes in many forms.** The editor has a page per step, and a
  creator copies whichever one is open. For Battlefield 6 they all sit under
  `/bf6/experience` and end in `?id=<playground id>`:
  `/bf6/experience?id=…`, `/bf6/experience/settings/mode?id=…`,
  `/bf6/experience/choose-maps?id=…`, `/bf6/experience/teams?id=…` and more. For 2042
  they sit under `/experience` and the parameter is `playgroundId`. So the form does
  not match a whole address. It checks the host, checks the path starts with the
  game's editor prefix, and reads the one parameter. The link the site shows is
  always the plain first form, whatever was pasted.
- **Copying is the creator's to declare.** `copy_allowed` is a box on the form, "others
  can copy this in the Portal editor". It may also be detectable: one seed experience
  of 34 came back from the lookup with its rules, script and spatial data, and "its
  creator allows copying" is the likeliest reason. That is a guess until it is checked
  against an experience whose setting is known.
- **Copying on Portal and a template here are two routes to the same thing,** starting
  your own version from someone's work. An experience can offer either or both: the
  editor link copies it inside Portal, and a template's files can be taken without
  Portal at all. The experience page puts the two side by side under "Build on this".
- **The old site's links are editor links.** The import reads the playground id out of
  each `exp_url`, keeps the link as it was, and reports any with no id in it.

### What gametools.network returns for a code

Checked on 2026-10-12 against `https://api.gametools.network/bf6/playground/` with real
codes, including `1264G`. The lookup takes `experiencecode` or `experienceid` and needs
no key. The site already uses the 2042 equivalent.

| Form field | From the lookup |
|---|---|
| Title, description | `playElement.name`, `playElement.description` |
| Cover image | `playElement.thumbnailUrl`, the thumbnail chosen in Portal |
| Map rotation | Each map's display name, level id, image, rounds and team sizes |
| Players | Team capacities, summed |
| Tags | Portal's own tags, such as `custom_scripted` and `Core_Modes` |
| Still loads | `publishStateType` and `moderationState`, which the nightly validation can use |

For most experiences it does not return the script, the blocks or the spatial data,
and only the export has those. So the two sources complement each other. The code
gives the listing details and the cover image; the export gives the files, exactly
what a template is built with, and the precise "built with" types. From the lookup
alone, `custom_scripted` says a script or blocks are used but not which.

Corrected 2026-10-13 after looking up 34 codes for the seed data: one of them, `zd7hy`,
did come back with everything. Its reply held the rules as `modRules` and three
attachments: `Script.ts`, a spatial layout of about 1.2 MB, and `blacklist.json`. What
makes Portal include them for one experience and not the others is not known; the
other four tagged `custom_scripted` had none. When they are present, "built with" can
be read from the lookup with no upload. They are the creator's work, so the site does
not store or show them unless the creator offers the experience as a template.

Also learned from those 34:

| Field | What was seen |
|---|---|
| Progression mode | `portal-default`, `portal-default-backfillai`, `portal-unranked` and `official-progression`. EA's own website labels only `portal-default` as full XP and the other three as limited, which is the rule the XP badge uses |
| `licenseRequirements` | `multiplayer` alone, or with `premium_san` and `premium_subscription`. It matches the `isPremium` flag on EA's browse listing exactly: the experience needs the paid game. Confirmed 2026-10-13, and it follows from the maps; see below |
| Creator | `playerCreator` or `trustedCreator`. The seven trusted ones are the standing official playlists such as "Hardcore Conquest" |
| Maps | 30 level ids in `seed/reference.ts`. 27 are the scenes the Portal SDK ships, one `.tscn` per level id, which is the full list of maps a Portal experience can use; the other three are Fort Lyndon and the two maps released on 2026-10-13, Area 51 (`MP_DryLake`) and Vegas Strip (`MP_Paradise`), whose names were entered by hand. All 30 have a display name, checked against the Portal SDK's own list for version 1.4.3.0. A page still falls back to the level id for a map that turns up before it is named. Pictures are the optimized ones from Portal's own map picker |
| Modes | Conquest large, Breakthrough Large, Rush, Domination, Team deathmatch, Squad deathmatch, Custom, and three Redsec modes |
| Publish state | Every one `PUBLISHED`, and every compile status `OK`, so there is still no example of either going wrong |

The creator comes back as account ids, not a name, and `/bf6/experience/` needs an auth
token, so it is not used. A name can sometimes be had in a second step, tried
2026-10-13: `/bf6/stats/?playerid=<personaId>&platform=pc` returns `userName`. It named
12 of the 22 creators behind the seed experiences and answered "Player not found" for
the other ten on every platform tried, the trusted creator of the official playlists
among them. EA's own page for an experience shows the name, but loads it in the
browser from a service that needs a signed-in token; it is not in the page's HTML.
So a Portal creator's name is a nice extra when it resolves, never something a page
depends on. On bfportal.gg the creator is the account that submitted the experience.

EA's website has its own service for this, `drop-api.ea.com/ugx/battlefield-6/item/<playground id>`,
which needs the bearer token of a signed-in visitor. With a maintainer's own token it
was used once, on 2026-10-13, to fill in the seed data: it named all 22 creators and
also gave created and updated dates, English tag names and EA's own map names and
pictures. For one of the twelve creators gametools had named, EA's name was different,
so gametools' player lookup is not reliable for this. The site itself does not call
this service: a personal token expires and is not the site's to use. Token files are
git-ignored (`.auth.*`).

Free or full game, asked for on 2026-10-13: the site says whether an experience needs
the paid game or works on the free version. It follows from the maps: one paid map in
the rotation is enough. gametools publishes the requirement per map at
`/bf6/licenserequirements/`, 22 maps on that day, of which Fort Lyndon, Portal Sandbox
and two Portal variants of Fort Lyndon's areas are free. Worked out that way, the
answer matched EA's own flag for all 30 seed experiences whose maps are in the list.

- `maps.requires_full_game` holds it per map, and `experiences.requires_full_game` the
  answer for the experience, stored so a listing can filter on it.
- The nightly check sets it from the lookup's `licenseRequirements`. Before there is a
  code, and on the submit form's preview, it is worked out from the chosen maps.
- It is unknown, not "free", when a map is not in the list yet, as with a map released
  that day.
- Cards and the experience page show "Free to play" or "Full game"; the Battlefield 6
  Library has a filter for experiences the free version can play.
- The nightly job refreshes the per-map list along with the tags.

`/bf6/shared_playground/` answers by code as well, and adds two things the playground
lookup lacks: when the design was last updated, and each tag's English name ("Custom
Logic" for `custom_scripted`), which the tag list itself does not give.

Battlefield 6 codes are not 2042's six characters. The eight seen were four or five
letters and digits (`12as4`, `hyqt`, `1264g`), returned in lower case and matched
without regard to case. Codes are stored normalized and shown in upper case, and the
format check is per game.

### Whether a code is still published

Raised 2026-10-13: an experience whose code is no longer published on Portal should be
flagged as such. The old site has one flag, `broken`, shown as "Experience Not
Available", for three different things: a visitor's report, the owner's own mark, and
the nightly job finding the code gone. The rewrite separates what the job sees from
what people say.

`portal_state` is written only by the nightly check:

| State | Meaning | How the check knows |
|---|---|---|
| `unchecked` | Not looked up yet, or it has no code (a template may not) | |
| `published` | Portal offers it | Battlefield 6: `publishStateType` is `PUBLISH_STATE_TYPE_PUBLISHED`. 2042: the lookup returns the playground |
| `unpublished` | Portal knows the code but no longer offers it | Battlefield 6: the lookup answers with another publish state. 2042 has no such answer |
| `missing` | Portal does not know the code | A 404 with gametools' "not found" message. Checked 2026-10-13 for both games |

Not verified: what the Battlefield 6 lookup returns for an experience its creator has
unpublished, a 404 or another publish state. Only `PUBLISHED` has been seen, and
gametools' API description lists no other values. Unpublishing a test experience and
looking it up would settle it; until then both paths are handled.

Rules for the check:

- Only a definite answer changes the state. A timeout, a 5xx or a malformed reply
  leaves it alone and is logged, so gametools being down does not flag the library.
  The old job marks an experience broken on any 404 and on any odd reply.
- A first "missing" or "unpublished" is confirmed by a second lookup before it is
  recorded.
- `portal_checked_at` moves on every definite answer; `portal_state_since` only when
  the state changes. That gives "checked 6 hours ago" and "no longer published since
  October 3".
- When the code comes back, the state returns to `published` by itself. Nobody has to
  ask a moderator to clear it, which the `broken` flag needs today.

What a no-longer-published experience looks like:

- **Its page stays.** Links, its description, its updates and its files are still
  worth having. A banner says "No longer published on Portal since October 3", and the
  code is shown struck out with no copy button.
- **Listings hide it by default**, behind the health switch each Library tab already
  has. It leaves the home page, trending and the weekly showcase.
- **A template with files stays listed**, marked "code no longer published, files
  available". The files are the point of a template, and it never needed a code.
- **Its owner is told** on their own page and profile: republish it in Portal, or
  change the code.
- **Moderators see it** as a filter in the admin's experience list and a count on the
  overview. Nothing is removed automatically; a moderator may unpublish a page that
  has been gone a long time.
- **The API reports it** as `portal_state`.

`broken` stays, for what a lookup cannot see: the code is published but the
experience does not load or work. A visitor reports it, and the owner or a moderator
sets it.

The import cannot tell why an old experience is marked `broken`, so it copies the flag
as it is. The first nightly check then sets `portal_state` for every experience, and a
`broken` flag on one that Portal says is published is left for its owner or a
moderator to clear.

### Playtests

New in the rewrite. The community runs playtests through a Discord bot today. The
working assumption, agreed 2026-10-12, is that the site replaces that bot.

What a playtest is, taken from the bot's current posts: a call for testers. A creator
posts a brief for an experience, and anyone in the called regions plays it in their own
time and reports back in a thread. It is not a scheduled session with sign-ups. The
bot's post has:

- the experience's name, its creator and a description;
- its maps and player count;
- free-form sections, typically "what to try" and "please report";
- the experience code;
- the regions, as mentions of a Tester role per region;
- a thread for feedback, named after the code.

The site keeps that shape:

| Field | Note |
|---|---|
| `experience_id` | The experience being tested. Empty when it has no page yet; `title` names it then |
| `code`, `game` | What testers type in. Maps and player count are fetched for the code |
| `summary` | One sentence, for the feed and the top of the Discord post |
| `brief_md`, `brief_html` | The brief, in markdown. The form starts it with "What to try" and "Please report" headings |
| `regions` | Any of EU, NA, SA, Asia and OCE. Each maps to a Tester role to mention |
| `opens_at`, `closes_at` | A playtest can be posted at a set time, and stays open until an end date or until the host closes it |
| `together_at` | Optional. For modes that need a full lobby: when to play it together |
| `status`, `reviewed_by`, `reviewed_at`, `review_note`, `review_field_notes` | Held as `pending` until a moderator approves it; nothing is shown or posted before that. `changes_requested` sends the brief back to be fixed and sent again. There is no "completed": an approved playtest is over when it closes |
| `announced_at`, `reminded_at` | The Discord post and the play-together reminder, each sent once |
| `discord_url` | The Discord thread where testers report back |
| `result_update_id` | The update post with what changed |

Feedback stays in Discord, agreed 2026-10-12. Each playtest has a thread there, and the
site links to it. The site stores no reports of its own.

What is tested is a draft, agreed 2026-10-13. While its playtest is under way a draft
is shown to its owner as "Playtest"; when the playtest is over it is a draft again. A
live experience is never the thing under test: its owner chooses "Playtest" on its
page, which makes a draft copy that goes to playtest and is discarded afterwards. See
"Submission states".

Where it shows:

- A playtests page: open ones, newest first, with filters for region, game and what it
  is built with. It sits beside community events under Events.
- A page per playtest: the brief, the code, the maps, and a link to its Discord thread.
- The home page: the newest open ones.
- The experience page: its open playtest, and a way for its creators to start one.
- An experience's update feed, when the host posts the results.

Replacing the bot means the site does what the bot did:

- **Posting.** The site posts each playtest to the playtests channel through a Discord
  webhook, mentioning the Tester roles for its regions. A webhook can mention a role if
  the role is set to be mentionable.
- **Feedback.** In a Discord thread per playtest, linked from the playtest's page. The
  thread has to be made by something: a webhook can open one only in a forum channel,
  and a bot can open one anywhere. Whichever makes it, its address is saved on the
  playtest.
- **Reminding.** Only when a play-together time is set: one post shortly before.
- **Tester roles.** People keep taking them in Discord. Handing out roles from the site
  would need a real bot account, which is not planned.

What is lost against a bot: slash commands and anything interactive inside Discord. If
that matters, a bot can be added later on top of the same tables.

Configuration: one more webhook id and token pair, and a role id per region.

### Events and banners

New in the rewrite, and kept small. Portal Jam was a one-off and has no place of its
own, but the site keeps a general way to run something for a limited time.

- `events`: title, summary, description, cover image, a link to where it happens, start
  and end, an optional capacity, a host, and whether it is published. `event_interest`
  records who pressed "Interested".
- `banners`: a notice across the top of the site with a start and an end. It appears and
  disappears by its own clock. It has a short label, a message, an optional link, a
  placement (the home page only, or every page) and whether a visitor can dismiss it.
  It may point at an event, but a maintenance notice or a new-feature note uses the
  same table.

Moderators and admins create both, in the admin. The old site's Discord scheduled
events admin is not carried over; this replaces it. If a future jam needs entries, an
event can gain a list of experiences then.

### Small tables

- `site_settings`: one row. `need_login_to_view_profile`, plus a markdown block for the
  home page, replacing Wagtail's "extra content" stream field.
- `import_quarantine`: legacy rows the import could not accept, with the reason and the
  original data.
- `submission_drafts`: at most one row per user. The fields of a submit form that was
  posted with no script and refused, and what was wrong with each, so the page can come
  back filled in. Its `kind` field says which form, experience or snippet, and each
  page reads back only its own. Removed when a submission of theirs goes through.
- `redirects`: only if production has any rows in `wagtailredirects_redirect`.

## Moderation flow

The states and who moves between them. This is the old site's behavior, with the
exceptions listed under "Behavior not carried over" and the rows marked new. The
statuses are defined under "Submission states".

| Action | Who | Effect |
|---|---|---|
| Save a draft | Logged-in user | New, 2026-10-13. An experience or snippet as `draft`, seen only by its owner. Not built |
| Submit | Logged-in user | Experience or snippet as `pending`; approval request posted to the Discord approval channel. Limits: 5 waiting and 10 a day for an account that is not staff |
| Approve submission | Moderator, admin | `published`; first approval posts the announcement to the Discord success channel, once |
| Request changes | Moderator, admin | New, 2026-10-13, in place of "reject". `changes_requested`, with a note and notes on particular fields. It is not an end: see the next row |
| Fix and resubmit | Owner, collaborator | New, 2026-10-13. Back to `pending`, on the same row and address. Not built |
| Remove | Moderator, admin | New, 2026-10-13. `removed`, with a note. For spam or something badly wrong; it cannot be submitted again. Not built |
| Edit | Owner, collaborator | A pending revision; the live page is unchanged; edit request posted to Discord |
| Approve an edit, or request changes to it | Moderator, admin | Payload applied; or the revision is `changes_requested` and its owner fixes it and sends it again |
| Mark own experience bugged or broken | Owner, collaborator | Immediate |
| Add or remove a credited account | Owner | New. Immediate. The account is shown only once that user accepts |
| Give or withdraw edit access | Owner | New. Immediate, and always explicit. Off by default |
| Accept or decline an invitation, or leave | The invited user | New. Immediate |
| Add or change a named credit | Owner | New. Part of an edit, so it goes to moderation |
| Delete | Owner | A soft delete. Collaborators cannot |
| Ask to clear bugged and broken | Owner, collaborator | Goes to moderation |
| Report bugged, broken or XP farm | Any other logged-in user | A report row; no flag changes |
| Set featured, trending or any health flag | Admin | Immediate |
| Unpublish | Moderator, admin | `unpublished` |
| Post an update | Owner, collaborator | New. On a published project only. Held for approval, like a submission |
| Start a playtest | The owner of a draft; any user for something with no page | New. Held for approval; approving it posts it to Discord. A brief can be sent back with changes requested, like a submission |
| Playtest something live | Owner | New, 2026-10-13. "Playtest" on the live page clones it as a draft, which goes to playtest; the live page is not touched. Not built |
| Complete a playtest, and discard its copy | Owner | New, 2026-10-13. Closing the playtest makes the draft a draft again; a copy made for the playtest can then be discarded. Not built |
| Remove an update | Its author; moderator, admin | New. The author's delete is immediate; a moderator's removal carries a note |
| Create or end an event or a banner | Moderator, admin | New. Immediate; a banner shows and hides by its own start and end |
| Say which SDK release it works with | The site, at submit | Changed 2026-10-13. Not a choice: a game only runs its latest release, so the submission is recorded against that one. Whether an owner later confirms it still works on a newer release is not decided |
| Scheduled validation | Job | Sets `portal_state` from gametools.network: published, unpublished or missing. It does not touch `broken` |

The exact permissions of the "Moderators" group exist only in the production database;
no migration or command creates them. They need reading from production before the
moderator role is finalized.

## Feature inventory

What "feature complete" means, by area.

**Browsing**

- Home, top to bottom as mocked up: an optional banner; a short hero with the site
  search and a line of counts; the weekly showcase; trending experiences; recent
  updates; open playtests; trending scripts; upcoming events; and a band leading to the
  2042 library. The mockup also has blocks for maps, guides, tools and the forum; those
  join the home page when their sections exist.
- Site search from the hero and the header: experiences and scripts by name, creator or
  code. "/" focuses it.
- The Library: one page with a tab per game. Category tabs, then filters for tags,
  players and style, and a sort. Beyond those the two tabs differ: Battlefield 6
  filters on what an experience is built with, templates and featured; 2042 filters on
  era and hides experiences that no longer load unless asked. See "Tags and filters
  per game".
- The old filters stay available: title, creator name, tags, main category,
  style, date range, and sort by latest or by likes. Twelve per page, with "show
  more".
- Featured listing, category pages with description and embed overrides, "coming soon"
  for categories marked not ready.
- Cards show cover, title, category, a one-line description, players and bots, what it
  is built with, a Template tag, one topic tag, the owner, the code as a copy button,
  the like count, and featured and health badges.

**Experience page**

- Markdown description, tags, "View on Battlefield" and, when copying is allowed,
  "Open in the Portal editor", the owner, credited accounts with Discord avatars and named
  credits,
  player and bot counts.
- The code in a panel that stays in view, with a copy button and whether the code still
  loads and when that was last checked. On a phone the panel comes first. The code
  rolls into place once on load, in under half a second, and not at all for people who
  ask for reduced motion.
- A gallery: the cover first, then the pictures and videos in their order, with arrows,
  thumbnails and the arrow keys. A video shows its thumbnail with a play button, and
  YouTube's player is loaded only when that is pressed, from youtube-nocookie.com, at
  the time the link starts at. Moving on stops it. With no script the play button
  opens the video on YouTube.
- For Battlefield 6, the SDK release it works with, and how far behind the latest that
  is.
- What it is built with, a Template tag with "Use as a template", the repository link,
  the shared files, its update posts and its open playtest.
- Map rotation and game mode, fetched from gametools.network. The browser fetches these
  today (`core/templates/core/experience_page.html:353`), and only when "Show Maps
  Rotation" is pressed. The rewrite shows the rotation on the page, and for 2042 marks
  each map with its era.
- For 2042, an XP badge, Full or Restricted, from the progression mode gametools
  reports. Today it appears with the rotation.
- A banner when the code is no longer published on Portal, with the date it was last
  seen; the code is then shown struck out.
- Like, share pop-up, report menu, health banner, owner's edit link, and an admin link
  for moderators and admins.
- Open Graph and Twitter card tags, with per-page overrides.

**Accounts**

- Discord login only. No email is sent anywhere.
- Profile page: avatar, name, join date, role and owner badges, counts of experiences,
  scripts, likes received and updates posted, and four tabs: experiences, scripts,
  liked and updates.
- An account settings page, linked from the profile and the header menu, for
  `hide_username`.
- The header shows the signed-in user's avatar with a menu: profile, account settings,
  log out, and Review for moderators and admins.
- Optional "login required to view profiles" site setting. `hide_username`.

**Submitting and editing**

- The submit form asks for the game first, because that decides what can be supplied.
  Game first is a rule for every flow where the game matters, restated 2026-10-13.
  Both games can start from the experience code, which gametools.network looks up.
  Battlefield 6 can also add the export; Battlefield 2042 has almost nothing to export.
- The second question is what is being shared: an experience or a snippet. A snippet
  is offered for Battlefield 6 only; with 2042 chosen it stays in view with the
  reason and cannot be chosen.
- Submitting a snippet: a title, a description, the snippet pasted in or uploaded as
  one `.ts` file, and a category. See "BF6 snippets".
- Saving a draft without submitting, and a list of the signed-in visitor's own
  experiences and snippets with the state of each, most recently changed first. From
  the list, one "Edit" button per row opens the item to take its next step.
- When a moderator requests changes, the form reopens filled in, with each of the
  moderator's notes at the field it is about, to fix and submit again.
- Submit form: category, the code or either of the experience's Portal links, whether
  others may copy it in the Portal editor, title, markdown description (the markdownx
  editor today), named credits for people without an account, accounts to credit (user autocomplete)
  each with an edit access switch that starts off, tags (autocomplete), players,
  bots, style, cover
  image URL, the gallery as one list of links to pictures and YouTube videos, repository
  link, and a link to larger files hosted elsewhere. A card preview updates beside the
  form. The SDK release is not asked for: the form says which release the submission
  will be listed for.
  Built so far for credits: one "Co-creators" field that searches accounts by name as
  it is typed, never offering a hidden name or the owner, and adds anything else as a
  name. A chosen account is stored as an invitation. The edit access switch, and the
  page where an account accepts, are not built yet.
- Style replaces the old subcategories, as a tag group: Casual, Competitive, Showcase
  and Example.
  Portal Jam was a one-off and is no longer offered.
- Autofill from gametools.network when a URL or code is entered
  (`bfportal/static/js/bfportal.js:46`).
- Validation: a code is required unless the experience is a template (the old Prefab
  category). Battlefield 6 has no such category: its form asks what the experience is
  built with, and whether to offer it as a template. A pasted link must be one of the
  game's two Portal addresses and carry a playground id; code is alphanumeric; cover
  image must be an image.

**BF6**

- Scripts section with Snippets and Experiences tabs, featured listing, snippet pages.
  The list is rows, not cards: language, title, category, one line, author, when it
  was updated, the experience it comes from and its likes.
- A script page: the code with line numbers and a copy button, the description, its
  update posts, a download of the export, the repository link, and the experiences
  that use it. The export download is for snippets from the old site only: a snippet
  submitted here is its script alone. The mockups of the scripts list and the script
  page still show the old site's export details and have not been brought in line.
- Navigation with eight sections: Scripts, Maps, Tools & Plugins, Guides & Docs, Library,
  Updates, Events and Forum. Maps, Tools, Guides and Forum are placeholders. Below
  1280px the bar collapses into a menu that works without JavaScript.

**Updates (new)**

- Creators post, edit and delete updates on their own projects.
- A recent-updates feed grouped by day, with filters for game and kind of project and
  "only projects I liked", a home page section and Atom feeds. Beside it: how to
  follow by feed, and the projects with the most updates this month.
- A source repository link on the project page.
- Uploading the Portal export to fill in the submit form, and sharing a project's files
  (export, script, spatial layouts, Godot scenes) for others to view and download.

**Playtests (new)**

- Starting a playtest with a brief and regions, a feed of open ones, a page per
  playtest linking to its Discord thread, and Discord posts by webhook. Replaces the Discord
  playtest bot.
- An "open playtest" panel on the experience page, and results posted as an update.
- The playtests page explains how it works and how to take a Tester role in Discord,
  and lists recently closed playtests.

**Events and banners (new)**

- An events page with Upcoming and Past tabs. Each event shows its date, host, a
  summary, slots where it has a capacity, how many are interested, a countdown or
  "live now", and an "Interested" button. Times are shown in the visitor's time zone.
- Playtests are reached from the same page.
- Time-limited banners, set up in the admin.

**Footer and static pages**

- Three columns of links (Browse, Create, Community) and a row for Privacy, Content
  rules and Status. Privacy, Content rules, the cover image template and the public API
  description are pages the site needs to have; none is written yet.
- The disclaimer, built 2026-10-13. It sits in the footer of every page under its own
  "Disclaimer" heading, at the footer's reading size, and has a page of its own at
  `/disclaimer`. The old site keeps it behind a "Disclaimer" item in the navigation
  that opens a pop-up. The text lives in one place, `src/shared/legal.ts`, and has two
  parts:
  - the old site's Fansite Agreement notice, now naming Battlefield 6 beside
    Battlefield 2042, as asked on 2026-10-13;
  - the statement EA's content policy asks a site showing its game content to
    include: "This website is not endorsed by or affiliated with EA or its
    licensors."

**Admin**

- A side menu in three groups. Moderation: overview, review queue, reports. Content:
  experiences, scripts, update posts, playtests. Site: events and banners, and for
  admins only, categories and tags, users and roles, and settings.
- An overview: how much is waiting by kind and for how long, the oldest items, reports
  to look at, site health (the nightly code check, gametools, Discord webhooks) and
  recent decisions.
- One review queue for everything held for a moderator: new submissions, edits, update
  posts, playtests and requests to clear a flag. Oldest first.
- Reviewing a submission shows the page as it will appear, beside automatic checks: the
  code is published on Portal and its name matches, no other page uses the code, the
  export is valid and "built with" matches it, the cover image loads and its size, and
  how the submitter's earlier submissions went. Approve, or request changes with a
  note about the whole thing and notes against particular fields; the creator fixes
  it and submits it again. Separately, remove it for good, for spam or something
  badly wrong.
- What a creator sees of a review never says which moderator made it.
- A warning when what is being reviewed loads pictures from elsewhere, agreed
  2026-10-13: "Loads pictures from i.imgur.com, tracker.example". Descriptions,
  update posts and playtest briefs may include HTTPS pictures, as on the old site, and
  every visitor's browser fetches them, so whoever hosts one learns who opened the
  page. The site does not block them; the moderator sees the hosts and decides.
  `pictureHosts` in `src/server/markdown.ts` gives the list. It shows on every kind of
  review: submissions, edits, update posts and playtests. Only unfamiliar hosts raise
  it: a short list of hosts everyone uses, such as imgur and GitHub, does not, so the
  warning stays worth reading. That list is settings an admin can edit, drawn up when
  the review screen is built.
- Reviewing an edit shows live against proposed, field by field, with changed text
  marked and the unchanged fields listed.
- Reports: counts per experience by kind, the flags set now, and "set flags" or
  "dismiss". A report never changes a flag by itself.
- Featured and trending are switches only admins see, on the review screen and in the
  experience list.
- Experience list with search by title and code, filters (trending, health flags,
  category, tag) and report counts; full edit including owner, creators,
  admin-only flags and report lists.
- Snippet authoring with `exp_json` validation errors shown per field.
- Categories of all four kinds, per game.
- Tags per game: groups and the tags in them, with add, rename, hide, move and merge,
  usage counts, and the tags newly arrived from Portal. See "The tag system".
- Users and roles, site settings and home content.

**API, SEO, operations**

- `/api/experiences/` and `/api/users/` with five-minute cache headers; `/api/users/`
  filters by `uid` and `username`.
- Sitemap of pages and of profiles that have not hidden their name; robots.txt.
- Scheduled job, every few minutes: post playtests whose time has come, and any
  play-together reminders, to Discord.
- Scheduled job: ask Portal for the latest SDK release and record it when it is new.
- Scheduled job: sync each game's tag list from gametools.network and purge the Cloudflare cache
  for the autocomplete endpoints, then check every published experience against
  gametools.network: record whether its code is still published, its XP mode, whether
  it needs the paid game and its rotation, and add Portal's tags for it.

**Not carried over because nothing uses them**

- Discord scheduled events admin (replaced by the new events table), Wagtail documents, Wagtail forms, the empty blog page
  type, the mock-data commands (replace with a seed script when needed), the one-off
  repair commands (`fix_img`, `tasks`, `import_db`).

## Behavior not carried over

Faults in the current site that the rewrite should fix by design rather than copy.

| Fault | Where | In the rewrite |
|---|---|---|
| Liking changes state on a GET | `core/views.py:326` | A POST server function |
| Likes stored in two tables | `core/models/users.py:41`, `core/models/experience.py:157` | One join table |
| Date filter never applies: the browser sends `from`/`to`, the server reads `From`/`To` | `core/static/js/filters_helper.js:76`, `core/models/helper.py:26` | Typed search params shared by both sides |
| Page size is whatever `?n=` says | `core/models/helper.py:92` | Fixed, or capped |
| Viewing a category page can overwrite the category's name | `core/models/pages.py:185` | Reads never write |
| XP farm banner never shows (`pagt` typo) | `core/templates/core/experience_page.html:126` | Typed templates |
| XP farm report count shows the broken count | `core/wagtail_hooks.py:75` | Counts come from one reports table |
| Server fetches a user-supplied image URL with no timeout | `core/forms.py:137`, `core/helper.py:53` | Timeout, size limit, public addresses only |
| Announcement and sitemap links use `http://` | `core/signal_recivers.py:41`, `bfportal/robots.py:10` | One configured site URL |
| Cloudflare purge sends one malformed URL (missing comma) | `core/helper.py:158` | A list |
| Validation marks an experience broken on any 404 or odd reply, and its "import tags" switch is ignored | `core/management/commands/validate.py:18` | Its own `portal_state`, changed only by a definite answer; honor the switch |
| One "not available" flag for a report, the owner's mark and the job's finding, which only a moderator can clear | `core/models/experience.py` | The job's finding is separate and clears itself when the code returns |
| Delete is a stub | `core/models/experience.py:273` | See "Open decisions" |
| The users API ignores `hide_username` and lists who liked each experience | `core/serializers/users.py` | Decide what the public API exposes |

## Data migration

A one-off import, written in TypeScript in this repository, that rebuilds the new
database from empty every time it runs. The final cutover run is then identical to
every rehearsal.

- A production dump is restored into a separate `legacy` database, never the live one.
- The old tables are introspected once with Drizzle so reads are typed.
- Each row is transformed in TypeScript and validated with the same Zod schemas the
  application uses.
- A row that fails validation is not dropped, and is not published either. Its original
  data goes to a quarantine table with the reason, and the experience is imported as
  `unpublished` with only the fields that passed. Publishing it means fixing it through
  the normal edit path, so the import cannot put a rejected URL or a malformed export on
  a public page.
- The run ends with a report of everything quarantined.

| Data | Source | Note |
|---|---|---|
| Users | `auth_user`, `socialaccount_socialaccount`, `core_profile` | Keyed on Discord id; roles from the superuser flag and the Moderators group |
| Experiences | `wagtailcore_page` + `core_experiencepage` | Slug, ids and publish dates kept. The playground id is read out of each stored link |
| Pending submissions and edits | Latest `wagtailcore_revision` flagged for moderation | Becomes status `pending` or a revision row |
| Subcategories | The subcategory table and its join | Each becomes a tag in 2042's Style group, and each assignment a tag on the experience |
| Creators | The creators join table | Each becomes a credited account, already accepted, with edit access off. They keep exactly what they have today: a credit that links to their profile. An owner who wants one of them to edit turns it on |
| Tags | Join tables | Straight copy. Every old tag becomes a Battlefield 2042 tag, matched to its Portal id by name; the four era tags go in 2042's Era group, the rest of Portal's in Rules, anything else in Topic, and the hand-written spellings from the 2022 import (`BFBC2`, `BF1942`, `BF2042`) are merged into them, leaving aliases |
| Likes | Both like tables | Union; mismatches reported |
| Reports | Three join tables | One table with a type |
| Categories and icons | Four category tables, SVG files in the media folder | SVG markup read into the row |
| Snippets | `bf6_snippetpage` and its joins | Straight copy |
| Site setting | `core_genericsystemsettings` | One row |

### Test legacy database

Until a production dump is available, the import is developed against a legacy
database generated from the old repository. Its dev compose file starts Postgres 14,
runs the Django migrations and seeds the result (`ensure_superuser`,
`ensure_initialization`, `mock -u 10 -e 50`), which gives the real legacy schema with
every table the import reads. The import reaches it through its own connection string,
separate from the application's database. The old compose file publishes port 5432, so
the new project's Postgres takes a different host port.

What the generated data exercises:

- Users with a Discord account link, plus one superuser without one.
- Published experiences with tags, creators, likes in both like tables, and health,
  trending and XP farm flags.
- Four main categories and two subcategories.
- With `import_db` as well: 220 real experiences from 2022 (`db.json`), all owned by the
  superuser. This is the "users without Discord" case and the only real-world
  descriptions available before a production dump.

What it does not contain, so these paths stay untested until rows are added by hand in
the old admin or a production dump arrives:

- Pending submissions, pending edits, rejected or unpublished experiences. Every mock
  experience is live.
- Reports, subcategory assignments, `hide_username`, category icons, site settings.
- Snippets. `mock_snippets` needs a BF6 home page and a scripts listing page, and no
  command creates either.
- Like mismatches between the two tables, users with no email, redirects.

Seeding needs network access (tags come from gametools.network) and `DEBUG` set. Only
the Faker text is seeded, so ids, tags and likes differ on every run; keep one generated
dump as the fixture the import checks run against.

Not migrated: mock data, sessions, OAuth tokens, Discord scheduled events, the search
index, image renditions, Wagtail permissions and logs, and revision history beyond the
pending one.

Things that will need care:

- **Login continuity.** Sessions do not carry over, so everyone signs in again. The
  import must create each user's Discord account link, or first login makes a duplicate.
- **Email.** The old site stores each user's Discord email and never uses it: no view
  reads it, no mail is sent, and the public API strips it. The rewrite keeps collecting
  it the same way, because Better Auth requires one: `user.email` is non-null and
  unique, and a sign-in with no email is refused. Discord accounts registered with a
  phone number have none, so login gives those users the placeholder
  `<discord_id>@discord.invalid`, and the import uses the same address for old users
  whose email is empty. Old emails are not unique in Django either, so the import needs
  a rule for duplicates. Both need counting. See "Account email" under "Open
  decisions".
- **Users without Discord.** An earlier bulk import (`import_db.py`) assigned
  experiences to the superuser. They need a system owner, shown at `/users/admin/`.
- **Status.** "Not live" covers pending, rejected and unpublished; only the revision
  flag tells them apart.
- **Markdown.** The new renderer will differ from Python-Markdown in places. Spot-check
  the longest and most-viewed descriptions.

Because old ids are kept, the import resets each id sequence to the highest imported
id when it finishes.

Checks after each run: row counts per table; tag, like and creator counts per
experience; a crawl of every URL in the old sitemap expecting a 200 from the new site.

Cutover: make the old site read-only, take a final dump, run the import, check, switch.
Writes are infrequent, so a short freeze is simpler than a live sync. Keep the old
container and dump for rollback.

## Deployment and operations

The same shape as today, so nothing about hosting has to change at once:

- GitHub Actions builds a Docker image and pushes it to GHCR; docker-compose runs it
  next to Postgres, with Cloudflare in front.
- Schema migrations run as a deploy step, not at application start.
- Jobs are CLI entry points in the same image, started by the host's scheduler. The
  current repository does not show how `validate` is scheduled today.
- Configuration stays in environment variables: Discord client id and secret, the two
  webhook id and token pairs, `OWNERS`, the Cloudflare credentials, the database URL,
  and `SITE_URL`, the public address used in canonical links and previews, which
  defaults to the sign-in address. One module validates them, and the server refuses
  to start if any is missing.
- HTML is not cached at Cloudflare for now. Caching it for requests with no session
  cookie is deferred; see "Rendering". The API keeps its five-minute cache headers.

## Testing

The current site has one real test file. The rewrite should have a small number of
tests where a mistake is expensive:

- **Export validation:** port the cases in `bf6/models/test_bf_experience_export.py`.
- **Moderation:** every transition in the table above, against a real Postgres.
- **Permissions:** each mutating server function refuses each role it should refuse.
- **Import:** the checks listed under "Data migration", run on every rehearsal.
- **Browser:** a handful of Playwright flows (browse and filter, submit, approve, like),
  one of them with scripts off, and none may log a hydration mismatch.
- **Server HTML:** each indexed page's title, description, canonical address and main
  content, read without running scripts.
- **Bundle:** a build check that the admin's libraries are absent from the shared chunk.

Tests that need a database run against a real Postgres, in a `bfportal_test` database
that each run recreates from the migrations. Login is covered this way already: the
tests run the whole Discord round trip with Discord's two endpoints faked. CI runs
lint, the build, type-checking and the tests on Node 22, the oldest supported version.

## Visual direction

The design reference is the static mockup in `mockups/site`: one page per screen, with
working links between them. The mockups are not committed, because their images are
placeholder crops of EA artwork. `mockups/gen` holds the scripts that generate them and
the scanner that checks them at fifteen widths.

Screens mocked up:

| Area | Pages |
|---|---|
| Public | Home, the library for each game, an experience page, the updates feed, the scripts list and a script page, the submit forms for an experience and for a snippet, a creator's own submissions and the form reopened to fix one, a profile, events, the playtests list, one playtest and the form to start one |
| Admin | Overview, review queue, reviewing a submission, reviewing an edit, reports, the experience list |
| Placeholders | Maps, tools, guides, forum |

Not mocked up yet: the owner's edit form, account settings, search results, one update
post, one event, the admin screens for scripts, update posts, playtests, events and
banners, categories and tags, users and roles, and settings, and the error pages (the
app has plain ones).

Layout:

- One layout. Today there are two near-identical base templates
  (`bfportal/templates/base.html` for BF2042 and `bf6/templates/bf6/base.html` for BF6);
  the BF6 one becomes the only one.
- The BF6 navigation leads. The BF2042 library lives inside the same shell, labeled by
  game.
- Page content sits in a centered column 1360px wide. Nothing stretches past it.
- Compact rows are preferred to boxed grids and tall banners. The hero is short.
- Below 1280px the navigation becomes a menu. Layouts are checked at widths from 390px
  to 2660px, including in-between ones such as 824px, which is a laptop window zoomed
  to 160%.

Words:

- American English in the site's text, as in the code and these documents: "color",
  "canceled", "practice". `AGENTS.md` states the rule.
- Dates and times are rendered by the server in American forms, "Oct 16, 2026" and
  "8:30 PM", in UTC, and switch to the visitor's time zone once the page has hydrated;
  see "Rendering". The mockups show dates month first; their times are still on a
  24-hour clock.

Look:

- Dark surfaces, steel-gray headings, and an orange accent used sparingly: the primary
  button, the active navigation item, the logo.
- Type: Big Shoulders Display for headings, in capitals; Barlow for text; JetBrains
  Mono for codes and scripts. The font files are served by the site, not by a third
  party.
- Colors, type and spacing are defined once as Tailwind theme tokens in
  `src/styles.css`, taken from the top of the mockup's `site.css`, so the look can be
  changed without touching components.
- Framed elements (cards, the search box, panels) have small corner ticks. On hover a
  card lifts slightly and its ticks brighten; a ghost button gets a faint wash.
- The 2042 library is the same shell with a second accent color, the 2042 teal, used
  inside the page. The top bar and logo stay orange. Teal means 2042 and nothing else:
  success and "verified" states on other pages use the neutral steel and white.
- The 2042 library opens on whether an experience still loads: the count and the time
  of the last check are in its header, and experiences that no longer load are hidden
  by default.
- Motion is small: the code's roll-in on the experience page, and hover transitions.
  All of it is off for people who ask for reduced motion.
- Hero and cover artwork in the mockups is placeholder. The site needs artwork it may
  use; see "Open decisions".

### Submitting, and following a submission: the mockups

Mocked up 2026-10-13 as `submit.html`, `submit-snippet.html`, `submissions.html` and
`resubmit.html`, with a "Playtest" button added to `experience.html`. This section is
what the screens show and why. The model behind them, the statuses and what the
database holds, is "Submission states" under "Data model". Built so far: both submit
forms, with the game and "What are you sharing?" at the top of each. "Your
submissions" and the form reopened to fix something are not; "Order of work" says
what comes first.

- **The game comes first, then what is being shared.** Agreed 2026-10-13: the game is
  the first question on submit, and what follows is what that game allows. Snippets
  are Battlefield 6 only, because 2042's Portal had no TypeScript. With 2042 chosen,
  "Snippet" stays in view with that reason and cannot be chosen. Whether a game has
  snippets is a field of its entry in `src/shared/games.ts`, not a test of its name.
- **An experience and a snippet are separate forms** at their own addresses,
  `/submit/` and `/submit/snippet/`, so the choice is two links and needs no script.
  The game is links too: each game's experience form has its own address
  (`/submit/?game=bf2042`), where the mockup switches with a script.
  On the snippet form the other game is a link to the experience form for that game.
  Snippets have had no public form until now; they were written in the admin.
- **The two forms are one page to the eye.** The head ("Submit" and one lead), the
  game choice, the kind choice and the first panel of the side column are the same on
  both, word for word, so choosing a kind changes what is below and moves nothing
  above. What a kind is, is said in its choice, not in the page head.
- **Nor does choosing a game move what both games have.** Fixed 2026-10-13, after
  the page jumped between the two games' forms: everything down to "How it is
  listed" sits at the same height for each game, at every width. Two lines differed.
  The snippet choice says what a snippet is for one game and why there is none for
  the other, and one wrapped where the other did not, so the card holds every line
  it can say in the same place and shows the one that applies. And a code being
  optional for a template is said in the field's label ("Optional for a template"),
  as the mockup has it, not in a line under the field that only one game's form
  had. Below that the forms differ by their fields: "Built with" and the template
  choice are Battlefield 6's alone.
- **Each game's card carries its Portal's logo,** where the mockup has the name
  alone. Added 2026-10-14. The logo is a field of the game's entry (`logo`, a white
  mark under `public`) and is drawn through a CSS mask, so it is steel until chosen
  and then the game's accent. The picture in all four cards takes the logo's width,
  so their text starts in one line.
- **Players and bots are set per team,** in a "Teams" section, where the mockup has
  two number boxes for the whole lobby. Agreed 2026-10-14: experiences are not all
  two even teams. The 34 real ones in the seed include 4 v 8, 2 v 29, 10 v 11, 8
  people against a team with no people, 6 teams of 1 and 17 teams of 2. Each team
  is a row with a slider and a typed number for its people and for its bots, drawn
  after the Portal editor's settings: a thin line with an upright bar, the number
  beside it. "Add a team" copies the last one, so many equal teams are quick to set
  out; adding and removing need the script, and with no script the teams the form
  starts with can still be set. The form starts from Portal's team sizes for the
  first map, or two even teams. One setup per experience, not per map: most use
  one across their rotation, and Portal's per-map sizes stay in `map_rotation`.
  Bots are a count per team. Whether they fill empty places or always play is not
  asked; Portal has both.
- **A match holds up to `maxPlayers` people, and as many bots,** from the game's
  entry: 64 for Battlefield 6 and 128 for 2042, the largest among the experiences
  shared so far, to be confirmed. Portal counts people and bots separately (a
  team's `capacity` is its people; bots are `internalTeams`), so the two are held
  to it separately. The service refuses more, and a team with no one on it.
- **A choice that cannot be taken does not answer the pointer.** The snippet card on
  the 2042 form is drawn with `choiceCardOff`: dashed, with no hover and no pointer.
- **Choosing a card fades the form into the next,** with the browser's view
  transition (the router's `viewTransition` on each card's link), about a quarter
  of a second, and none under reduced motion. Added 2026-10-14. Fading each color by
  itself was tried and dropped: the accent is a CSS variable, and Firefox runs a
  transition of a color built from a variable that is itself animating toward the
  old color, then jumps. Going to the other kind of form draws a new page, which a
  transition could not fade in any case. A chosen card is filled in by its
  `data-chosen`, set from the page's data, not by the `aria-current` the router
  writes: the router writes that as soon as the address changes, before the new
  form's data loads, and the clicked 2042 card flashed orange in the meantime.
- **A snippet is pasted in or uploaded as one `.ts` file, and nothing else.** Agreed
  2026-10-13. It is a piece of script to copy into your own, not a whole experience,
  so the form does not take a Portal export: that is what submitting an experience
  as a template is for. The form is one section: in order, a title, a description, the
  snippet and a category. The snippet box has an upload button in its bar ("Upload a
  .ts file", drawn as a button, with "or paste it below" beside it), line numbers, and
  a count of lines against the limit. The mockup shows 400 lines to keep whole
  experiences out; the number is a placeholder.
- **The SDK release is not asked for.** Agreed 2026-10-13. Battlefield 6 only ever
  runs the latest release, so the form states which release the submission will be
  listed for and does not offer a choice. See "SDK versions".
- **"Your submissions"** at `/submissions/`, for the signed-in visitor only. One flat
  list of every experience and snippet they have made, ordered by when its state last
  changed, newest first. Agreed 2026-10-13, after a first version in three groups
  ("needs you, waiting, live") was dropped: the states do not sort into three piles.
- **Three columns say where a row is:** Status, Request and Review. They are defined
  under "Submission states". The request is drawn as a plain small-caps word and the
  review as a colored label, so the two are not read as one thing. On a narrow window
  the three sit on one line under the name, in the same order.
- **Each row has one line under them:** what last happened and when, as one short
  plain statement. "Submitted 5 hours ago. 4th of 7 in the queue." "Reviewed
  yesterday." "Removed Sep 30. Cannot be resubmitted." No names, no asides.
- **The list does not show a moderator's notes.** A row with changes requested has
  the amber label, an amber edge and an amber "Edit" button, and that is all; the
  notes were tried in the row and made the list too busy.
- **Every row has the same one button, "Edit",** which opens that item's edit page.
  Whatever state it is in, the next step is taken there: fixing what a moderator
  asked for, submitting a draft, discarding a playtest copy. Something removed for
  good has no button. This puts weight on the edit page, which is not mocked up as
  its own screen yet; the submit form stands in for it.
- **The form reopened to fix something** (`resubmit.html`) is the submit form filled
  in with what was sent. The game and the kind are settled and not asked again. The
  top says changes were requested and links to each field that has a note; each of
  those fields shows what the moderator wrote about it, under the field, headed
  "Moderator note". Sending it puts the same row back in review: same address, same
  place in the creator's list.
- **A creator is never shown which moderator reviewed something.** Agreed 2026-10-13.
  Not in the list and not on the notes. The moderators' own screens still record who
  decided.
- **A playtest of something live starts on its page.** The owner's actions on
  `experience.html` include "Playtest", which makes a draft copy to test. The form to
  start a playtest sends anyone testing a live experience there.
- **Reached from** the creator's own profile, a panel beside every submit form, and
  the line under the submit button. The panel says how many have changes requested,
  how many are in review, and how many of the 5 waiting submissions are used.
- **The words on these screens are short and plain.** One fact a line, said the
  ordinary way. Several lines were sent back for being clipped, chatty or carried
  over from habit: a rule about secrets in a script, for one, which means nothing in
  Portal, where a script cannot make a web request.

What the screens need that is not built is listed under "Submission states", with
what the database already holds for it.

Not mocked up yet, and needed by what is: the edit page every row's button opens;
the moderators' review screen with a way to write a note against a field, to request
changes on an edit or a playtest brief, and to remove something for good; and a row
with two requests at once.

### Shown in the mockups, not yet in the schema

The mockups were drawn ahead of the data model in places. Each of these needs a
decision before its screen is built: add it, or take it off the screen.

| The mockup shows | What is missing | Suggestion |
|---|---|---|
| Weekly showcase: one experience, a week number, "picked by the moderators" | Nowhere to store the pick | A `showcase_experience_id` and a date on `site_settings`; the `featured` flag stays separate |
| "Loads in game. Checked 6 hours ago", and the nightly check on the admin overview | Per experience this is now `portal_checked_at`, built 2026-10-13. Still missing: a record of each run | A small `job_runs` table (job, started, finished, result) |
| Admin overview: "Recent decisions" | Decisions are recorded on each row, not in one place, and a flag change records nothing | A `moderation_log` table (who, what, on which item, note, when) |
| Reports: "Dismiss" | A report has no resolved state | `resolved_at` and `resolved_by` on `experience_reports` |
| Admin overview: whether Discord webhooks are delivering | Nothing records a webhook's result | The same `job_runs` table, or a last-result column per webhook in settings |
| Scripts list: comment counts | The site has no comments | Take it off. Discussion happens in Discord |
| Scripts list and script page: download counts | No counter | A `downloads` count on snippets, or take it off |
| Script page: "Used in" | No link between a snippet and an experience | A `snippet_experiences` join table, set by the snippet's author |
| Scripts list: a second category tag per snippet, and a language | Snippets have one category and no tags or language | Take both off. The submit form, built 2026-10-13, asks for one category, and every snippet is TypeScript |
| 2042 library: an Era filter | Tags have no game and no grouping, so the era tags cannot be told from the rest | Four of 2042's Portal tags are the eras. They become an "Era" tag group; see "Tags and filters per game" |
| Updates and script page: "Follow" | No follows | Not built. The Atom feeds and "only projects I liked" cover it |
| Header: a notification dot | No notifications | Not built. Revisit with "Account email" |
| Events: "58 / 64 slots" | A capacity, but nothing that fills slots | Show the capacity and the interested count only |
| Home: counts of experiences, scripts, custom maps and creators | Nothing missing for the first, second and fourth; community-made maps have no table (`maps` holds the games' own maps) | Counted with a short cache; leave maps out until the section exists |
| Home: "Popular" search chips | No source | The most used tags this month |
| Experience page: "14 rules", "412 lines" | Not stored | Counted when the export is read and kept in a small `export_summary` JSON column beside `map_rotation` |
| Forum: view and reply counts | No forum | Not built |

## Order of work

Each stage ends with something that can be looked at. Revised 2026-10-13: the design
was settled first, so the screens are built against seed data and the import follows.

1. **Foundations.** Done: the app skeleton, schema, Discord login, the theme and the
   site shell with every section's route. Not done: the deploy pipeline and a staging
   host. CI has not run yet, because nothing has been pushed.
2. **Seed data.** Done: `pnpm db:seed` fills the development database with the
   reference rows (categories, tag groups, tags, maps, SDK releases), 34 real
   Battlefield 6 experiences, and made-up content after the mockups that covers the
   awkward states: pending, rejected, deleted, flagged, no longer published, a
   template with no code, an unaccepted invitation. Still to add when their pages are
   built: the four Battlefield 6 tag names that were guessed, and real 2042
   experiences once the import exists.
3. **Read-only site:** the home page, library, experience page, scripts, updates,
   events, playtests and profiles, built from the mockups against the seed data. Each page arrives
   with its head tags, its server-HTML test and working links without script; see
   "Rendering".
   Built, 2026-10-13, each with a service and its tests, a server function, a route
   loader and its head tags:
   - the games registry;
   - the Library, both tabs, with search kept in the address;
   - the experience page: gallery, description, updates, map rotation, a template's
     files with a download, more from the creator, and a side column with the code,
     both Portal links, the open playtest, facts, tags and credits;
   - the home page: banner, search, counts, trending experiences, recent updates, open
     playtests, trending scripts, upcoming events and a band for each other game;
   - the updates feed, filtered by kind of project and by game;
   - events, upcoming and past;
   - playtests: the open ones, how it works, recently closed, and a page per playtest
     with its brief, code and Discord thread;
   - scripts: the list by category, and a script's page with its code, description
     and updates;
   - profiles, with experiences (owned, and credited once accepted), scripts and
     liked on tabs; a name anywhere links to its profile.

   Left out of these for now: an SDK season filter in the Library; the like, share,
   report, edit, "interested" and follow actions, which are writes; account settings;
   one page per update post and per event; the weekly showcase and the "popular"
   search chips, which have no data behind them yet; the code's roll-in; Atom feeds;
   and the server-HTML tests, which need a way to render a route inside the test
   runner. The page heads are plain bands with no artwork until the site has a
   picture it may use. "Show ones that no longer load" is off by default for both
   games, as the plan says and unlike the Battlefield 6 mockup. Profiles carry
   `noindex`; the plan has not said whether they should be indexed.

   Player counts are the largest lobby in the rotation, each lobby being the sum of
   its teams' sizes as gametools reports them. That can count bot slots as players,
   and a team with no stated size counts as none; the export's `humanCapacity` is the
   better source when there is one.

   Reviewed 2026-10-13, and changed as a result:
   - logging out goes through Better Auth's HTTP handler, so its check of where a
     request came from applies; the check is also kept on in tests, where Better
     Auth turns it off by itself;
   - the tests refuse to run against a database that is not on this machine;
   - Markdown is rendered and sanitized in one place, `src/server/markdown.ts`, which
     is the only writer of the HTML columns. It allows HTTPS pictures and marks every
     link `nofollow noopener ugc`. This had to exist before the first form or the
     import could write a description;
   - a template stays listed when its code goes, as long as its files can be taken;
   - dates do switch to the visitor's time zone; "show more" stops where the address
     stops; searching by creator finds credits; a profile's lists page.

   Still to check when there is production-sized data, at the import rehearsal: the
   trending sort counts likes per row before it limits, and will be the first query
   to slow down; the home page runs about fifteen queries and an experience page ten,
   uncached. File downloads are not cached either. The service tests assert exact
   counts against the seed, which will need loosening as the seed grows, and there
   are still no browser tests.

   Checked against the mockups, 2026-10-13: each public page rendered beside its
   mockup at 1440px, and the reworked ones at 390px.

   - **Found broken.** Home, a script's page, the playtests list, a playtest and
     events all failed in the browser with "Something went wrong", though the server
     sent them whole. `PageHead` and `Section` read a prop holding markup twice, so
     the server and the browser disagreed about it. Fixed, with a test; the error
     page now writes what failed to the console.
   - **Brought in line.** Section headings (size, the accent segment on their rule,
     the accented word on the home page) and the links beside them. The script page:
     trail, author and date under the title, numbered lines, a copy button in the
     side column. Playtests: a list of rows with a side column for how it works,
     getting pinged and what closed recently. Events: a day block on each card, four
     across. Playtests and events share tabs. The updates feed: rows with the
     project's picture and a side column. The profile: badges, a line of counts, and
     tabs. Cards show one topic tag when they also say what they are built with.
     The 2042 band at the foot of the home page: a band the width of the window,
     flush against the footer, with its eyebrow, large heading and ghost button, not
     a box in the column. The 2042 library's head: how many still load, as a bar and
     a count, with when the codes were last checked, which "Look" above has always
     called for; which head a game's library gets is `library.leadsWith` in the
     registry. The footer lists the 2042 archive.
   - **Found on the way.** On the 2042 library both game tabs were marked current:
     the router calls a link current when the address starts with it, and
     "/library" starts "/library/bf2042". The first of these was missed on the
     first pass because only the top of each comparison was looked at. Compare the
     whole page, to the footer.
   - **Still different, because the site lacks the data or the feature.** The hero
     artwork, the weekly showcase and the popular searches on home; pictures,
     places filled and "interested" on events; comments, downloads and a second tag
     on scripts; the feed's grouping by day and "most active this month"; a
     playtest row's picture, author and what it is built with; the tabs under an
     experience's gallery; trending by week, month or all time.
   - **Not checked.** The submit form and the moderators' screens, which need a
     signed-in browser; the 2042 library and a single playtest in detail; widths
     between 390px and 1440px, and above.
4. **The import,** against the test legacy database, then the same screens on imported
   data. This is where migration problems surface. Put off on 2026-10-13 until after
   writes, by choice; the risk taken is that a migration problem is found later, with
   more built on top of the schema.
5. **Writes:** like, report, submit with the code lookup and the export upload, edit,
   update posts, starting a playtest, and the Discord webhooks.
   Built so far, 2026-10-13: like and report, which set the pattern every write
   follows (see "Writes" in `AGENTS.md`); the gametools lookup; and submit. The
   submit page takes the game and a code or Portal link in its address, shows what
   Portal says, and starts the form from it. On submit the code is looked up again,
   so the rotation, Portal's tags and the paid-game flag come from Portal and not from
   the form; if gametools does not answer, the submission still goes in. An
   experience that is not published can be opened by its owner and the moderators,
   with a note naming its status.

   Tightened after review, 2026-10-13:

   - **Limits.** An account that is not staff may have 5 submissions waiting and send
     10 in a day; both are counted in the database. Lookups from the submit page are
     held to 20 a minute per account, in memory, and a lookup's answer is reused for a
     minute. gametools is someone else's service and the queue is a moderator's time.
   - **The address is found by trying.** Two people sending the same title at once
     both read the address as free. The unique constraint decides, and the one that
     loses takes the next number.
   - **A link is enough.** Given a Portal link and no code, the code comes from the
     lookup. If Portal does not say and it is not a template, the form asks for it.
   - **A group that takes one tag takes one,** checked in the service and drawn as a
     list to pick from.
   - **A refused form is not lost without script.** The fields and what was wrong are
     kept in `submission_drafts` and the visitor is sent to `/submit?draft=true`,
     which draws the form filled in with each problem beside its field.
   - **A write that got no answer is not called a failure.** The page says it may or
     may not have gone through. Once the server has said yes, a failure to move to
     the next page is not shown as an error either.
   - **A server function that takes a form never throws on bad input.** It answers
     with a refusal like any other.

   Fixed after a second review, 2026-10-14:

   - **The limits hold when two are sent at once.** The count and the write are one
     transaction, and an account's submissions of either kind take a lock on the
     account first, so the second waits and then counts the first. The count is
     also made before Portal is looked up, so one over the limit is told without a
     lookup. Before, an experience and a snippet sent together into the last place
     both went in.
   - **A refused form keeps every field that passed.** A kept form holds up to
     100,000 characters, more than any form that passes its checks: a snippet may
     have 60,000 characters of script (`MAX_SNIPPET_CHARS`, its 400 lines at 150
     each) and 10,000 of description. Over that, what was refused goes first.
     Before, a long snippet refused for its title lost its script.
   - **What is submitted is what is in the boxes.** The code and link are fields of
     the form that is submitted, not hidden copies of what was last fetched. "Fetch
     details" is a button of that form: with no script it posts to `startFromCode`,
     which goes to the page for the code; with a script the page goes there and
     keeps what is typed. Enter in a field submits, and in the code or link fetches.
   - **A file posted with the snippet form is the snippet,** over whatever the box
     holds, and one too large to be a snippet is refused rather than ignored. With
     a script the file is read into the box, and the form cannot be sent until it
     is.
   - **A moderator's refused decision comes back with its note,** on the page it was
     made on, with no script as with one. Both kinds of review use one form,
     `DecisionForm`.
   - **A report is remembered for the experience it was sent about,** not for the
     menu, which the router keeps from one experience to the next.
   - Addresses are built from titles with accents removed, so "Über" is "uber". A
     video in the gallery must be on YouTube, since that is the player it embeds;
     a Twitch or Vimeo link is refused rather than taken for a picture.

   Not in submit yet: uploading the Portal export and a template's files; inviting
   accounts as collaborators, which is done from the page after approval; checking
   that a cover address is really a picture.

   Rebuilt to its mockup, 2026-10-13: the head says "Submit"; the form is in the
   mockup's sections, each under a display-face legend (which game, start from your
   code, how it is listed, what it is, setup, media and links); the game is a pair
   of cards; categories, "built with" and tags are boxes that fill in when chosen;
   the code has its "Fetch details" button beside it; and a side column holds "How
   it will look", a card that follows the form as it is typed, and "Before you
   submit". Still in the mockup and not on the page, because they are not built:
   the export upload, the "Your submissions" panel, the Markdown editor's preview
   tab, and tags typed in freely.

   Added 2026-10-13: "What are you sharing?" after the game, on both forms. With a
   game that has no snippets the snippet choice stays in view with the registry's
   reason and is not a link. The 2042 form is the short one of its mockup: it asks
   for Style and Topic only, since Rules and Era are Portal's own tags and their
   groups are no longer creator-selectable. It has no "Offer it as a template" and
   no "Larger files": both belong to a game whose Portal has an export, which is
   `hasExport` in the games registry. A 2042 template is one put in its "Templates"
   category (`categories.marks_template`), and always needs its code or link. The
   service applies the same two rules whatever the form sent. Still on the 2042
   page and not in its mockup: "It can be copied in the Portal editor". In the
   mockup and not on the page: Portal's tags shown read-only once a code is fetched.

   **Choosing a game goes to that game's form.** Fixed 2026-10-13. The game cards
   were radio buttons inside the "Fetch details" form, so choosing Battlefield 2042
   changed nothing until that button was pressed: the page stayed orange, still
   offered a snippet and kept Battlefield 6's fields. Each card is now a link to its
   own address (`/submit`, `/submit?game=bf2042`, `/submit/snippet`), as "What are
   you sharing?" already was, in `SubmitStart`. With script the router changes the
   page in place and what was typed stays; without, it is a page load. Three things
   that follow from changing in place, each found by using the page:

   - An input is written to again whenever what it starts from is read again, so
     what the fields start from (the kept form, what Portal said) is remembered by
     what it says, not by which load it came from.
   - The router keeps rows that are the same in both loads, so a category only one
     game has can go while it is the one chosen. The chosen category is worked out
     from what is offered now.
   - The card beside the form reads the form again after the change.

   Changed with the submission states, 2026-10-13: migration 0023 (the six statuses,
   `changes_requested` in place of `rejected`, notes by field, the review columns on
   snippets, `copied_from_id`); the experience page names any status to its owner;
   the SDK release is set at submit and the form no longer asks for it.

   What the mockups of 2026-10-13 add to this step, in the order to build it. Each
   is a write with its service, its refusal tests and its screen:

   1. **The edit page,** for the owner of an experience. It is what every row of
      "Your submissions" opens, so the rest hangs from it. For something published
      it makes a revision; for anything else it changes the row. It needs mocking up
      first: only the submit form stands in for it.
   2. **Drafts.** Save without submitting, as `draft`; submit a draft. The submit
      form gets a second button.
   3. **Fix and resubmit.** The edit page for something with changes requested shows
      the notes at their fields and sends it back to `pending`. The same for an edit
      that was sent back, from its revision.
   4. **"Your submissions"** at `/submissions/`: the list, its three columns and the
      one button. Linked from the profile, the submit forms and the header menu.
   5. **Submitting a snippet** at `/submit/snippet/`, with "what are you sharing?"
      added to the experience form, and `snippets` on the games registry. Built
      2026-10-13, ahead of 1 to 4, so a snippet can be sent in and reviewed but not
      yet saved as a draft, edited or sent again. The size limit is still a
      placeholder and the production categories are still to be read.
   6. **Playtests:** starting one for a draft, the "Playtest" button that copies a
      live experience, completing one, and discarding a copy. Depends on the
      playtest screens, which are read-only so far.

   The moderators' half of 3 and 5 is in step 6 below.
6. **Admin:** the review queue and the two review screens first, then reports, the
   experience list, and the rest of the side menu.
   Built so far, 2026-10-13: the review queue at `/admin`, listing new submissions the
   longest wait first, and the screen for reviewing one at `/admin/review/<id>`. It
   shows what was submitted beside its checks: what Portal says about the code right
   now, whether Portal calls it something else, other pages using the same code,
   unfamiliar hosts its description, cover or gallery load pictures from, a missing
   cover, a thin description, and how the submitter's earlier submissions went.
   Approving publishes it; requesting changes needs a note, which its owner then sees
   on its page, and a few common notes can be started with a press. A submission is
   decided once, even if two moderators press at the same moment. The queue shows the
   100 longest waits with a count of everything waiting, and marks a submission whose
   code another page already has.

   These screens are drawn in the browser (`ssr: 'data-only'`), with the guard and
   the data on the server. The list of familiar picture hosts is a constant in
   `src/server/services/moderation.ts` until settings exist. Not yet: the queue's
   other kinds (edits, update posts, playtests, flag clears), the featured and
   trending switches, the Discord announcement on approval, a count beside the
   header's Review link, and a record of decisions.

   Added by the submission states, 2026-10-13, and not built: a note against a
   particular field when requesting changes, stored in `review_field_notes`, started
   from the screen's own checks where one applies; "Remove" as a third decision,
   separate from requesting changes, with a note and a confirmation, since it cannot
   be undone by its owner; and seeing, on something submitted again, what was asked
   for last time. The review screen's mockup has none of these yet.

   Reviewing snippets, built 2026-10-13 as the least that lets one be published:
   waiting snippets are listed in the queue above the experiences, each opening the
   snippet's own page, which a moderator sees with a "Decision" panel: Approve, or
   Request changes with a note. The page is what will be published, so there is no
   second review screen and none of an experience's checks, which are about a code
   and pictures. Decided once, like an experience. This is not mocked up.
7. **Edges:** public API, Atom feeds, sitemap, robots, redirects from the old
   addresses, scheduled jobs.
8. **Cutover:** rehearsals, then the switch.

## Open decisions

Each has a recommendation. Rows marked agreed are settled; the rest are not.

| Decision | Recommendation |
|---|---|
| Better Auth for Discord login | Yes. It has a TanStack Start integration with a Solid variant. It requires an email per user; see "Data migration" |
| How BF2042 and BF6 share the site | **Agreed 2026-10-12:** one site, BF6 home at `/`, a `game` column on experiences, and one Library with a tab per game. 2042 has no home page of its own. 2042 submissions stay open. **Agreed 2026-10-13:** each game's tab has its own path, `/library/` and `/library/bf2042/`, not a parameter, for search engines' sake. Existing `/experiences/<slug>/` links are kept |
| Public API compatibility | **Agreed 2026-10-12:** keep the general shape, not full compatibility. The four main paths, the `meta`/`items` envelope, `limit`/`offset`, the field names and the `code`, `search`, `uid` and `username` filters stay. The list returns experiences only, the page size is capped, `liked_by` becomes a like count, the Discord object is trimmed to id, username, display name and avatar, and `hide_username` is honored. Wagtail-only parts (`type=`, the `find` endpoints, `meta.parent`) go. A list of who calls the API would still be useful |
| Old experience ids | Keep them. The schema is built this way |
| Revision history | Import only the live version and any pending one; archive the rest as a dump |
| Experiences and snippets | Separate tables. The schema is built this way |
| Categories | One table with a `kind` column, for experience main categories and the two script kinds. The schema is built this way |
| Owner delete | Implement it as a soft delete; the button exists today but does nothing. The schema is built this way |
| Home page content | One markdown block in site settings |
| `allow_editing` | Keep the column, hide the checkbox until it means something |
| Gametools data on the experience page | Fetch on the server with a short cache and a timeout, so the page renders complete |
| Account email | Optional for now: stored when Discord provides one, a placeholder otherwise, and not used for anything. The site may want to require a real email later, for example to tell a user about a moderation decision. That means deciding what happens to Discord accounts that have none, and to existing users who signed up without one |
| Moderating new kinds of content | **Agreed 2026-10-12:** the same pipeline as the old site. Update posts, playtests and uploaded files are all held for a moderator, like submissions and edits. The one exception is the SDK version. Loosen it later if the queue becomes the problem |
| Who may post updates | The owner and collaborators |
| Repository link | Accept `https` URLs on a short allow-list of hosts, starting with GitHub. Showing stars or the latest commit from GitHub's API can come later |
| Project stage | Not built. A "work in progress / released / discontinued" label on a project would let unfinished tools be listed honestly; decide when tools get their own section |
| Announcing updates | Do not post every update to the public Discord channel; the feed is the place for them |
| Where uploaded files are stored | In the database. They are text, small, and rarely read, and it keeps the site free of file storage. Move to object storage only if binary files are ever allowed |
| File size limits | **Agreed 2026-10-12:** 2 MB per file, Godot scenes included. Anything larger is hosted elsewhere and linked, as some existing experiences already do with Dropbox, Google Drive or GitHub |
| Sharing uploaded files | **Agreed 2026-10-12:** sharing files is what makes an experience a template, a tag the creator sets on creation. There is no separate "share" switch |
| Code on a template | **Agreed 2026-10-12:** optional. A template may exist only as files, and tools and add-ons will not need a code either when they get pages. An experience that is not a template still needs one |
| The Discord playtest bot | **Agreed 2026-10-12, for now:** the site replaces it. A playtest is a brief, posted on the site and announced in Discord by webhook; there are no sign-ups. Revisit if people miss starting one from inside Discord |
| Where playtest feedback lives | **Agreed 2026-10-12:** in the playtest's Discord thread, linked from the site. Open: what creates the thread, a forum-channel webhook or a bot |
| Who may start a playtest | The owner or a collaborator for an experience with a page; any logged-in user for something with no page yet, with a rate limit |
| Playtests for unpublished work | Allowed, shown as "No page yet". A playtest never exposes an unpublished experience's page |
| Tags | **Direction set 2026-10-13:** flexible, shaped by admins per game, and ready for a later title. Tag groups and tags are data; no game's filters are written in code. See "The tag system". **Agreed 2026-10-13,** and the schema is built this way |
| How a new game is added | **Agreed 2026-10-13:** a registry entry in code and one new value in the database's `game` list, with categories and tags entered by an admin. Not a `games` table, because a new title needs code for its lookup and files either way |
| Style as a tag group | **Agreed 2026-10-13.** Style is a tag group per game, not a second kind of category. The subcategory join table is gone |
| SDK version on an experience | Built 2026-10-13 as one release per experience or script in an `sdk_versions` table. **Agreed later the same day:** it is not chosen. Battlefield 6 only runs the latest release, so the site records the current one at submit and the form does not ask. Open: whether an owner later confirms it still works on a newer release, and how the page shows one that has not been confirmed |
| Game first | **Agreed 2026-10-13:** in any flow where the game matters, the game is the first question and what follows is what that game allows. On submit: the game, then what is being shared, then the form |
| What a snippet is | **Agreed 2026-10-13:** a small, reusable piece of script, Battlefield 6 only, pasted in or uploaded as one `.ts` file by anyone signed in, and reviewed like an experience. Not a Portal export and not a whole experience. Open: the size limit, shown as 400 lines in the mockup |
| Submission states | **Agreed 2026-10-13,** and the schema is built this way: draft, in review, changes requested, live, delisted, removed. A moderator requests changes instead of rejecting, and the creator fixes it and submits it again; "removed" is the separate end for spam. See "Submission states" for what is still open there |
| What a creator sees of a review | **Agreed 2026-10-13:** the notes, each at the field it is about, and never which moderator wrote them |
| The creator's own list | **Agreed 2026-10-13:** one flat list at `/submissions/`, most recently changed first, with Status, Request and Review as separate columns, one line of what last happened, and one "Edit" button per row |
| Playtesting something live | **Agreed 2026-10-13:** never on the live listing. "Playtest" on its page makes a draft copy, which is tested and then discarded. Open: how the copy's changes reach the live page, whether the copy needs its own code, and what discarding keeps |
| Who can delist | Open. A moderator can, and Portal losing the code does. Whether an owner can delist their own and list it again is drawn in the mockup and not decided |
| Withdrawing from review | Open. Whether an owner can pull something back from review to a draft |
| Flagging experiences no longer published | Built 2026-10-13 as `portal_state` on experiences, separate from the `broken` flag people set. Proposed, not yet agreed: the page stays up with a banner, listings hide it by default, a template with files stays listed, and nothing is removed automatically |
| Checking projects against an SDK release | Out of scope for now, noted 2026-10-13. For templates and snippets, where the site has the files: three separate checks, for the script, the blocks and the spatial objects, each against what a release offers. See the end of "SDK versions" |
| Creators and collaborators | **Asked for 2026-10-13,** and the schema is built this way: a creator is a name with no account or an account, both credited, and an account can be given edit access by the owner. **Agreed 2026-10-13:** edit access is always explicit and off by default. Proposed, not yet agreed: a newly added account must accept before it is shown; a collaborator cannot delete the experience or manage other creators; ownership changes hands only through an admin |
| Old "additional creators" on import | **Agreed 2026-10-13:** they are imported as credited accounts without edit access. Edit access is opt-in, per person, by the owner |
| Rendering | **Planned 2026-10-13:** server-rendered first load and client navigation for every public page, forms that work without script, and the admin drawn in the browser. See "Rendering". **Agreed 2026-10-13:** a path per game for the Library. Deferred: caching HTML at Cloudflare for requests with no session cookie |
| Pictures in descriptions | **Agreed 2026-10-13:** allowed over HTTPS, as on the old site, in descriptions, update posts and playtest briefs. Nothing is blocked or proxied. A moderator is warned when what they are reviewing loads pictures from a host that is not on a short list of familiar ones |
| Battlefield 6 categories | Open. The mockups use Multiplayer, Co-op and Solo as the main categories, with Style (Casual, Competitive, Showcase, Example) as a second label. Not confirmed: whether those three are right for Battlefield 6, and whether Style sits beside them or replaces them |
| Who may create events and banners | Moderators and admins, in the admin. Not confirmed |
| Artwork | Open. The mockups use crops of EA artwork as placeholders. The old site runs under Electronic Arts' Fansite Agreement, carries its disclaimer and links EA's map artwork directly; the rewrite's disclaimer now names both games. The agreement's own text was not found online, so what it permits is still to be checked against the copy the project holds |
| EA's content policy | Read 2026-10-13 (`help.ea.com/en/articles/security-and-rules/ea-content-policy/`). Three points touch the site and need a look by whoever holds the Fansite Agreement, which may allow more than the public policy does. It says not to put a fan site "behind paywalls like Patreon", while passive banner ads are allowed; the site links a Patreon for support but puts nothing behind it. It says not to use EA's logos or game art in a way that implies endorsement, which bears on the hero image. It says not to put EA's trademarks in a domain name |
| What the mockups show beyond the schema | See the table under "Visual direction". The suggestions there are not agreed |
| Postgres version | Move to a current major during the migration, since the data is reloaded anyway. Development runs 18 |

## What needs production access to answer

- The permissions of the "Moderators" group.
- Whether any redirects exist.
- How the two home pages are mounted (one site or two hostnames).
- Row counts, users without Discord or email, duplicate emails, pending revisions, like mismatches.
- Who consumes the public API.
- Which tags exist and how many experiences use each, to see whether the 2022 import's
  hand-written era, mode and size tags are in use beside Portal's.
- How the validation job is scheduled.
