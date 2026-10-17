import { describe, expect, it } from 'vitest'

import { portalExport } from '../../../tests/portal-export'
import { filesInExport, readExport } from './portal-export'

describe('reading a Portal export', () => {
  it('says what a TypeScript export holds', () => {
    const read = readExport(
      portalExport({
        name: '  Payload  ',
        script: 'export function OnGameModeStarted() {\n  return\n}\n',
        maps: ['MP_Abbasid', 'MP_Tungsten'],
        teams: [{ players: 12 }, { players: 12, bots: 4 }],
      }),
    )
    expect(read?.summary).toEqual({
      name: 'Payload',
      description: 'A mode for tests.',
      teams: [
        { players: 12, bots: 0 },
        { players: 12, bots: 4 },
      ],
      mode: 'Custom',
      maps: ['MP_Abbasid', 'MP_Tungsten'],
      scriptLines: 3,
      blocks: 0,
      spatialLayouts: 2,
      types: ['script', 'spatial'],
    })
  })

  it('counts blocks inside one another, but not the one every mod starts with', () => {
    const read = readExport(
      portalExport({ rules: ['Start', 'Score', 'End'], maps: [] }),
    )
    // Three rules, each holding one action.
    expect(read?.summary).toMatchObject({
      blocks: 6,
      scriptLines: 0,
      spatialLayouts: 0,
      types: ['blocks'],
    })
  })

  it('takes out the files inside it, script first and maps in order', () => {
    const read = readExport(
      portalExport({
        script: 'let a = 1',
        maps: ['MP_Capstone', 'MP_Abbasid'],
      }),
    )
    if (!read) throw new Error('expected an export')
    expect(
      filesInExport(read.export).map((file) => [
        file.kind,
        file.filename,
        file.mapIndex,
      ]),
    ).toEqual([
      ['script', 'bundle.ts', null],
      ['strings', 'bundle.strings.json', null],
      ['spatial', 'MP_Capstone_Test.spatial.json', 0],
      ['spatial', 'MP_Abbasid_Test.spatial.json', 1],
    ])
    expect(filesInExport(read.export)[0].body).toBe('let a = 1')
  })

  it('reads nothing from what is not an export', () => {
    expect(readExport('not json')).toBeNull()
    expect(readExport('{"name": "No mode"}')).toBeNull()
    expect(readExport('[1, 2]')).toBeNull()
    const broken = JSON.parse(portalExport())
    broken.attachments[0].attachmentData.original = 'not base64!'
    expect(readExport(JSON.stringify(broken))).toBeNull()
  })
})
