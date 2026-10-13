import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import {
  bannerPlacements,
  categoryKinds,
  contentStatuses,
  experienceTypes,
  fileKinds,
  games,
  playtestStatuses,
  reportTypes,
  revisionKinds,
  revisionStatuses,
  testerRegions,
} from '../../shared/content'
import { user } from './auth-schema'

// The site's own tables. See "Data model" in PLAN.md.
//
// Every timestamp here carries a time zone. Better Auth's generated tables in
// auth-schema.ts do not.

const timestamptz = (name: string) => timestamp(name, { withTimezone: true })

export const gameEnum = pgEnum('game', games)
export const contentStatusEnum = pgEnum('content_status', contentStatuses)
export const categoryKindEnum = pgEnum('category_kind', categoryKinds)
export const reportTypeEnum = pgEnum('report_type', reportTypes)
export const revisionKindEnum = pgEnum('revision_kind', revisionKinds)
export const revisionStatusEnum = pgEnum('revision_status', revisionStatuses)
export const fileKindEnum = pgEnum('file_kind', fileKinds)
export const experienceTypeEnum = pgEnum('experience_type', experienceTypes)
export const bannerPlacementEnum = pgEnum('banner_placement', bannerPlacements)
export const playtestStatusEnum = pgEnum('playtest_status', playtestStatuses)
export const testerRegionEnum = pgEnum('tester_region', testerRegions)

/**
 * Main categories and subcategories for experiences and scripts, in one table.
 * A foreign key cannot say "a category of kind experience_main", so the
 * services check the kind when they assign one.
 */
export const categories = pgTable(
  'categories',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    kind: categoryKindEnum('kind').notNull(),
    // Null for a category both games use. "Templates", which the old site
    // called "Prefab", is a Battlefield 2042 category. In Battlefield 6 a
    // template is a flag on the experience, not a category.
    game: gameEnum('game'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    // Sanitised SVG markup, stored in the row so the site needs no file storage.
    iconSvg: text('icon_svg'),
    visible: boolean('visible').notNull().default(true),
    selectableOnForm: boolean('selectable_on_form').notNull().default(true),
    notReady: boolean('not_ready').notNull().default(false),
    descriptionMd: text('description_md').notNull().default(''),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    metaImage: text('meta_image'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    unique('categories_kind_name_unique').on(table.kind, table.name),
    unique('categories_kind_slug_unique').on(table.kind, table.slug),
  ],
)

export const tags = pgTable('tags', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
})

export const experiences = pgTable(
  'experiences',
  {
    // Old numeric ids are kept by the import, so the id can be supplied.
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    slug: text('slug').notNull().unique(),
    game: gameEnum('game').notNull(),
    status: contentStatusEnum('status').notNull().default('pending'),
    title: text('title').notNull(),
    // Markdown is what the owner wrote. The HTML is rendered and sanitised
    // from it on every write, and is what pages show.
    descriptionMd: text('description_md').notNull().default(''),
    descriptionHtml: text('description_html').notNull().default(''),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    // A Prefab has a Portal URL and may have no code.
    code: text('code'),
    expUrl: text('exp_url'),
    coverImgUrl: text('cover_img_url'),
    vidUrl: text('vid_url'),
    // The project's source repository, if the owner shares one.
    repoUrl: text('repo_url'),
    // Files too large to upload here, hosted elsewhere: a Dropbox, Google
    // Drive or GitHub link.
    filesUrl: text('files_url'),
    maxPlayers: integer('max_players').notNull().default(0),
    maxBots: integer('max_bots').notNull().default(0),
    // What it is built with. Read from an uploaded export, or chosen on the
    // form. Empty for Battlefield 2042, where the distinction does not exist.
    types: experienceTypeEnum('types').array().notNull().default(sql`'{}'`),
    // A template offers its files for others to take and publish their own
    // version of. The old site called this a "prefab".
    isTemplate: boolean('is_template').notNull().default(false),
    // Read from an uploaded export, or fetched from gametools.network by code.
    gameMode: text('game_mode'),
    mapRotation: jsonb('map_rotation'),
    featured: boolean('featured').notNull().default(false),
    trending: boolean('trending').notNull().default(false),
    bugged: boolean('bugged').notNull().default(false),
    broken: boolean('broken').notNull().default(false),
    xpFarm: boolean('xp_farm').notNull().default(false),
    // Carried over from the old site, where nothing enforced it.
    allowEditing: boolean('allow_editing').notNull().default(false),
    submittedAt: timestamptz('submitted_at').notNull().defaultNow(),
    firstPublishedAt: timestamptz('first_published_at'),
    lastPublishedAt: timestamptz('last_published_at'),
    // When the Discord announcement went out. Null until the first approval.
    announcedAt: timestamptz('announced_at'),
    // The moderator's decision on the submission itself. Edits to a published
    // experience are reviewed on their revision row.
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: timestamptz('reviewed_at'),
    reviewNote: text('review_note'),
    // Set when the owner deletes it. The row stays, hidden everywhere.
    deletedAt: timestamptz('deleted_at'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    metaImage: text('meta_image'),
    includeInSitemap: boolean('include_in_sitemap').notNull().default(true),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('experiences_listing_idx').on(
      table.game,
      table.status,
      table.firstPublishedAt,
    ),
    index('experiences_owner_idx').on(table.ownerId),
    index('experiences_category_idx').on(table.categoryId),
    index('experiences_code_idx').on(table.code),
    check('experiences_max_players_check', sql`${table.maxPlayers} >= 0`),
    check('experiences_max_bots_check', sql`${table.maxBots} >= 0`),
  ],
)

/**
 * Extra pictures for an experience's gallery, shown after the cover image in
 * this order. Like the cover, each is a link to an image hosted elsewhere.
 */
export const experienceImages = pgTable(
  'experience_images',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    url: text('url').notNull(),
  },
  (table) => [primaryKey({ columns: [table.experienceId, table.position] })],
)

