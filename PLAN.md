# bfportal.gg rewrite: project plan

Written 2026-10-12. This describes the approach, the structure and the data model for
rewriting bfportal.gg in TypeScript. It is not a task list. References such as
`core/views.py:326` point into the current site's repository (`bfportal.gg`, under its
`bfportal/` directory) so you can see the behaviour being replaced.

## Goal

A better, more stable version of the current site:

- Feature complete with the current site, implemented more cleanly.
- One addition the current site does not have: update posts on projects, with a
  site-wide feed of recent updates, and a link to a project's source repository.
- Visually centred on Battlefield 6, with the Battlefield 2042 library kept.
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
| Styling | Tailwind (current site is on 3.3.2) | 4.3.3 | Proposed |
| Markdown | `marked` with `sanitize-html`, server side | 18.1.1, 2.18.0 | Proposed |
| Admin tables and forms | TanStack Table, Form, Query (Solid adapters) | 9.3.1, 1.33.5, 5.104.2 | Proposed, admin routes only |
| Tests | Vitest, Playwright | 5.0.4, 1.64.0 | Vitest in use; Playwright proposed |
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
  a field (a code is six alphanumeric characters, a Portal URL is on
  `portal.battlefield.com`) are written once and shared by the forms, the server
  functions, the API and the import. Each operation then builds its own schema from
  them, listing exactly the fields that caller may send. The owner's edit schema has no
  `featured`, `owner_id` or `role`; the admin's does. Ownership and privileged values
  are set by the server, never read from the request. Checking the caller's role is not
  enough if the schema would have accepted the field.

Suggested layout:

```
src/
  routes/
    (public)/        home, experiences, category, users, scripts, submit, placeholders
    admin/           moderation queue, experiences, snippets, categories, tags, users, settings
    api/             public JSON API, sitemap.xml, robots.txt, auth callback
  components/        shared Solid components (cards, filters, markdown view, layout)
  functions/         server functions: the only way client code calls into server/
  server/            never imported by client code; the build fails if it is
    services/        experiences, snippets, moderation, likes, reports, users, categories
    db/              schema, queries, migrations
    integrations/    discord, gametools, cloudflare
    auth/            Better Auth setup, role checks
  shared/            Zod schemas, types, constants used on both sides
jobs/                validate experiences, sync tags (run as CLI entry points)
tools/import/        the one-off legacy data import
```

## URLs

Public URLs are kept so existing links, embeds and search results keep working.

