import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { listUsers, setRole } from '../server/services/admin-users'
import { usersSearchSchema } from '../shared/admin-search'
import { formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
import { roles } from '../shared/roles'
import { formAnswer } from './answer'

// The site's accounts and their roles, for the admins alone. The services
// refuse everyone else.

/** Accounts, as the screen's address filters them. */
export const fetchUsers = createServerFn({ method: 'GET' })
  .validator(usersSearchSchema)
  .handler(async ({ data }) => listUsers(await currentActor(), data))

/** Gives an account a role. */
export const changeRole = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        userId: z.string().min(1).max(200),
        role: z.enum(roles),
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const result = input
      ? await setRole(await currentActor(), input.userId, input.role)
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

export type Users = Extract<
  Awaited<ReturnType<typeof fetchUsers>>,
  { ok: true }
>