export const experienceCreators = pgTable(
  'experience_creators',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.experienceId, table.userId] }),
    index('experience_creators_user_idx').on(table.userId),
  ],
)

export const experienceSubcategories = pgTable(
  'experience_subcategories',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.experienceId, table.categoryId] }),
    index('experience_subcategories_category_idx').on(table.categoryId),
  ],
)

export const experienceTags = pgTable(
  'experience_tags',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.experienceId, table.tagId] }),
    index('experience_tags_tag_idx').on(table.tagId),
  ],
)

/** One row per like. The primary key makes liking twice impossible. */
export const experienceLikes = pgTable(
  'experience_likes',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.experienceId, table.userId] }),
    index('experience_likes_user_idx').on(table.userId),
  ],
)

/** A user's report that an experience is bugged, broken or an XP farm. */
export const experienceReports = pgTable(
  'experience_reports',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: reportTypeEnum('type').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.experienceId, table.userId, table.type] }),
  ],
)

/**
 * A proposed change to a published experience, waiting for a moderator. The
 * experience row always holds what the public sees.
 */
export const revisions = pgTable(
  'revisions',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    kind: revisionKindEnum('kind').notNull(),
    // Only the fields the owner may edit, including tags, creators and
    // subcategories. Approving copies these and nothing else, so an admin's
    // change to `featured` or a health flag made meanwhile is not reverted.
    payload: jsonb('payload').notNull(),
    status: revisionStatusEnum('status').notNull().default('pending'),
    submittedBy: text('submitted_by')
      .notNull()
      .references(() => user.id),
    submittedAt: timestamptz('submitted_at').notNull().defaultNow(),
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: timestamptz('reviewed_at'),
    reviewNote: text('review_note'),
  },
  (table) => [
    // An experience has at most one pending revision. A second edit replaces
    // the first.
    uniqueIndex('revisions_one_pending_per_experience')
      .on(table.experienceId)
      .where(sql`${table.status} = 'pending'`),
  ],
)