| Path | Purpose |
|---|---|
| `/` | Home: trending, category tiles, latest experiences |
| `/experiences/`, `/experiences/featured/` | Listing with filters and pagination |
| `/experiences/<slug>/`, `/experiences/<slug>/edit/` | Detail page; owner's edit form |
| `/category/<name>/` | Listing for a main category or subcategory; `_` stands for a space |
| `/submit/` | Submit form (login required) |
| `/users/<discord_id>/`, `…/experiences/`, `…/liked/` | Profile and its two lists |
| `/users/admin/` | Profile of the legacy admin-owned experiences |
| `/scripts/`, `/scripts/snippets/`, `/scripts/experiences/`, `/scripts/featured/`, `/scripts/<slug>/` | BF6 scripts section |
| `/updates/` | New. Recent update posts across the site, with filters; `/updates/feed.xml` is the Atom feed |
| `/experiences/<slug>/updates/<id>/` | New. One update post; the experience page lists them |
| `/events/` | New. Upcoming and past events |
| `/playtests/`, `/playtests/<id>/`, `/playtests/new/` | New. Open playtests; one playtest's brief and reports; the form to start one |
| `/tutorials/` | "Coming soon" placeholder |
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
  mounted in production (both are Wagtail root pages). See "Open decisions".

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
| `status` | `pending`, `published`, `unpublished` or `rejected` |
| `title`, `description_md`, `description_html` | Markdown is stored; HTML is rendered and sanitised on write |
| `owner_id` | The submitter |
| `category_id` | Main category |
| `code`, `exp_url` | Six characters in 2042, four or five in Battlefield 6; URL must be on `portal.battlefield.com` |
| `cover_img_url`, `vid_url` | External URLs, as today |
| `repo_url` | New. The project's source repository; owner-editable, so it goes through moderation like any edit |
| `files_url` | New. A link to files too large to upload: Dropbox, Google Drive or GitHub |
| `max_players`, `max_bots` | |
| `featured`, `trending` | Admin only |
| `bugged`, `broken`, `xp_farm` | Health flags |
| `is_template` | New. The community's word for what the old site called a prefab: the creator offers the files so others can publish their own version with their own changes. Set on creation; shows a Template tag and makes the files downloadable. The import sets it for every experience in the old Prefab category |
| `allow_editing` | Stored and exposed by the API today but never enforced; keep the column, decide its meaning later |
| `reviewed_by`, `reviewed_at`, `review_note` | The moderator's decision on the submission itself; edits are reviewed on their revision |
| `deleted_at` | Set when the owner deletes it; the row stays and is hidden everywhere |
| `submitted_at`, `first_published_at`, `last_published_at` | Today "first published" is set at submission (`core/views.py:204`); the new schema separates the two |
| `announced_at` | When the Discord announcement went out; replaces the `first_publish` flag |
| `meta_title`, `meta_description`, `meta_image`, `include_in_sitemap` | Embed overrides |

Join tables:

- `experience_creators` (experience, user)
- `experience_images` (experience, position, url). New. Extra pictures for a gallery on
  the experience page, shown after the cover image. Each is an external link and gets
  the same checks as the cover; the mockup allows up to eight. Owner-editable, so they
  are part of an edit's payload.
- `experience_subcategories` (experience, category). The form calls this "Style". The
  choices are Casual, Competitive, Showcase and Example. The old site's "Jam"
  subcategory is imported with its experiences but no longer offered.
- `experience_tags` (experience, tag), with a `tags` table (name, slug)
- `experience_likes` (experience, user, created_at). One store, replacing the two
  that exist today (`core/models/users.py:41`, `core/models/experience.py:157`).
- `experience_reports` (experience, user, type, created_at), where type is `bugged`,
  `broken` or `xp_farm`. Replaces three separate join tables.

### Pending changes

A `revisions` table holds proposed changes; the experience row always holds what the
public sees.

| Field | Note |
|---|---|
| `experience_id` | |
| `kind` | `edit` or `clear_flags` (the owner asking for bugged/broken to be cleared) |
| `payload` | The owner-editable fields as JSON, including tags, creators and subcategories. Admin-only fields are never in it, so approving an edit cannot revert a change to `featured` or a health flag made while it waited |
| `status` | `pending`, `approved` or `rejected` |
| `submitted_by`, `submitted_at` | |
| `reviewed_by`, `reviewed_at`, `review_note` | |

An experience has at most one pending revision, enforced by the database; a second edit
replaces the first. Approving applies the payload to the experience in one transaction. A new submission
needs no revision: it is simply an experience with status `pending`.

The alternative is a fully relational versions table, where an experience points at its
live version and every join hangs off a version. It gives history for free, but every
listing query gets more complicated. Pending edits are short-lived and read on one
screen, so the JSON payload is the better trade.

### Categories

Today there are four tables with identical columns (experience main, experience sub,
script main, script sub). One `categories` table with a `kind` column covers all four:

| Field | Note |
|---|---|
| `kind` | `experience_main`, `experience_sub`, `script_main` or `script_sub` |
| `game` | Empty for a category both games use. The old "Prefab" category is renamed "Templates" and belongs to Battlefield 2042 only; for Battlefield 6 a template is a flag, not a category |
| `name`, `slug` | Unique per kind |
| `icon_svg` | Sanitised SVG markup stored in the row |
| `visible`, `selectable_on_form`, `not_ready` | Same meaning as today |
| `description_md`, `meta_title`, `meta_description`, `meta_image` | |
| `sort_order` | New; ordering is by id today |

