import { createServerFn } from '@tanstack/solid-start'

import { currentActor } from '../server/auth/actor'
import { listOwnSubmissions } from '../server/services/own-submissions'

/** Everything the visitor has made here, and where each one stands. */
export const fetchOwnSubmissions = createServerFn({ method: 'GET' }).handler(
  async () => listOwnSubmissions(await currentActor()),
)

export type OwnSubmissions = Extract<
  Awaited<ReturnType<typeof fetchOwnSubmissions>>,
  { ok: true }
>
