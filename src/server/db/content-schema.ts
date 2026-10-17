import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
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
  uuid,
} from 'drizzle-orm/pg-core'

import {
  bannerPlacements,
  categoryKinds,
  contentStatuses,
  experienceTypes,
  fileKinds,
  games,
  playtestStatuses,
  portalStates,
  reportTypes,
  revisionKinds,
  revisionStatuses,
  tagGroupFilters,
  tagGroupPicks,
  tagSources,
  testerRegions,
} from '../../shared/content'
import type { ExportSummary } from '../../shared/project-files'
import type { TeamSetup } from '../../shared/teams'
import { user } from './auth-schema'

// The site's own tables. See "Data model" in PLAN.md.
//
// Every timestamp here carries a time zone. Better Auth's generated tables in
// auth-schema.ts do not.

const timestamptz = (name: string) => timestamp(name, { withTimezone: true })

/**
 * What a moderator wrote about particular fields when asking for changes,
 * by field name. It sits beside `review_note`, which is about the whole
 * thing. The form shows each note at its field.
 */
const reviewFieldNotes = () =>
  jsonb('review_field_notes')
    .$type<Record<string, string>>()
    .notNull()
    .default({})

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
export const tagGroupFilterEnum = pgEnum('tag_group_filter', tagGroupFilters)
export const tagGroupPickEnum = pgEnum('tag_group_pick', tagGroupPicks)
export const tagSourceEnum = pgEnum('tag_source', tagSources)
export const portalStateEnum = pgEnum('portal_state', portalStates)

/**
 * Main categories for experiences, and main categories and subcategories for
 * scripts, in one table. A foreign key cannot say "a category of kind
 * experience_main", so the services check the kind when they assign one.
 *
 * What the old site called an experience's subcategories, and the form calls
 * its style, is a tag group. See `tagGroups`.
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
    // Sanitized SVG markup, stored in the row so the site needs no file storage.
    iconSvg: text('icon_svg'),
    visible: boolean('visible').notNull().default(true),
    selectableOnForm: boolean('selectable_on_form').notNull().default(true),
    // An experience submitted in this category is a template. How a game
    // whose templates are a category, not a choice on the form, says so.
    marksTemplate: boolean('marks_template').notNull().default(false),
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

/**
 * A named set of tags within one game: "Era" for Battlefield 2042, "Style",
 * "Rules". Admins create and order them, and a game's Library builds its
 * filters from them, so nothing about one game's tags is written in code.
 */
export const tagGroups = pgTable(
  'tag_groups',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    game: gameEnum('game').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    filter: tagGroupFilterEnum('filter').notNull().default('shared'),
    pick: tagGroupPickEnum('pick').notNull().default('any'),
    // Off for a group only Portal or an admin sets.
    creatorSelectable: boolean('creator_selectable').notNull().default(true),
    showOnCard: boolean('show_on_card').notNull().default(false),
  },
  (table) => [
    unique('tag_groups_game_name_unique').on(table.game, table.name),
    unique('tag_groups_game_slug_unique').on(table.game, table.slug),
    // Lets a tag's foreign key name the game as well as the group.
    unique('tag_groups_id_game_unique').on(table.id, table.game),
  ],
)

/**
 * A tag belongs to one game and to one of that game's groups. The same name
 * can exist in two games and mean different things.
 *
 * A foreign key cannot say "a tag of this experience's game", so the services
 * check that when they tag one.
 */
export const tags = pgTable(
  'tags',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    game: gameEnum('game').notNull(),
    groupId: integer('group_id').notNull(),
    // What the site shows. Admins edit it.
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    // Portal's id and its own name for the tag, which the nightly sync and the
    // code lookup match on. Null for a tag an admin added.
    portalId: text('portal_id'),
    portalName: text('portal_name'),
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    // A hidden tag stays on experiences but leaves the filters and the form.
    visible: boolean('visible').notNull().default(true),
  },
  (table) => [
    // A group cannot be deleted while it holds tags.
    foreignKey({
      name: 'tags_group_fk',
      columns: [table.groupId, table.game],
      foreignColumns: [tagGroups.id, tagGroups.game],
    }),
    unique('tags_game_name_unique').on(table.game, table.name),
    unique('tags_game_slug_unique').on(table.game, table.slug),
    unique('tags_game_portal_id_unique').on(table.game, table.portalId),
    unique('tags_id_game_unique').on(table.id, table.game),
    index('tags_group_idx').on(table.groupId),
  ],
)

/**
 * Other names a tag answers to, stored in lower case. Merging one tag into
 * another leaves the old name here, so old links keep finding the filter.
 */
