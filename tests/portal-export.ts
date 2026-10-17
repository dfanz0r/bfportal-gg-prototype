// A Battlefield 6 Portal export for tests, in the shape real ones have: two
// read on 2026-10-16, one built with blocks and one with TypeScript.

const base64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')

let next = 0
const attachment = (
  attachmentType: number,
  filename: string,
  text: string,
  metadata?: string,
) => ({
  id: `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`,
  version: '123',
  filename,
  isProcessable: true,
  processingStatus: 2,
  attachmentData: { original: base64(text), compiled: '' },
  attachmentType,
  ...(metadata ? { metadata } : {}),
  errors: [],
})

/**
 * The export's text. `maps` are level ids, each given a spatial layout;
 * `rules` are rule names, each a block holding one action block.
 */
export function portalExport(
  options: {
    name?: string
    description?: string
    script?: string
    rules?: string[]
    maps?: string[]
    teams?: { players: number; bots?: number }[]
  } = {},
) {
  const maps = options.maps ?? ['MP_Abbasid']
  const spatial = maps.map((map, index) =>
    attachment(
      1,
      `${map}_Test.spatial.json`,
      JSON.stringify({ Portal_Dynamic: [{ name: `object ${index}` }] }),
      `mapIdx=${index}`,
    ),
  )
  const rules = (options.rules ?? []).map((name, index) => ({
    type: 'ruleBlock',
    id: `rule-${index}`,
    fields: { NAME: name },
    inputs: {
      ACTIONS: { block: { type: 'Wait', id: `wait-${index}` } },
    },
  }))
  return JSON.stringify({
    mutators: { MaxPlayerCount_PerTeam: 16 },
    assetRestrictions: {},
    name: options.name ?? 'Test Mode',
    description: options.description ?? 'A mode for tests.',
    mapRotation: maps.map((map, index) => ({
      id: `${map}-ModBuilderCustom0`,
      spatialAttachment: spatial[index],
    })),
    workspace: {
      mod: {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'modBlock',
              id: 'mod',
              x: 0,
              y: 0,
              deletable: false,
              ...(rules.length > 0
                ? { inputs: { RULES: { block: rules[0] } } }
                : {}),
            },
            ...rules.slice(1),
          ],
        },
      },
    },
    teamComposition: (options.teams ?? [{ players: 16 }, { players: 16 }]).map(
      (team, index) => [
        index + 1,
        { humanCapacity: team.players, aiCapacity: team.bots ?? 0, aiType: 0 },
      ],
    ),
    gameMode: 'ModBuilderCustom',
    attachments: [
      ...spatial,
      attachment(2, 'bundle.ts', options.script ?? ''),
      attachment(3, 'blacklist.json', ''),
      ...(options.script
        ? [attachment(4, 'bundle.strings.json', '{"hello": "Hello"}')]
        : []),
    ],
  })
}
