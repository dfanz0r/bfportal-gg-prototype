import { describe, expect, it } from 'vitest'

import { describeTeams, teamTotals } from './teams'

const teams = (...list: [number, number][]) =>
  list.map(([players, bots]) => ({ players, bots }))

describe('a team setup', () => {
  it('reads as a line', () => {
    expect(describeTeams(teams([16, 0], [16, 0]))).toBe('16 v 16')
    expect(describeTeams(teams([4, 0], [8, 0]))).toBe('4 v 8')
    expect(describeTeams(teams([16, 14], [16, 0]))).toBe('16 + 14 bots v 16')
    expect(describeTeams(teams([8, 0], [0, 12]))).toBe('8 v 12 bots')
    expect(describeTeams(Array(17).fill({ players: 2, bots: 0 }))).toBe(
      '17 teams of 2',
    )
    expect(describeTeams(teams(...Array(5).fill([4, 0]), [2, 0]))).toBe(
      '6 teams',
    )
  })

  it('says nothing more than the lobby size for one team', () => {
    expect(describeTeams(teams([32, 0]))).toBeNull()
    // A team with no one on it is not a team to speak of.
    expect(describeTeams(teams([8, 0], [0, 0]))).toBeNull()
  })

  it('adds up', () => {
    expect(teamTotals(teams([8, 0], [0, 12], [4, 2]))).toEqual({
      players: 12,
      bots: 14,
    })
  })
})
