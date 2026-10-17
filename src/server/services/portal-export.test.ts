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

  it('keeps every attachment with something in it, whatever its type', () => {
    const json = JSON.parse(portalExport({ script: 'let a = 1', maps: [] }))
    for (const attachment of json.attachments) {
      // Strings under a type this reader has not seen, kept only as compiled.
      if (attachment.filename === 'bundle.strings.json') {
        attachment.attachmentType = 9
        attachment.attachmentData.compiled = attachment.attachmentData.original
        attachment.attachmentData.original = ''
      }
    }
    json.attachments.push({
      ...json.attachments[0],
      filename: 'notes.json',
      attachmentType: 7,
      attachmentData: {
        original: Buffer.from('{"a": 1}').toString('base64'),
        compiled: '',
      },
    })
    const read = readExport(JSON.stringify(json))
    if (!read) throw new Error('expected an export')
    expect(
      filesInExport(read.export).map((file) => [file.kind, file.filename]),
    ).toEqual([
      ['script', 'bundle.ts'],
      ['strings', 'bundle.strings.json'],
      ['other', 'notes.json'],
    ])
  })

  it('reads a long array of blocks, which is more than a call takes as arguments', () => {
    const json = JSON.parse(portalExport({ maps: [] }))
    json.workspace.mod.blocks.blocks.push(
      Array.from({ length: 300_000 }, () => 0),
    )
    expect(readExport(JSON.stringify(json))?.summary.blocks).toBe(0)
  })

  it('reads nothing from an export with more in it than any real one', () => {
    const json = JSON.parse(portalExport({ maps: [] }))
    const one = json.attachments[0]
    json.attachments = Array.from({ length: 8000 }, () => one)
    expect(readExport(JSON.stringify(json))).toBeNull()
  })

  it('places a layout on a map of the rotation, or on none', () => {
    const json = JSON.parse(portalExport({ maps: ['MP_Abbasid'] }))
    const layout = json.attachments.find(
      (item: { attachmentType: number }) => item.attachmentType === 1,
    )
    layout.metadata = 'mapIdx=99999999999'
    json.attachments.push({
      ...layout,
      filename: 'b.spatial.json',
      metadata: 'mapIdx=1',
    })
    const read = readExport(JSON.stringify(json))
    if (!read) throw new Error('expected an export')
    expect(
      filesInExport(read.export)
        .filter((file) => file.kind === 'spatial')
        .map((file) => file.mapIndex),
    ).toEqual([null, null])
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
