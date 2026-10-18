import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import {
  getTaxonomy,
  moveInList,
  saveCategory,
  saveTag,
  saveTagGroup,
} from '../server/services/admin-taxonomy'
import { games, tagGroupFilters, tagGroupPicks } from '../shared/content'
import { formCheckbox, formOr } from '../shared/form-input'
import { defaultGame } from '../shared/games'
import { refuse } from '../shared/results'
import { formAnswer } from './answer'

// Each game's categories, tag groups and tags, for the admins alone. The
// services refuse everyone else.

/** A game's categories and tags. */
export const fetchTaxonomy = createServerFn({ method: 'GET' })
  .validator(z.object({ game: z.enum(games).optional() }))
  .handler(async ({ data }) =>
    getTaxonomy(await currentActor(), data.game ?? defaultGame.id),
  )

const name = z.string().trim().min(2, 'Give it a name.').max(60)
/** A row's id when it is changed; none when it is added. */
const id = z.coerce.number().int().positive().optional()

/** Adds a category, for one game or every game, or changes one. */
export const writeCategory = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        id,
        kind: z.enum(['experience_main', 'script_main']).optional(),
        /** "all" for a category every game has. */
        game: z.enum([...games, 'all']).optional(),
        name,
        visible: formCheckbox,
        selectableOnForm: formCheckbox,
        marksTemplate: formCheckbox,
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const target = input?.id
      ? { id: input.id }
      : input?.kind && input.game
        ? {
            kind: input.kind,
            game: input.game === 'all' ? null : input.game,
          }
        : null
    const result =
      input && target
        ? await saveCategory(await currentActor(), target, input)
        : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

/** Adds a tag group to a game, or changes one. */
export const writeTagGroup = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        id,
        game: z.enum(games).optional(),
        name,
        description: z.string().trim().max(300),
        filter: z.enum(tagGroupFilters),
        pick: z.enum(tagGroupPicks),
        creatorSelectable: formCheckbox,
        showOnCard: formCheckbox,
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const target = input?.id
      ? { id: input.id }
      : input?.game
        ? { game: input.game }
        : null
    const result =
      input && target
        ? await saveTagGroup(await currentActor(), target, input)
        : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

/** Adds a tag to one of a game's groups, or changes one. */
export const writeTag = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        id,
        game: z.enum(games).optional(),
        name,
        visible: formCheckbox,
        groupId: z.coerce.number().int().positive(),
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const target = input?.id
      ? { id: input.id }
      : input?.game
        ? { game: input.game }
        : null
    const result =
      input && target
        ? await saveTag(await currentActor(), target, input)
        : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

/** Moves a category, a tag group or a tag one place up or down its list. */
export const move = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        what: z.enum(['category', 'tag-group', 'tag']),
        id: z.coerce.number().int().positive(),
        direction: z.enum(['up', 'down']),
        /** The game whose list of categories was shown. */
        game: z.enum(games).optional(),
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const result = input
      ? await moveInList(
          await currentActor(),
          input.what,
          input.id,
          input.direction,
          input.game,
        )
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

export type Taxonomy = Extract<
  Awaited<ReturnType<typeof fetchTaxonomy>>,
  { ok: true }
>
