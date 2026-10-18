import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm'

import { experienceTypeLabels } from '../../shared/content'
import type { ExperienceForm } from '../../shared/experience-form'
import { gameInfo } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import { describeTeams, teamSetupSchema } from '../../shared/teams'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experienceCreators,
  experienceMedia,
  experiences,
  experienceTags,
  heldFiles,
  maps,
  projectFiles,
  revisions,
  tags,
  user,
} from '../db/schema'
import type { lookupExperience } from '../integrations/gametools'
import { renderMarkdown } from '../markdown'
import { discardDraft } from './drafts'
import { type EditPayload, editPayloadSchema } from './edit-payload'
import type { Editable } from './experience-drafts'
import { keepFilesWithDraft, takeHeldFiles } from './held-files'
import { prepareExperience, writeAround } from './prepare-experience'
import type { Executor } from './shared'
import { resendLimit } from './submission-limits'
import { lockEdits, pendingEdit } from './template-offers'

// Changing an experience that is live. The page stays as it is while a
// moderator looks at the change: what its owner sends waits as the
// experience's one pending edit, and sending again replaces what it asks
// for, so the moderator reviews everything asked for together. Approving it
// writes it to the page, as a submission is written.

/**
 * Sends the experience form as an edit to one of the actor's live
 * experiences. It is checked as a submission is. The template switch is not
 * part of the form here: it is on the experience's page.
 */
export async function submitExperienceEdit(
  actor: Actor,
  form: ExperienceForm,
  live: Editable,
  options: { lookup?: typeof lookupExperience; now?: Date } = {},
): Promise<{ ok: true; slug: string } | Refusal> {
  const now = options.now ?? new Date()
  const limited = resendLimit(actor)
  if (limited) return limited
  // Checked as the template it is, or will be once the offer waiting beside
  // it is approved: both are decided together.
  const [waiting] = await db
    .select({ payload: revisions.payload })
    .from(revisions)
    .where(pendingEdit(live.id))
    .limit(1)
  const offered =
    live.isTemplate ||
    editPayloadSchema.catch({}).parse(waiting?.payload).isTemplate === true
  const ready = await prepareExperience(
    actor,
    { ...form, isTemplate: offered },
    live,
    { lookup: options.lookup, now },
  )
  if (!ready.ok) return ready
  const { prepared, held } = ready

  return db.transaction(async (tx) => {
    // As the template switch and a moderator's decision take them, so one
    // waits for the other.
    await lockEdits(tx, live.id)
    const [still] = await tx
      .select({ id: experiences.id })
      .from(experiences)
      .where(
        and(
          eq(experiences.id, live.id),
          eq(experiences.ownerId, actor.id),
          eq(experiences.status, 'published'),
          isNull(experiences.deletedAt),
        ),
      )
    if (!still) return refuse('not-found')
    // Its files are held with it until a moderator decides: what it named
    // before and no longer does is let go.
    if (held.length > 0) {
      const files = await takeHeldFiles(tx, actor, prepared.files, {
        now,
        draft: live.id,
      })
      if (files.length < held.length) {
        return refuse('invalid', {
          files: 'A file is no longer held. Add it again.',
        })
      }
    }
    await keepFilesWithDraft(tx, actor, live.id, prepared.files, now)

    const [pending] = await tx
      .select({ id: revisions.id, payload: revisions.payload })
      .from(revisions)
      .where(pendingEdit(live.id))
      .limit(1)
    const asked = editPayloadSchema.catch({}).parse(pending?.payload)
    const payload: EditPayload = { ...asked, form: prepared }
    if (pending) {
      // What it asks for now replaces what it asked for, and its version
      // moves on, so a decision on the old one is refused. It keeps its place.
      await tx
        .update(revisions)
        .set({
          payload,
          submittedBy: actor.id,
          version: sql`${revisions.version} + 1`,
        })
        .where(eq(revisions.id, pending.id))
    } else {
      await tx.insert(revisions).values({
        experienceId: live.id,
        kind: 'edit',
        payload,
        submittedBy: actor.id,
        submittedAt: now,
      })
    }
    // Sent: the form opens on what is waiting from now on.
    await tx
      .update(experiences)
      .set({ draftForm: null })
      .where(eq(experiences.id, live.id))
    await discardDraft(tx, actor)
    return { ok: true as const, slug: live.slug }
  })
}

/**
 * Writes an approved edit to the live experience: the form, as checked when
 * it was sent, and the template switch. Its new files, held for it since, are
 * stored in place of the old. Refused, with nothing written, if one is gone.
 */
