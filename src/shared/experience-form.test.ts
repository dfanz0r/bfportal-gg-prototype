import { describe, expect, it } from 'vitest'

import { experienceFormSchema, formErrors } from './experience-form'
import { formFields } from './form-input'

const base = {
  game: 'bf6',
  category: 'multiplayer',
  title: 'Gun Master',
  maxPlayers: '32',
}

describe('the submit form', () => {
  it('reads a posted form: strings, blanks, checkboxes and lines', () => {
    const form = new FormData()
    for (const [name, value] of Object.entries({
      ...base,
      code: ' 1264g ',
      link: '',
      description: '',
      isTemplate: 'true',
      images: 'https://i.example/a.png\n\n https://i.example/b.png ',
      credits: 'Coupe\nByte',
      repoUrl: '',
    })) {
      form.append(name, value)
    }
    form.append('tags', 'gun-game')
    form.append('tags', 'casual')
    form.append('built', 'script')

    expect(experienceFormSchema.parse(formFields(form))).toEqual({
      game: 'bf6',
      code: ' 1264g ',
      category: 'multiplayer',
      title: 'Gun Master',
      description: '',
      tags: ['gun-game', 'casual'],
      built: ['script'],
      isTemplate: true,
      copyAllowed: false,
      maxPlayers: 32,
      maxBots: 0,
      images: ['https://i.example/a.png', 'https://i.example/b.png'],
      credits: ['Coupe', 'Byte'],
    })
  })

  it('says what is wrong, by field', () => {
    const result = experienceFormSchema.safeParse({
      ...base,
      title: 'x',
      maxPlayers: '0',
      coverImgUrl: 'http://plain.example/a.png',
      repoUrl: 'https://evil.example/repo',
      filesUrl: 'https://github.com.evil.example/x',
      images: Array.from({ length: 9 }, (_, n) => `https://i.example/${n}.png`),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(Object.keys(formErrors(result.error)).sort()).toEqual([
      'coverImgUrl',
      'filesUrl',
      'images',
      'maxPlayers',
      'repoUrl',
      'title',
    ])
  })

  it('takes a repository and files only from the hosts it knows', () => {
    const ok = experienceFormSchema.parse({
      ...base,
      repoUrl: 'https://github.com/someone/project',
      filesUrl: 'https://www.dropbox.com/s/abc/files.zip',
    })
    expect(ok.repoUrl).toBe('https://github.com/someone/project')
    expect(ok.filesUrl).toMatch(/dropbox/)
  })
})