export const tagAliases = pgTable(
  'tag_aliases',
  {
    game: gameEnum('game').notNull(),
    alias: text('alias').notNull(),
    tagId: integer('tag_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.game, table.alias] }),
    foreignKey({
      name: 'tag_aliases_tag_fk',
      columns: [table.tagId, table.game],
      foreignColumns: [tags.id, tags.game],
    }).onDelete('cascade'),
    index('tag_aliases_tag_idx').on(table.tagId),
    check(
      'tag_aliases_lower_check',
      sql`${table.alias} = lower(${table.alias})`,
    ),
  ],
)

/**
 * The maps a game's rotations draw from. Gametools names a Battlefield 2042
 * map without its level id, so a map is matched by level id when there is one
 * and by name otherwise.
 */
export const maps = pgTable(
  'maps',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    game: gameEnum('game').notNull(),
    name: text('name').notNull(),
    levelId: text('level_id'),
    imageUrl: text('image_url'),
    // Whether playing on it needs the paid game. Null when not known, and for
    // a game with no free version.
    requiresFullGame: boolean('requires_full_game'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    unique('maps_game_name_unique').on(table.game, table.name),
    unique('maps_game_level_id_unique').on(table.game, table.levelId),
  ],
)

/**
 * A map carries tags too. A Battlefield 2042 map is tagged with the era it
 * came from, and an experience takes on the tags of the maps in its rotation.
 */
export const mapTags = pgTable(
  'map_tags',
  {
    mapId: integer('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.mapId, table.tagId] }),
    index('map_tags_tag_idx').on(table.tagId),
  ],
)

/**
 * The releases of a game's Portal SDK, which scripts and custom maps are built
 * against. Portal's download service names only the latest, so the list grows
 * a row at a time as the nightly job sees a new one.
 */
export const sdkVersions = pgTable(
  'sdk_versions',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    game: gameEnum('game').notNull(),
    version: text('version').notNull(),
    // "Season 4", "Launch". Shown beside the version and used to filter.
    season: text('season').notNull().default(''),
    // Newer releases sort higher. Version strings do not sort as text.
    sortOrder: integer('sort_order').notNull(),
    // Unknown for releases from before the site started watching.
    releasedAt: timestamptz('released_at'),
  },
  (table) => [
    unique('sdk_versions_game_version_unique').on(table.game, table.version),
    unique('sdk_versions_game_sort_order_unique').on(
      table.game,
      table.sortOrder,
    ),
    // Lets an experience's foreign key name the game as well as the version.
    unique('sdk_versions_id_game_unique').on(table.id, table.game),
  ],
)

export const experiences = pgTable(
  'experiences',
  {
    // Old numeric ids are kept by the import, so the id can be supplied.
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    slug: text('slug').notNull().unique(),
    game: gameEnum('game').notNull(),
    status: contentStatusEnum('status').notNull().default('pending'),
    title: text('title').notNull(),
    // Markdown is what the owner wrote. The HTML is what pages show, and is
    // only ever written by `renderMarkdown` in src/server/markdown.ts.
    descriptionMd: text('description_md').notNull().default(''),
    descriptionHtml: text('description_html').notNull().default(''),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    // A template may have no code.
    code: text('code'),
    // Portal's own id for the experience. An experience has two pages on
    // EA's side and both addresses are built from this: the public page, where
    // players find it, and the editor link, where another creator opens a
    // copy. The second only works when its creator allows copying.
    playgroundId: text('playground_id'),
    // Whether its creator lets others copy it in the Portal editor. Null when
    // nobody has said.
    copyAllowed: boolean('copy_allowed'),
    // The link the old site stored, kept as imported. New experiences store
    // the playground id instead.
    expUrl: text('exp_url'),
    coverImgUrl: text('cover_img_url'),
    // The project's source repository, if the owner shares one.
    repoUrl: text('repo_url'),
    // Files too large to upload here, hosted elsewhere: a Dropbox, Google
    // Drive or GitHub link.
    filesUrl: text('files_url'),
    // All its players and all its bots. Worked out from `team_setup` where
    // there is one, and kept here so listings can show and filter on them.
    maxPlayers: integer('max_players').notNull().default(0),
    maxBots: integer('max_bots').notNull().default(0),
    // How it splits them into teams: for each team in order, how many people
    // and how many bots (`TeamSetup` in src/shared/teams.ts). Said by its
    // creator on the form. Null for one imported from the old site, which
    // never asked.
    teamSetup: jsonb('team_setup').$type<TeamSetup>(),
    // What it is built with. Read from an uploaded export, or chosen on the
    // form. Empty for Battlefield 2042, where the distinction does not exist.
    types: experienceTypeEnum('types').array().notNull().default(sql`'{}'`),
    // A template offers its files for others to take and publish their own
    // version of. The old site called this a "prefab".
    isTemplate: boolean('is_template').notNull().default(false),
    // Read from an uploaded export, or fetched from gametools.network by code.
    gameMode: text('game_mode'),
    mapRotation: jsonb('map_rotation'),
    // The progression mode gametools reports, as Portal names it:
    // "portal-default" earns full XP, anything else is restricted.
    xpMode: text('xp_mode'),
    // Whether playing it needs the paid game, or the free version will do.
    // Portal reports it for a code; without one it follows from the maps: one
    // paid map is enough. Null when not known, and for a game with no free
    // version.
    requiresFullGame: boolean('requires_full_game'),
    // The SDK release its creators last said it works with. Neither the
    // export nor the code lookup carries one, so it is chosen on the form.
    sdkVersionId: integer('sdk_version_id'),
    featured: boolean('featured').notNull().default(false),
    trending: boolean('trending').notNull().default(false),
    // What the nightly check last saw on Portal, when it looked, and since
    // when the answer has been what it is. Only the check writes these.
    portalState: portalStateEnum('portal_state').notNull().default('unchecked'),
    portalCheckedAt: timestamptz('portal_checked_at'),
    portalStateSince: timestamptz('portal_state_since'),
    // Set by people: the owner, an admin, or a moderator acting on reports.
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
    reviewFieldNotes: reviewFieldNotes(),
    // Set on the copy made to playtest something that is already live: the
    // experience it was copied from. A playtest never runs on the live row.
    copiedFromId: integer('copied_from_id').references(
      (): AnyPgColumn => experiences.id,
      { onDelete: 'set null' },
    ),
    // Set when the owner deletes it. The row stays, hidden everywhere.
    deletedAt: timestamptz('deleted_at'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    metaImage: text('meta_image'),
    includeInSitemap: boolean('include_in_sitemap').notNull().default(true),
    // While it is a draft: its form as its owner last saved it, every field as
    // typed, so the form opens as it was left. Its title, description and
    // cover are copied into their columns as well, for its page. Submitting
    // checks the whole form and clears this.
    draftForm: jsonb('draft_form').$type<{
      fields: Record<string, string | string[]>
      errors: Record<string, string>
    }>(),
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
    index('experiences_playground_idx').on(table.playgroundId),
    foreignKey({
      name: 'experiences_sdk_version_fk',
      columns: [table.sdkVersionId, table.game],
      foreignColumns: [sdkVersions.id, sdkVersions.game],
    }),
    check('experiences_max_players_check', sql`${table.maxPlayers} >= 0`),
    check('experiences_max_bots_check', sql`${table.maxBots} >= 0`),
    check(
      'experiences_team_setup_check',
      sql`${table.teamSetup} is null or jsonb_typeof(${table.teamSetup}) = 'array'`,
    ),
  ],
)

/**
 * An experience's gallery after its cover, in this order: links to pictures
 * and videos hosted elsewhere. Each is kept as it was typed; what it shows
 * is worked out from the link by `mediaOf` in `src/shared/media.ts`.
 */
export const experienceMedia = pgTable(
  'experience_media',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    url: text('url').notNull(),
  },
  (table) => [primaryKey({ columns: [table.experienceId, table.position] })],
)

/**
 * The people an experience is by, besides its owner. Each row is either a
 * name, for someone with no account here, or an account. Both are credits.
 *
 * An account can also be given edit access, which makes it a collaborator.
 * That is always the owner's explicit choice: it is off unless they turn it
 * on, and the import leaves it off for everyone the old site credited.
 *
 * An account the owner adds is not shown, and cannot edit, until that user
 * accepts.
 */
export const experienceCreators = pgTable(
  'experience_creators',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    name: text('name'),
    // The order they are shown in, after the owner.
    position: integer('position').notNull().default(0),
    canEdit: boolean('can_edit').notNull().default(false),
    acceptedAt: timestamptz('accepted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('experience_creators_user_unique').on(
      table.experienceId,
      table.userId,
    ),
    unique('experience_creators_name_unique').on(
      table.experienceId,
      table.name,
    ),
    index('experience_creators_user_idx').on(table.userId),
    check(
      'experience_creators_one_kind_check',
      sql`(${table.userId} is null) <> (${table.name} is null)`,
    ),
    // Only an account can edit.
    check(
      'experience_creators_edit_check',
      sql`${table.userId} is not null or not ${table.canEdit}`,
    ),
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
    // Tags that came from Portal or from the rotation's maps are refreshed by
    // the nightly check. The ones a creator chose are left alone.
    source: tagSourceEnum('source').notNull().default('creator'),
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
    reviewFieldNotes: reviewFieldNotes(),
  },
  (table) => [
    // An experience has at most one pending revision. A second edit replaces
    // the first.
    uniqueIndex('revisions_one_pending_per_experience')
      .on(table.experienceId)
      .where(sql`${table.status} = 'pending'`),
  ],
)