The cost is that "an experience's main category must be of kind `experience_main`" is
checked in the service, not by a plain foreign key.

Storing icons as text means the new site needs no upload storage at all: experience
cover images are external URLs, and the Wagtail image library is only used by a few
staff-written home page blocks.

### BF6 snippets

`snippets` mirrors experiences where the two overlap (slug, title, description, owner,
status, featured, trending, publish dates, embed overrides) and adds:

| Field | Note |
|---|---|
| `category_id` | A `script_main` category |
| `exp_json` | The Portal export, validated against a Zod port of `bf6/models/bf_experience_export.py` |
| `code` | The decoded `Script.ts` attachment, extracted from `exp_json` on save |
| `vid_url` | |

With `snippet_creators` and `snippet_likes`. Snippets have no tags, no subcategories and
no public submit form today; they are authored in the admin, and their edit route is a
"coming soon" page (`bf6/models/scripts_page/snippets.py:154`).

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
| `author_id` | The owner or a listed creator |
| `title`, `body_md`, `body_html` | Markdown, rendered and sanitised on write, as for descriptions |
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

It does not return the script, the blocks or the spatial data: only the export has
those. So the two sources complement each other. The code gives the listing details and
the cover image; the export gives the files, exactly what a template is built with, and
the precise "built with" types. From the lookup alone, `custom_scripted` says a script
or blocks are used but not which.

The creator comes back as account ids, not a name, and `/bf6/experience/` needs an auth
token, so it is not used.

Battlefield 6 codes are not 2042's six characters. The eight seen were four or five
letters and digits (`12as4`, `hyqt`, `1264g`), returned in lower case and matched
without regard to case. Codes are stored normalised and shown in upper case, and the
format check is per game.

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
| `status`, `reviewed_by`, `reviewed_at`, `review_note` | Held as `pending` until a moderator approves it; nothing is shown or posted before that |
| `announced_at`, `reminded_at` | The Discord post and the play-together reminder, each sent once |
| `discord_url` | The Discord thread where testers report back |
| `result_update_id` | The update post with what changed |

Feedback stays in Discord, agreed 2026-10-12. Each playtest has a thread there, and the
site links to it. The site stores no reports of its own.

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
- `redirects`: only if production has any rows in `wagtailredirects_redirect`.

## Moderation flow

The states and who moves between them. This is the behaviour today, with the
exceptions listed under "Behaviour not carried over".

| Action | Who | Effect |
|---|---|---|
| Submit | Logged-in user | Experience created as `pending`; approval request posted to the Discord approval channel |
| Approve submission | Moderator, admin | `published`; first approval posts the announcement to the Discord success channel, once |
| Reject submission | Moderator, admin | `rejected`; the review note is new |
| Edit | Owner | A pending revision; the live page is unchanged; edit request posted to Discord |
| Approve or reject edit | Moderator, admin | Payload applied, or discarded |
| Mark own experience bugged or broken | Owner | Immediate |
| Ask to clear bugged and broken | Owner | Goes to moderation |
| Report bugged, broken or XP farm | Any other logged-in user | A report row; no flag changes |
| Set featured, trending or any health flag | Admin | Immediate |
| Unpublish | Moderator, admin | `unpublished` |
| Post an update | Owner, listed creator | New. On a published project only. Held for approval, like a submission |
| Start a playtest | Owner, listed creator; any user for something with no page | New. Held for approval; approving it posts it to Discord |
| Remove an update | Its author; moderator, admin | New. The author's delete is immediate; a moderator's removal carries a note |
| Scheduled validation | Job | Sets or clears `broken` from gametools.network |

The exact permissions of the "Moderators" group exist only in the production database;
no migration or command creates them. They need reading from production before the
moderator role is finalised.