/** A Battlefield 6 script snippet. Authored in the admin for now. */
export const snippets = pgTable(
  'snippets',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    slug: text('slug').notNull().unique(),
    status: contentStatusEnum('status').notNull().default('pending'),
    title: text('title').notNull(),
    descriptionMd: text('description_md').notNull().default(''),
    descriptionHtml: text('description_html').notNull().default(''),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    categoryId: integer('category_id').references(() => categories.id),
    // The Portal export, validated before it is stored.
    expJson: jsonb('exp_json'),
    // The Script.ts attachment, extracted from the export on save.
    code: text('code').notNull().default(''),
    vidUrl: text('vid_url'),
    repoUrl: text('repo_url'),
    featured: boolean('featured').notNull().default(false),
    trending: boolean('trending').notNull().default(false),
    allowEditing: boolean('allow_editing').notNull().default(false),
    submittedAt: timestamptz('submitted_at').notNull().defaultNow(),
    firstPublishedAt: timestamptz('first_published_at'),
    lastPublishedAt: timestamptz('last_published_at'),
    deletedAt: timestamptz('deleted_at'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    metaImage: text('meta_image'),
    includeInSitemap: boolean('include_in_sitemap').notNull().default(true),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('snippets_listing_idx').on(table.status, table.firstPublishedAt),
    index('snippets_owner_idx').on(table.ownerId),
  ],
)

export const snippetCreators = pgTable(
  'snippet_creators',
  {
    snippetId: integer('snippet_id')
      .notNull()
      .references(() => snippets.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.snippetId, table.userId] })],
)

export const snippetLikes = pgTable(
  'snippet_likes',
  {
    snippetId: integer('snippet_id')
      .notNull()
      .references(() => snippets.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.snippetId, table.userId] }),
    index('snippet_likes_user_idx').on(table.userId),
  ],
)

/**
 * An update post on a project: release notes, a status report, a call for
 * testers. Each post belongs to exactly one experience or snippet. Maps and
 * tools get a column here when they get tables.
 */
export const updates = pgTable(
  'updates',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    experienceId: integer('experience_id').references(() => experiences.id, {
      onDelete: 'cascade',
    }),
    snippetId: integer('snippet_id').references(() => snippets.id, {
      onDelete: 'cascade',
    }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id),
    title: text('title').notNull(),
    bodyMd: text('body_md').notNull(),
    bodyHtml: text('body_html').notNull(),
    // Held for a moderator, like a new experience.
    status: contentStatusEnum('status').notNull().default('pending'),
    publishedAt: timestamptz('published_at'),
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: timestamptz('reviewed_at'),
    reviewNote: text('review_note'),
    deletedAt: timestamptz('deleted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      'updates_one_project_check',
      sql`num_nonnulls(${table.experienceId}, ${table.snippetId}) = 1`,
    ),
    // The site-wide feed, newest first.
    index('updates_feed_idx').on(table.status, table.publishedAt),
    index('updates_experience_idx').on(table.experienceId, table.publishedAt),
    index('updates_snippet_idx').on(table.snippetId, table.publishedAt),
  ],
)

/**
 * A file a creator shares on a project: the Portal export, the script, a
 * spatial layout, a Godot scene. All of them are text, so the content lives in
 * the row and the site still needs no file storage. This table is only read
 * when a file is viewed or downloaded, never by a listing.
 */
export const projectFiles = pgTable(
  'project_files',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    experienceId: integer('experience_id').references(() => experiences.id, {
      onDelete: 'cascade',
    }),
    snippetId: integer('snippet_id').references(() => snippets.id, {
      onDelete: 'cascade',
    }),
    kind: fileKindEnum('kind').notNull(),
    filename: text('filename').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    body: text('body').notNull(),
    // For a spatial layout or a scene: which map of the rotation it is for.
    mapIndex: integer('map_index'),
    // True for a file taken out of the uploaded export, false for one the
    // creator added separately.
    fromExport: boolean('from_export').notNull().default(false),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => user.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'project_files_one_project_check',
      sql`num_nonnulls(${table.experienceId}, ${table.snippetId}) = 1`,
    ),
    check('project_files_size_check', sql`${table.sizeBytes} >= 0`),
    index('project_files_experience_idx').on(table.experienceId),
    index('project_files_snippet_idx').on(table.snippetId),
  ],
)

/**
 * A call for testers: a creator posts a brief (what it is, what to try, what
 * to report) for an experience, picks the regions to call, and testers play
 * it in their own time and report back in a Discord thread. A moderator
 * approves it before it is shown or posted. Whether an approved one is open
 * follows from `opens_at` and `closes_at`.
 */