/**
 * A Battlefield 6 script snippet: a small piece of script to copy into your
 * own, pasted in or uploaded as one file. It is reviewed like an experience.
 */
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
    // The Portal export a snippet from the old site was made from. Nothing
    // new sets it: a snippet is submitted as its script alone.
    expJson: jsonb('exp_json'),
    // The snippet itself. Not `code`: on an experience and a playtest that is
    // the Portal share code. For one from the old site it is the Script.ts
    // attachment of its export.
    script: text('script').notNull().default(''),
    vidUrl: text('vid_url'),
    repoUrl: text('repo_url'),
    // The SDK release that was current when it was submitted.
    sdkVersionId: integer('sdk_version_id').references(() => sdkVersions.id),
    featured: boolean('featured').notNull().default(false),
    trending: boolean('trending').notNull().default(false),
    allowEditing: boolean('allow_editing').notNull().default(false),
    submittedAt: timestamptz('submitted_at').notNull().defaultNow(),
    firstPublishedAt: timestamptz('first_published_at'),
    lastPublishedAt: timestamptz('last_published_at'),
    // The moderator's decision on the submission itself, as on an experience.
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: timestamptz('reviewed_at'),
    reviewNote: text('review_note'),
    reviewFieldNotes: reviewFieldNotes(),
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

