# bfportal.gg rewrite: project plan

Written 2026-10-12. This describes the approach, the structure and the data model for
rewriting bfportal.gg in TypeScript. It is not a task list. References such as
`core/views.py:326` point into the current site's repository (`bfportal.gg`, under its
`bfportal/` directory) so you can see the behaviour being replaced.

## Goal

A better, more stable version of the current site:

- Feature complete with the current site, implemented more cleanly.
- Visually centred on Battlefield 6, with the Battlefield 2042 library kept.
- TypeScript on the front end and the back end.

Requirements that shaped the stack:

- The public front end is lightweight.
- The admin and moderation panel is a separate JavaScript bundle that public pages never load.
- Pages are server-rendered wherever possible.
- One render tree for the whole app, not independent islands.

Not goals:

- Keeping the Django/Wagtail database schema. Data moves once into a new schema.
- Building the planned BF6 sections (Maps, Tools & Plugins, Guides & Docs, Library, Events).
  They are placeholders today and stay placeholders, but the structure should make them
  cheap to add.

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
| `/events/`, `/tutorials/` | "Coming soon" placeholders |
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
| `game` | `bf2042` or `bf6`; see "Open decisions" |
| `status` | `pending`, `published`, `unpublished` or `rejected` |
| `title`, `description_md`, `description_html` | Markdown is stored; HTML is rendered and sanitised on write |
| `owner_id` | The submitter |
| `category_id` | Main category |
| `code`, `exp_url` | Six-character code; URL must be on `portal.battlefield.com` |
| `cover_img_url`, `vid_url` | External URLs, as today |
| `max_players`, `max_bots` | |
| `featured`, `trending` | Admin only |
| `bugged`, `broken`, `xp_farm` | Health flags |
| `allow_editing` | Stored and exposed by the API today but never enforced; keep the column, decide its meaning later |
| `submitted_at`, `first_published_at`, `last_published_at` | Today "first published" is set at submission (`core/views.py:204`); the new schema separates the two |
| `announced_at` | When the Discord announcement went out; replaces the `first_publish` flag |
| `meta_title`, `meta_description`, `meta_image`, `include_in_sitemap` | Embed overrides |

Join tables:

- `experience_creators` (experience, user)
- `experience_subcategories` (experience, category)
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
| `payload` | The full proposed field set as JSON, including tags, creators and subcategories |
| `status` | `pending`, `approved` or `rejected` |
| `submitted_by`, `submitted_at` | |
| `reviewed_by`, `reviewed_at`, `review_note` | |

Approving applies the payload to the experience in one transaction. A new submission
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

### Small tables

- `site_settings`: one row. `need_login_to_view_profile`, plus a markdown block for the
  home page, replacing Wagtail's "extra content" stream field.
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

- Submit form: category, Portal URL or code, title, markdown description (the markdownx
  editor today), additional creators (user autocomplete), tags (autocomplete), players,
  bots, subcategories, cover image URL, video URL.
- Autofill from gametools.network when a URL or code is entered
  (`bfportal/static/js/bfportal.js:46`).
- Validation: code required unless the category is Prefab; Portal URL required for
  Prefab; URL host must be `portal.battlefield.com`; code is alphanumeric; cover image
  must be an image.

**BF6**

- Scripts section with Snippets and Experiences tabs, featured listing, snippet pages.
- Navigation with the six planned sections, five of them placeholders.

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
- Scheduled job: sync the tag list from gametools.network and purge the Cloudflare cache
  for the autocomplete endpoints, then check every published experience against
  gametools.network, marking broken ones and adding their tags.

**Not carried over because nothing uses them**

- Discord scheduled events admin, Wagtail documents, Wagtail forms, the empty blog page
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
- Like mismatches between the two tables, redirects.

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
  reads it, no mail is sent, and the public API strips it. Better Auth still requires
  one: `user.email` is non-null and unique, and a sign-in with no email is refused. So
  the site does not ask Discord for the address, and every user gets the placeholder
  `<discord_id>@discord.invalid`, at login and in the import alike. Old emails are not
  carried over, which also removes the problem of empty and duplicate ones. See
  "Account email" under "Open decisions".
- **Users without Discord.** An earlier bulk import (`import_db.py`) assigned
  experiences to the superuser. They need a system owner, shown at `/users/admin/`.
- **Status.** "Not live" covers pending, rejected and unpublished; only the revision
  flag tells them apart.
- **Markdown.** The new renderer will differ from Python-Markdown in places. Spot-check
  the longest and most-viewed descriptions.

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
- Whether there is a design reference to work from is an open question.

## Order of work

Each stage ends with something that can be compared against the live site.

1. **Foundations:** the app skeleton, schema, Discord login and the deploy pipeline,
   running on a staging host.
2. **Read-only site on real data:** the import, then listings, detail, category and
   profile pages. Doing the import this early means every screen is built against
   production data, and migration problems surface at the start.
3. **Writes:** like, report, submit, edit, the moderation queue and the Discord webhooks.
4. **Admin:** experience management, categories, tags, users, settings.
5. **BF6:** scripts section and snippet authoring.
6. **Edges:** public API, sitemap, robots, redirects, scheduled jobs.
7. **Cutover:** rehearsals, then the switch.

The visual work can run alongside from stage 2.

## Open decisions

Each has a recommendation; none is settled.

| Decision | Recommendation |
|---|---|
| Better Auth for Discord login | Yes. It has a TanStack Start integration with a Solid variant. It requires an email per user; see "Data migration" |
| How BF2042 and BF6 share the site | One site, BF6 home at `/`, existing `/experiences/` URLs unchanged, a `game` column on experiences |
| Public API compatibility | Keep the paths and the fields real consumers read; drop Wagtail-specific query features. Needs a list of who calls the API |
| Old experience ids | Keep them |
| Revision history | Import only the live version and any pending one; archive the rest as a dump |
| Experiences and snippets | Separate tables |
| Categories | One table with a `kind` column |
| Owner delete | Implement it as a soft delete; the button exists today but does nothing |
| Home page content | One markdown block in site settings |
| `allow_editing` | Keep the column, hide the checkbox until it means something |
| Gametools data on the experience page | Fetch on the server with a short cache and a timeout, so the page renders complete |
| Account email | Not collected for now. The site may want to require a real email later, for example to tell a user about a moderation decision. That means requesting Discord's `email` scope again, asking existing users to consent again at their next login, and deciding what happens to Discord accounts that have no email. The old addresses are in the legacy dump if they are ever wanted |
| Postgres version | Move to a current major during the migration, since the data is reloaded anyway. Development runs 18 |

## What needs production access to answer

- The permissions of the "Moderators" group.
- Whether any redirects exist.
- How the two home pages are mounted (one site or two hostnames).
- Row counts, users without Discord, pending revisions, like mismatches.
- Who consumes the public API.
- How the validation job is scheduled.