export async function applyEdit(
  tx: Executor,
  experienceId: number,
  sentBy: string,
  payload: EditPayload,
  now: Date,
): Promise<{ ok: true } | Refusal> {
  const [live] = await tx
    .select({ game: experiences.game, ownerId: experiences.ownerId })
    .from(experiences)
    .where(eq(experiences.id, experienceId))
  if (!live) return refuse('not-found')
  const { form } = payload
  if (form) {
    const files =
      form.files.length > 0
        ? await takeHeldFiles(tx, { id: sentBy, role: 'user' }, form.files, {
            now,
            draft: experienceId,
          })
        : []
    if (files.length < form.files.length) {
      return refuse('invalid', {
        form: 'A file it was sent with is no longer held. Request changes so its owner adds it again.',
      })
    }
    // Where a game's Portal has an export, the template switch is apart
    // from the form, on its page.
    const { isTemplate, ...values } = form.values
    await tx
      .update(experiences)
      .set({
        ...values,
        ...(gameInfo(live.game).hasExport ? {} : { isTemplate }),
        descriptionHtml: renderMarkdown(values.descriptionMd),
        lastPublishedAt: now,
      })
      .where(eq(experiences.id, experienceId))
    await writeAround(tx, experienceId, live.ownerId, form, files)
    if (files.length > 0) {
      await tx.delete(heldFiles).where(
        inArray(
          heldFiles.id,
          files.map((file) => file.id),
        ),
      )
    }
  }
  if (payload.isTemplate !== undefined) {
    await tx
      .update(experiences)
      .set({ isTemplate: payload.isTemplate })
      .where(eq(experiences.id, experienceId))
  }
  return { ok: true }
}

/**
 * The edit its owner last sent from the form, waiting or sent back, with
 * what the form held and the moderator's note on one sent back. Null when
 * there is none, or the last was approved. The form opens on it.
 */
export async function lastSentEdit(experienceId: number) {
  const [last] = await db
    .select({
      status: revisions.status,
      payload: revisions.payload,
      reviewNote: revisions.reviewNote,
    })
    .from(revisions)
    .where(
      and(
        eq(revisions.experienceId, experienceId),
        eq(revisions.kind, 'edit'),
        sql`${revisions.payload} ? 'form'`,
      ),
    )
    .orderBy(desc(revisions.submittedAt), desc(revisions.id))
    .limit(1)
  if (!last || last.status === 'approved') return null
  const form = editPayloadSchema.catch({}).parse(last.payload).form
  if (!form) return null
  return {
    waiting: last.status === 'pending',
    note: last.status === 'changes_requested' ? last.reviewNote : null,
    form,
  }
}

/** One field of an edit, as a moderator compares it. */
export type EditChange = {
  field: string
  live: string
  proposed: string
  /** Text long enough to show as a block, line breaks and all. */
  long?: boolean
  /** TypeScript, shown as code, the live version above the new one. */
  code?: boolean
  /** What approving it does, where that is more than the new value. */
  effect?: string
}

const none = 'None'
const list = (items: string[], separator = ', ') =>
  items.length > 0 ? items.join(separator) : none

/**
 * What an edit changes, field by field, beside what is live now, and the
 * fields it leaves as they are. Only what differs is a change.
 */