export const playtests = pgTable(
  'playtests',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // Null when the thing being tested has no page yet. `title` names it then.
    experienceId: integer('experience_id').references(() => experiences.id, {
      onDelete: 'cascade',
    }),
    title: text('title'),
    game: gameEnum('game').notNull(),
    // What testers type in to play it.
    code: text('code').notNull(),
    // One sentence for the feed and the top of the Discord post.
    summary: text('summary').notNull(),
    briefMd: text('brief_md').notNull().default(''),
    briefHtml: text('brief_html').notNull().default(''),
    hostId: text('host_id')
      .notNull()
      .references(() => user.id),
    // Whose Tester roles are mentioned in Discord.
    regions: testerRegionEnum('regions').array().notNull().default(sql`'{}'`),
    // In the future for a playtest that is posted at a set time.
    opensAt: timestamptz('opens_at').notNull().defaultNow(),
    // Null until the host closes it, unless an end date was set.
    closesAt: timestamptz('closes_at'),
    // For modes that need a full lobby: when to play it together.
    togetherAt: timestamptz('together_at'),
    status: playtestStatusEnum('status').notNull().default('pending'),
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: timestamptz('reviewed_at'),
    reviewNote: text('review_note'),
    // When the site posted it, and its play-together reminder, to Discord.
    // The jobs that post them set these, so neither is ever sent twice.
    announcedAt: timestamptz('announced_at'),
    remindedAt: timestamptz('reminded_at'),
    // The Discord thread where testers report back. Feedback lives there, not
    // on the site; the playtest's page links to it.
    discordUrl: text('discord_url'),
    // The update post with what changed, once the host writes one.
    resultUpdateId: integer('result_update_id').references(() => updates.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      'playtests_subject_check',
      sql`${table.experienceId} is not null or ${table.title} is not null`,
    ),
    check(
      'playtests_window_check',
      sql`${table.closesAt} is null or ${table.closesAt} > ${table.opensAt}`,
    ),
    index('playtests_opens_idx').on(table.opensAt),
    index('playtests_experience_idx').on(table.experienceId),
  ],
)

/** A community event with a start and an end: a playtest, a tournament, a jam. */
export const events = pgTable(
  'events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    bodyMd: text('body_md').notNull().default(''),
    bodyHtml: text('body_html').notNull().default(''),
    coverImgUrl: text('cover_img_url'),
    // Where it happens: a Discord or Twitch link.
    linkUrl: text('link_url'),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at').notNull(),
    // Null when anyone can turn up.
    capacity: integer('capacity'),
    hostId: text('host_id')
      .notNull()
      .references(() => user.id),
    published: boolean('published').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check('events_window_check', sql`${table.endsAt} > ${table.startsAt}`),
    index('events_starts_idx').on(table.startsAt),
  ],
)

/** A user who pressed "Interested" on an event. */
export const eventInterest = pgTable(
  'event_interest',
  {
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.userId] })],
)

/**
 * A notice across the top of the site for a limited time. It shows itself
 * between `starts_at` and `ends_at` and needs nobody to take it down. It may
 * point at an event, but does not have to: maintenance notices use it too.
 */
export const banners = pgTable(
  'banners',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // A few words before the message, such as "Live now".
    label: text('label'),
    message: text('message').notNull(),
    linkLabel: text('link_label'),
    linkUrl: text('link_url'),
    placement: bannerPlacementEnum('placement').notNull().default('home'),
    dismissible: boolean('dismissible').notNull().default(true),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at').notNull(),
    eventId: integer('event_id').references(() => events.id, {
      onDelete: 'cascade',
    }),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    check('banners_window_check', sql`${table.endsAt} > ${table.startsAt}`),
    index('banners_window_idx').on(table.startsAt, table.endsAt),
  ],
)

/** One row of site-wide settings. The check keeps it to a single row. */
export const siteSettings = pgTable(
  'site_settings',
  {
    id: boolean('id').primaryKey().default(true),
    needLoginToViewProfile: boolean('need_login_to_view_profile')
      .notNull()
      .default(false),
    homeContentMd: text('home_content_md').notNull().default(''),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('site_settings_single_row', sql`${table.id}`)],
)

/**
 * Legacy rows the import could not accept as they were. The original data is
 * kept here with the reason, and nothing from it is published until fixed.
 */
export const importQuarantine = pgTable('import_quarantine', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sourceTable: text('source_table').notNull(),
  legacyId: text('legacy_id').notNull(),
  reason: text('reason').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
})
