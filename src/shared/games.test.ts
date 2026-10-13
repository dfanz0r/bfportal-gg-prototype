import { describe, expect, it } from 'vitest'

import { games } from './content'
import {
  editorUrl,
  gameInfo,
  gameList,
  normalizeCode,
  parsePortalLink,
  publicPageUrl,
} from './games'

const ID = '139588e0-c1e3-11f1-9424-e46ae39b09ae'

describe('games', () => {
  it('has an entry for every game the database knows', () => {
    expect(gameList.map((game) => game.id).sort()).toEqual([...games].sort())
    expect(new Set(gameList.map((game) => game.libraryPath)).size).toBe(
      games.length,
    )
  })

  it('accepts a share code of the right length for the game', () => {
    expect(normalizeCode('bf6', ' 1264G ')).toBe('1264g')
    expect(normalizeCode('bf6', 'hyqt')).toBe('hyqt')
    expect(normalizeCode('bf6', 'aat4kd')).toBeNull()
    expect(normalizeCode('bf2042', 'AAT4KD')).toBe('aat4kd')
    expect(normalizeCode('bf2042', '1264g')).toBeNull()
    expect(normalizeCode('bf6', '12 64')).toBeNull()
  })

  it("builds both of an experience's Portal pages from its id", () => {
    expect(editorUrl('bf6', ID)).toBe(
      `https://portal.battlefield.com/bf6/experience?id=${ID}`,
    )
    expect(editorUrl('bf2042', ID)).toBe(
      `https://portal.battlefield.com/experience?playgroundId=${ID}`,
    )
    expect(publicPageUrl('bf6', ID)).toBe(
      `https://www.ea.com/games/battlefield/battlefield-6/portal/buy/creation/${ID}`,
    )
    // 2042 has no public browser of experiences.
    expect(publicPageUrl('bf2042', ID)).toBeNull()
  })

  it.each([
    `https://portal.battlefield.com/bf6/experience?id=${ID}`,
    `https://portal.battlefield.com/bf6/experience/settings/mode?id=${ID}`,
    `https://portal.battlefield.com/bf6/experience/choose-maps?id=${ID}`,
    `https://portal.battlefield.com/bf6/experience/teams?id=${ID}`,
    `https://portal.battlefield.com/bf6/experience/?id=${ID.toUpperCase()}`,
    `https://www.ea.com/games/battlefield/battlefield-6/portal/buy/creation/${ID}`,
    `https://www.ea.com/en-gb/games/battlefield/battlefield-6/portal/buy/creation/${ID}/`,
    `  https://portal.battlefield.com/bf6/experience?id=${ID}&tab=rules  `,
  ])('reads a Battlefield 6 link: %s', (link) => {
    expect(parsePortalLink(link)).toEqual({ game: 'bf6', playgroundId: ID })
  })

  it.each([
    `https://portal.battlefield.com/experience/rules?playgroundId=${ID}`,
    `https://portal.battlefield.com/experience/package/era?playgroundId=${ID}&test=true`,
  ])('reads a Battlefield 2042 link: %s', (link) => {
    expect(parsePortalLink(link)).toEqual({ game: 'bf2042', playgroundId: ID })
  })

  it.each([
    'not a link',
    `http://portal.battlefield.com/bf6/experience?id=${ID}`,
    `https://portal.battlefield.com.evil.example/bf6/experience?id=${ID}`,
    `https://evil.example/bf6/experience?id=${ID}`,
    'https://portal.battlefield.com/bf6/experience?id=not-an-id',
    'https://portal.battlefield.com/bf6/experience',
    // The other game's parameter name.
    `https://portal.battlefield.com/bf6/experience?playgroundId=${ID}`,
    `https://portal.battlefield.com/bf6/experiences?id=${ID}`,
    `https://www.ea.com/games/battlefield/battlefield-6/portal/buy/creation/`,
  ])('refuses %s', (link) => {
    expect(parsePortalLink(link)).toBeNull()
  })

  it('says what each game supports', () => {
    expect(gameInfo('bf6').hasFreeVersion).toBe(true)
    expect(gameInfo('bf2042').builtWith).toEqual([])
  })
})