## Feature inventory

What "feature complete" means, by area.

**Browsing**

- Home with trending experiences, category tiles and the latest experiences.
- Listing with filters: title, creator name, tags, main category, subcategory, date
  range, and sort by latest or by likes. Twelve per page, with infinite scroll.
- Featured listing, category pages with description and embed overrides, "coming soon"
  for categories marked not ready.
- Cards show cover, title, category, code, creators, like count, featured and health
  badges.

**Experience page**

- Markdown description, tags, code with click-to-select, link to the Portal URL,
  creators with Discord avatars, player and bot counts, video embed.
- Map rotation and game mode, fetched from gametools.network. The browser fetches these
  today (`core/templates/core/experience_page.html:353`).
- Like, share pop-up, report menu, health banner, owner's edit link, and an admin link
  for moderators and admins.
- Open Graph and Twitter card tags, with per-page overrides.

**Accounts**

- Discord login only. No email is sent anywhere.
- Profile page: avatar, name, join date, experience count, likes earned, latest
  experience, role and owner badges, lists of own and liked experiences.
- Optional "login required to view profiles" site setting. `hide_username`.

**Submitting and editing**

- The submit form asks for the game first, because that decides what can be supplied.
  Both games can start from the experience code, which gametools.network looks up.
  Battlefield 6 can also add the export; Battlefield 2042 has almost nothing to export.
- Submit form: category, Portal URL or code, title, markdown description (the markdownx
  editor today), additional creators (user autocomplete), tags (autocomplete), players,
  bots, subcategories, cover image URL, video URL.
- Autofill from gametools.network when a URL or code is entered
  (`bfportal/static/js/bfportal.js:46`).
- Validation: a code is required unless the experience is a template (the old Prefab
  category). Battlefield 6 has no such category: its form asks what the experience is
  built with, and whether to offer it as a template; URL host must be `portal.battlefield.com`; code is alphanumeric; cover image
  must be an image.

**BF6**

- Scripts section with Snippets and Experiences tabs, featured listing, snippet pages.
- Navigation with the six planned sections, five of them placeholders.

**Updates (new)**

- Creators post, edit and delete updates on their own projects.
- A recent-updates feed with filters, a home page section and Atom feeds.
- A source repository link on the project page.
- Uploading the Portal export to fill in the submit form, and sharing a project's files
  (export, script, spatial layouts, Godot scenes) for others to view and download.

**Playtests (new)**

- Starting a playtest with a brief and regions, a feed of open ones, a page per
  playtest linking to its Discord thread, and Discord posts by webhook. Replaces the Discord
  playtest bot.
- An "open playtest" panel on the experience page, and results posted as an update.

**Events and banners (new)**

- An events page with upcoming and past events, and an "Interested" button.
- Time-limited banners, set up in the admin.

**Admin**

- Moderation queue with approve and reject, showing what an edit changes.
- Experience list with search by title and code, filters (trending, health flags,
  category, subcategory, tag) and report counts; full edit including owner, creators,
  admin-only flags and report lists.
- Snippet authoring with `exp_json` validation errors shown per field.
- Categories of all four kinds, tags, users and roles, site settings and home content.

**API, SEO, operations**

- `/api/experiences/` and `/api/users/` with five-minute cache headers; `/api/users/`
  filters by `uid` and `username`.
- Sitemap of pages and of profiles that have not hidden their name; robots.txt.
- Scheduled job, every few minutes: post playtests whose time has come, and any
  play-together reminders, to Discord.
- Scheduled job: sync the tag list from gametools.network and purge the Cloudflare cache
  for the autocomplete endpoints, then check every published experience against
  gametools.network, marking broken ones and adding their tags.

**Not carried over because nothing uses them**

- Discord scheduled events admin (replaced by the new events table), Wagtail documents, Wagtail forms, the empty blog page
  type, the mock-data commands (replace with a seed script when needed), the one-off
  repair commands (`fix_img`, `tasks`, `import_db`).

