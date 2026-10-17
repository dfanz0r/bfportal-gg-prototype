import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { user } from '../db/schema'
import { findPeople, peopleByDiscordId } from './people'

const NOW = new Date('2026-10-13T12:00:00Z')
const gala: Actor = { id: 'seed-gala', role: 'user' }

const names = async (actor: Actor, query: string) => {
  const result = await findPeople(actor, query)
  return result.ok ? result.people.map((person) => person.name) : result
}

const hide = (id: string, hidden: boolean) =>
  db.update(user).set({ hideUsername: hidden }).where(eq(user.id, id))

describe('finding people to credit', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await hide('seed-kestrel', false)
    await sql.end()
  })

  it('refuses a visitor who is not signed in', async () => {
    expect(await findPeople(null, 'kes')).toEqual({
      ok: false,
      reason: 'signed-out',
    })
  })

  it('finds names with the text in them, those that begin with it first', async () => {
    expect(await names(gala, 'sir')).toEqual([
      'Sir_Die-a-lot900',
      'Sirpopemeow',
    ])
    expect(await names(gala, 'ketch')).toEqual(['Ketchuppplant'])
    // "BellumI988" has "um" inside it, and nothing begins with it.
    expect(await names(gala, 'UM')).toEqual(['BellumI988'])
  })

  it('waits for two letters, and reads % and _ as themselves', async () => {
    expect(await names(gala, 'k')).toEqual([])
    expect(await names(gala, '%%')).toEqual([])
    expect(await names(gala, 'h_')).toEqual(['north_sector'])
  })

  it('never offers whoever is asking', async () => {
    expect(await names(gala, 'gala')).toEqual([])
    expect(await names({ id: 'seed-kestrel', role: 'user' }, 'gala')).toEqual([
      'Gala',
    ])
  })

  it('never offers someone who hides their name, by name or by id', async () => {
    await hide('seed-kestrel', true)
    expect(await names(gala, 'kestrel')).toEqual([])
    expect(
      await peopleByDiscordId(['900000000000000002', '900000000000000001']),
    ).toEqual([
      expect.objectContaining({
        name: 'Gala',
        discordId: '900000000000000001',
      }),
    ])
    await hide('seed-kestrel', false)
  })
})
