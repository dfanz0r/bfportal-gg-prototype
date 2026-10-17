import { z } from 'zod'

// How an experience splits its players into teams: how many people and how
// many bots on each. Most are two even teams, but not all: 4 against 8, people
// against a team of bots, or 17 teams of 2. The form, the service and the
// pages read this one shape.

/** The most teams one experience may have: as many as players, one each. */
export const MAX_TEAMS = 128

export const teamSetupSchema = z
  .array(
    z.object({
      players: z.number().int().min(0),
      bots: z.number().int().min(0),
    }),
  )
  .max(MAX_TEAMS)

export type TeamSetup = z.infer<typeof teamSetupSchema>

/** All of a setup's players and bots. */
export function teamTotals(teams: TeamSetup) {
  return {
    players: teams.reduce((sum, team) => sum + team.players, 0),
    bots: teams.reduce((sum, team) => sum + team.bots, 0),
  }
}

/** One team in a few words: "16", "16 + 14 bots", "12 bots". */
function team(item: TeamSetup[number]) {
  if (item.bots === 0) return String(item.players)
  if (item.players === 0) return `${item.bots} bots`
  return `${item.players} + ${item.bots} bots`
}

/**
 * The teams in a line: "16 v 16", "8 v 12 bots", or, for many small teams,
 * "17 teams of 2". Null for a single team, which says no more than the
 * lobby size does.
 */
export function describeTeams(teams: TeamSetup) {
  const shown = teams.filter((item) => item.players + item.bots > 0)
  if (shown.length < 2) return null
  if (shown.length <= 4) return shown.map(team).join(' v ')
  const first = team(shown[0])
  return shown.every((item) => team(item) === first)
    ? `${shown.length} teams of ${first}`
    : `${shown.length} teams`
}