export async function describeEdit(experienceId: number, payload: EditPayload) {
  const [live] = await db
    .select({
      title: experiences.title,
      descriptionMd: experiences.descriptionMd,
      categoryId: experiences.categoryId,
      code: experiences.code,
      coverImgUrl: experiences.coverImgUrl,
      repoUrl: experiences.repoUrl,
      filesUrl: experiences.filesUrl,
      copyAllowed: experiences.copyAllowed,
      teamSetup: experiences.teamSetup,
      types: experiences.types,
      isTemplate: experiences.isTemplate,
      mapRotation: experiences.mapRotation,
    })
    .from(experiences)
    .where(eq(experiences.id, experienceId))
  const form = payload.form
  const [
    categoryRows,
    liveTags,
    liveMedia,
    liveCreators,
    liveFiles,
    tagRows,
    people,
    newFiles,
    mapRows,
  ] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        inArray(categories.id, [
          live.categoryId,
          ...(form ? [form.values.categoryId] : []),
        ]),
      ),
    db
      .select({ name: tags.name })
      .from(experienceTags)
      .innerJoin(tags, eq(tags.id, experienceTags.tagId))
      .where(
        and(
          eq(experienceTags.experienceId, experienceId),
          eq(experienceTags.source, 'creator'),
        ),
      )
      .orderBy(asc(tags.name)),
    db
      .select({ url: experienceMedia.url })
      .from(experienceMedia)
      .where(eq(experienceMedia.experienceId, experienceId))
      .orderBy(asc(experienceMedia.position)),
    db
      .select({ name: experienceCreators.name, account: user.name })
      .from(experienceCreators)
      .leftJoin(user, eq(user.id, experienceCreators.userId))
      .where(eq(experienceCreators.experienceId, experienceId))
      .orderBy(asc(experienceCreators.position)),
    db
      .select({ filename: projectFiles.filename })
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.experienceId, experienceId),
          eq(projectFiles.fromExport, false),
        ),
      )
      .orderBy(asc(projectFiles.id)),
    form && form.tagged.length > 0
      ? db
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(
            inArray(
              tags.id,
              form.tagged
                .filter((tag) => tag.source === 'creator')
                .map((tag) => tag.tagId),
            ),
          )
          .orderBy(asc(tags.name))
      : [],
    form && form.credited.length > 0
      ? db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(inArray(user.id, form.credited))
      : [],
    form && form.files.length > 0
      ? db
          .select({ filename: heldFiles.filename })
          .from(heldFiles)
          .where(inArray(heldFiles.id, form.files))
          .orderBy(asc(heldFiles.createdAt))
      : [],
    db
      .select({ levelId: maps.levelId, name: maps.name })
      .from(maps)
      .where(isNotNull(maps.levelId)),
  ])
  const categoryName = (id: number) =>
    categoryRows.find((row) => row.id === id)?.name ?? none
  const mapsOf = (rotation: unknown) =>
    list(
      [rotation ?? []].flat().map((entry) => {
        const levelId = String((entry as { map?: unknown })?.map ?? '')
        return mapRows.find((row) => row.levelId === levelId)?.name ?? levelId
      }),
    )
  const teams = (value: unknown) => {
    const read = teamSetupSchema.safeParse(value)
    return (read.success && describeTeams(read.data)) || none
  }
  const credits = (names: (string | null)[]) =>
    list(names.filter((name): name is string => Boolean(name)))
  const copy = (value: boolean | null) =>
    value === null ? 'Not said' : value ? 'Allowed' : 'Not allowed'

  const compared: EditChange[] = form
    ? [
        {
          field: 'Title',
          live: live.title,
          proposed: form.values.title,
        },
        {
          field: 'Description',
          live: live.descriptionMd || none,
          proposed: form.values.descriptionMd || none,
          long: true,
        },
        {
          field: 'Category',
          live: categoryName(live.categoryId),
          proposed: categoryName(form.values.categoryId),
        },
        {
          field: 'Code',
          live: live.code ?? none,
          proposed: form.values.code ?? none,
        },
        {
          field: 'Teams',
          live: teams(live.teamSetup),
          proposed: teams(form.values.teamSetup),
        },
        {
          field: 'Built with',
          live: list(live.types.map((type) => experienceTypeLabels[type])),
          proposed: list(
            form.values.types.map((type) => experienceTypeLabels[type]),
          ),
        },
        {
          field: 'Tags',
          live: list(liveTags.map((row) => row.name)),
          proposed: list(tagRows.map((row) => row.name)),
        },
        {
          field: 'Cover image',
          live: live.coverImgUrl ?? none,
          proposed: form.values.coverImgUrl ?? none,
        },
        {
          field: 'Gallery',
          live: list(
            liveMedia.map((row) => row.url),
            '\n',
          ),
          proposed: list(form.media, '\n'),
          long: true,
        },
        {
          field: 'Credits',
          live: credits(liveCreators.map((row) => row.account ?? row.name)),
          proposed: credits([
            ...form.credited.map(
              (id) => people.find((person) => person.id === id)?.name ?? null,
            ),
            ...form.credits,
          ]),
        },
        {
          field: 'Copying in the Portal editor',
          live: copy(live.copyAllowed),
          proposed: copy(form.values.copyAllowed),
        },
        {
          field: 'Repository',
          live: live.repoUrl ?? none,
          proposed: form.values.repoUrl ?? none,
        },
        ...(form.values.filesUrl === undefined
          ? []
          : [
              {
                field: 'Larger files',
                live: live.filesUrl ?? none,
                proposed: form.values.filesUrl ?? none,
              },
            ]),
        ...(form.values.mapRotation === undefined
          ? []
          : [
              {
                field: 'Map rotation',
                live: mapsOf(live.mapRotation),
                proposed: mapsOf(form.values.mapRotation),
              },
            ]),
        ...(form.files.length === 0
          ? []
          : [
              {
                field: 'Files',
                live: list(liveFiles.map((file) => file.filename)),
                proposed: list(newFiles.map((file) => file.filename)),
                effect:
                  'Once approved, these replace its files, with what is inside a new export.',
              },
            ]),
      ]
    : []
  const changes = compared.filter((change) => change.live !== change.proposed)
  // Named in a sentence: lower case but for a name such as Portal.
  const unchanged = compared
    .filter((change) => change.live === change.proposed)
    .map((change) => change.field[0].toLowerCase() + change.field.slice(1))
  return { changes, unchanged }
}
