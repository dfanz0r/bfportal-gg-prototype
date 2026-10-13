import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { forgetLookups, lookupExperience } from './gametools'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')

/** Stands in for gametools, and records what it was asked. */
function stubGametools(answer: () => Response | Promise<Response>) {
  const asked: string[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    asked.push(String(input))
    return answer()
  })
  return asked
}

describe('looking an experience up on gametools', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    forgetLookups()
  })

  it('reads a Battlefield 6 experience', async () => {
    const asked = stubGametools(() => new Response(fixture('bf6-1264g')))

    const result = await lookupExperience('bf6', { code: '1264g' })

    expect(asked).toEqual([
      'https://api.gametools.network/bf6/playground/?experiencecode=1264g',
    ])
    expect(result).toEqual({
      status: 'found',
      experience: {
        playgroundId: '2a5ea060-9aa2-11f1-89bb-9e77d3f592d2',
        code: '1264g',
        title: 'Air Vehicle Sandbox',
        description: 'Test every air vehicle in an open sandbox',
        thumbnailUrl: expect.stringMatching(
          /^https:\/\/eaassets-a\.akamaihd\.net\//,
        ),
        published: true,
        rotation: [
          {
            levelId: 'MP_Portal_Sand',
            name: 'Portal Sandbox',
            mode: 'Custom',
            rounds: 1,
            teams: [12, 12],
          },
        ],
        tags: ['custom_scripted'],
        xpMode: 'portal-unranked',
        // "multiplayer" alone: the free version can play it.
        requiresFullGame: false,
      },
    })
  })

  it('reads a Battlefield 2042 experience, which says less', async () => {
    const asked = stubGametools(() => new Response(fixture('bf2042-aa3hny')))

    const result = await lookupExperience('bf2042', { code: 'aa3hny' })

    expect(asked[0]).toContain('/bf2042/playground/?experiencecode=aa3hny&')
    expect(result).toMatchObject({
      status: 'found',
      experience: {
        playgroundId: null,
        title: 'PAYLOAD (OF AGES)',
        published: true,
        xpMode: 'portal-unranked',
        requiresFullGame: null,
      },
    })
    if (result.status !== 'found') throw new Error('expected it to be found')
    // No level id and no teams: a name and the size of the lobby.
    expect(result.experience.rotation[0]).toEqual({
      levelId: null,
      name: 'Exposure',
      mode: 'Custom',
      rounds: 1,
      teams: [24],
    })
    expect(result.experience.tags).toContain('mapdefault_era')
  })

  it('asks by playground id when given one', async () => {
    const asked = stubGametools(() => new Response(fixture('bf6-1264g')))
    await lookupExperience('bf6', { playgroundId: 'abc' })
    expect(asked[0]).toMatch(/experienceid=abc$/)
  })

  it.each([
    '{"errors":["could not find a experience based on the requested experience code"]}',
    '{"errors":["Playground not found"]}',
  ])(
    'says an experience is missing when gametools says so: %s',
    async (body) => {
      stubGametools(() => new Response(body, { status: 404 }))
      expect(await lookupExperience('bf6', { code: 'zzzz9' })).toEqual({
        status: 'missing',
      })
    },
  )

  it('escapes what it is asked about', async () => {
    const asked = stubGametools(() => new Response('{}', { status: 500 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await lookupExperience('bf6', { code: 'a&b=c d' })
    expect(asked[0]).toMatch(/experiencecode=a%26b%3Dc%20d$/)
  })

  it('asks once for the same thing within a minute', async () => {
    const asked = stubGametools(() => new Response(fixture('bf6-1264g')))
    await lookupExperience('bf6', { code: '1264g' })
    await lookupExperience('bf6', { code: '1264g' })
    await lookupExperience('bf6', { code: 'other' })
    expect(asked).toHaveLength(2)
  })

  it('asks again after gametools failed to answer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const asked = stubGametools(() => new Response('down', { status: 503 }))
    await lookupExperience('bf6', { code: '1264g' })
    await lookupExperience('bf6', { code: '1264g' })
    expect(asked).toHaveLength(2)
  })

  it('does not call an empty list of licenses free to play', async () => {
    const reply = JSON.parse(fixture('bf6-1264g'))
    reply.playElementDesign.licenseRequirements = []
    stubGametools(() => new Response(JSON.stringify(reply)))
    const result = await lookupExperience('bf6', { code: '1264g' })
    expect(
      result.status === 'found' && result.experience.requiresFullGame,
    ).toBeNull()
  })

  it.each([
    ['is down', () => new Response('bad gateway', { status: 502 })],
    ['answers with something else', () => new Response('{"unexpected":true}')],
    // A 404 that is not gametools' own, as from a proxy or a moved address.
    [
      'answers 404 with a web page',
      () => new Response('<html>Not Found</html>', { status: 404 }),
    ],
    [
      'answers 404 with other JSON',
      () => new Response('{"detail":"no route"}', { status: 404 }),
    ],
    [
      'leaves out whether it is published',
      () => {
        const reply = JSON.parse(fixture('bf6-1264g'))
        delete reply.playElement.publishStateType
        return new Response(JSON.stringify(reply))
      },
    ],
    ['answers with nonsense', () => new Response('<html>')],
    [
      'cannot be reached',
      () => {
        throw new TypeError('fetch failed')
      },
    ],
  ])(
    'says nothing about the experience when gametools %s',
    async (_, answer) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      stubGametools(answer)
      expect(await lookupExperience('bf6', { code: '1264g' })).toEqual({
        status: 'unavailable',
      })
    },
  )
})