## Behaviour not carried over

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
| Validation marks an experience broken on any 404, and its "import tags" switch is ignored | `core/management/commands/validate.py:18` | Distinguish "missing" from "gametools is down"; honour the switch |
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
| Experiences | `wagtailcore_page` + `core_experiencepage` | Slug, ids and publish dates kept |
| Pending submissions and edits | Latest `wagtailcore_revision` flagged for moderation | Becomes status `pending` or a revision row |
| Tags, creators, subcategories | Join tables | Straight copy |
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
  webhook id and token pairs, `OWNERS`, the Cloudflare credentials, the database URL.
  One module validates them, and the server refuses to start if any is missing.
- HTML is not cached at Cloudflare to begin with, because pages vary by login. The API
  keeps its five-minute cache headers.

## Testing

The current site has one real test file. The rewrite should have a small number of
tests where a mistake is expensive:

- **Export validation:** port the cases in `bf6/models/test_bf_experience_export.py`.
- **Moderation:** every transition in the table above, against a real Postgres.
- **Permissions:** each mutating server function refuses each role it should refuse.
- **Import:** the checks listed under "Data migration", run on every rehearsal.
- **Browser:** a handful of Playwright flows (browse and filter, submit, approve, like).
- **Bundle:** a build check that the admin's libraries are absent from the shared chunk.

Tests that need a database run against a real Postgres, in a `bfportal_test` database
that each run recreates from the migrations. Login is covered this way already: the
tests run the whole Discord round trip with Discord's two endpoints faked. CI runs
lint, the build, type-checking and the tests on Node 22, the oldest supported version.

## Visual direction

- One layout. Today there are two near-identical base templates
  (`bfportal/templates/base.html` for BF2042 and `bf6/templates/bf6/base.html` for BF6);
  the BF6 one becomes the only one.
- The BF6 navigation leads. The BF2042 library lives inside the same shell, labelled by
  game.
- Colours, type and spacing are defined once as Tailwind theme tokens, so the look can
  be changed without touching components.
- The design reference is the static mockup in `mockups/site`, one page per main screen
  with working links between them: home, both libraries, an experience page, the
  updates feed, scripts and a script page, the submit form and a profile. Its tokens at
  the top of `site.css` are the starting point for the Tailwind theme. The mockups are
  not committed, because their images are placeholder crops of EA artwork.
- Page content sits in a centred column about 1360px wide. Layouts are checked on a
  2660px-wide display as well as at laptop and phone widths.
- The 2042 library is the same shell with a second accent colour, the 2042 teal, used
  inside the page. The top bar and logo stay orange. Teal means 2042 and nothing else:
  success and "verified" states on other pages use the neutral steel and white.
- The library opens on whether an experience still loads: the count and the time of the
  last check are in its header, and experiences that no longer load are hidden by
  default.

## Order of work

Each stage ends with something that can be compared against the live site.

1. **Foundations:** the app skeleton, schema, Discord login and the deploy pipeline,
   running on a staging host.
2. **Read-only site on real data:** the import, then listings, detail, category and
   profile pages. Doing the import this early means every screen is built against
   production data, and migration problems surface at the start.
3. **Writes:** like, report, submit, edit, update posts, the moderation queue and the
   Discord webhooks.
4. **Admin:** experience management, categories, tags, users, settings.
5. **BF6:** scripts section and snippet authoring.
6. **Edges:** public API, sitemap, robots, redirects, scheduled jobs.
7. **Cutover:** rehearsals, then the switch.

The visual work can run alongside from stage 2.

## Open decisions

Each has a recommendation. Rows marked agreed are settled; the rest are not.