/** The same two kinds of creator as `experienceCreators`, for a script. */
export const snippetCreators = pgTable(
  'snippet_creators',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    snippetId: integer('snippet_id')
      .notNull()
      .references(() => snippets.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    name: text('name'),
    position: integer('position').notNull().default(0),
    canEdit: boolean('can_edit').notNull().default(false),
    acceptedAt: timestamptz('accepted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('snippet_creators_user_unique').on(table.snippetId, table.userId),
    unique('snippet_creators_name_unique').on(table.snippetId, table.name),
    index('snippet_creators_user_idx').on(table.userId),
    check(
      'snippet_creators_one_kind_check',
      sql`(${table.userId} is null) <> (${table.name} is null)`,
    ),
    check(
      'snippet_creators_edit_check',
      sql`${table.userId} is not null or not ${table.canEdit}`,
    ),
  ],
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
    reviewFieldNotes: reviewFieldNotes(),
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
    // What its addresses use, in place of the id: 32 random hex digits, so a
    // file's address cannot be guessed from another's, and how many there are
    // is not given away. Anyone may still only read what they may download.
    publicId: text('public_id')
      .notNull()
      .unique()
      .default(sql`replace(gen_random_uuid()::text, '-', '')`),
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
 * A file chosen on the submit form, held for whoever chose it until the form
 * is submitted. An export is read into the form before it is sent, and a form
 * posted with no script cannot send a file again once it is refused. When the
 * experience is offered as a template its files go into `project_files`;
 * otherwise they are let go. One held longer than a day is let go too.
 */
export const heldFiles = pgTable(
  'held_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // The draft it was saved with. Held as long as the draft is, rather than
    // for a day.
    experienceId: integer('experience_id').references(() => experiences.id, {
      onDelete: 'cascade',
    }),
    kind: fileKindEnum('kind').notNull(),
    filename: text('filename').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    body: text('body').notNull(),
    // What an export holds, read once when it was chosen. Null for any other
    // file.
    summary: jsonb('summary').$type<ExportSummary>(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    check('held_files_size_check', sql`${table.sizeBytes} >= 0`),
    index('held_files_uploaded_by_idx').on(table.uploadedBy),
    index('held_files_experience_idx').on(table.experienceId),
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
    reviewFieldNotes: reviewFieldNotes(),
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

/**
 * A submit form that was refused, kept so its sender does not have to type it
 * again. Only needed when the form was posted with no script: with one, the
 * page never goes away. One per person, replaced by their next, and removed
 * when a submission of theirs goes through.
 */
export const submissionDrafts = pgTable('submission_drafts', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  // The form's fields as they were sent, and what was wrong, by field.
  fields: jsonb('fields').notNull(),
  errors: jsonb('errors').notNull(),
  savedAt: timestamptz('saved_at').notNull().defaultNow(),
})

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