| Decision | Recommendation |
|---|---|
| Better Auth for Discord login | Yes. It has a TanStack Start integration with a Solid variant. It requires an email per user; see "Data migration" |
| How BF2042 and BF6 share the site | **Agreed 2026-10-12:** one site, BF6 home at `/`, a `game` column on experiences, and one Library with a tab per game. 2042 has no home page of its own. 2042 submissions stay open. Still open: the URL of each game's listing, with existing `/experiences/<slug>/` links kept |
| Public API compatibility | **Agreed 2026-10-12:** keep the general shape, not full compatibility. The four main paths, the `meta`/`items` envelope, `limit`/`offset`, the field names and the `code`, `search`, `uid` and `username` filters stay. The list returns experiences only, the page size is capped, `liked_by` becomes a like count, the Discord object is trimmed to id, username, display name and avatar, and `hide_username` is honoured. Wagtail-only parts (`type=`, the `find` endpoints, `meta.parent`) go. A list of who calls the API would still be useful |
| Old experience ids | Keep them. The schema is built this way |
| Revision history | Import only the live version and any pending one; archive the rest as a dump |
| Experiences and snippets | Separate tables. The schema is built this way |
| Categories | One table with a `kind` column. The schema is built this way |
| Owner delete | Implement it as a soft delete; the button exists today but does nothing. The schema is built this way |
| Home page content | One markdown block in site settings |
| `allow_editing` | Keep the column, hide the checkbox until it means something |
| Gametools data on the experience page | Fetch on the server with a short cache and a timeout, so the page renders complete |
| Account email | Optional for now: stored when Discord provides one, a placeholder otherwise, and not used for anything. The site may want to require a real email later, for example to tell a user about a moderation decision. That means deciding what happens to Discord accounts that have none, and to existing users who signed up without one |
| Moderating new kinds of content | **Agreed 2026-10-12:** the same pipeline as the old site. Update posts, playtests and uploaded files are all held for a moderator, like submissions and edits. Loosen it later if the queue becomes the problem |
| Who may post updates | The owner and the listed creators |
| Repository link | Accept `https` URLs on a short allow-list of hosts, starting with GitHub. Showing stars or the latest commit from GitHub's API can come later |
| Project stage | Not built. A "work in progress / released / discontinued" label on a project would let unfinished tools be listed honestly; decide when tools get their own section |
| Announcing updates | Do not post every update to the public Discord channel; the feed is the place for them |
| Where uploaded files are stored | In the database. They are text, small, and rarely read, and it keeps the site free of file storage. Move to object storage only if binary files are ever allowed |
| File size limits | **Agreed 2026-10-12:** 2 MB per file, Godot scenes included. Anything larger is hosted elsewhere and linked, as some existing experiences already do with Dropbox, Google Drive or GitHub |
| Sharing uploaded files | **Agreed 2026-10-12:** sharing files is what makes an experience a template, a tag the creator sets on creation. There is no separate "share" switch |
| Code on a template | **Agreed 2026-10-12:** optional. A template may exist only as files, and tools and add-ons will not need a code either when they get pages. An experience that is not a template still needs one |
| The Discord playtest bot | **Agreed 2026-10-12, for now:** the site replaces it. Scheduling and sign-up happen on the site; a webhook announces and reminds in Discord. Revisit if people miss scheduling from inside Discord |
| Where playtest feedback lives | **Agreed 2026-10-12:** in the playtest's Discord thread, linked from the site. Open: what creates the thread, a forum-channel webhook or a bot |
| Who may start a playtest | The owner or a listed creator for an experience with a page; any logged-in user for something with no page yet, with a rate limit |
| Playtests for unpublished work | Allowed, shown as "No page yet". A playtest never exposes an unpublished experience's page |
| Postgres version | Move to a current major during the migration, since the data is reloaded anyway. Development runs 18 |

## What needs production access to answer

- The permissions of the "Moderators" group.
- Whether any redirects exist.
- How the two home pages are mounted (one site or two hostnames).
- Row counts, users without Discord or email, duplicate emails, pending revisions, like mismatches.
- Who consumes the public API.
- How the validation job is scheduled.
