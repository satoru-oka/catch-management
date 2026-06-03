import { describe, expect, it } from 'vitest'

import { buildFormPayload } from '@/lib/formPayload'

describe('buildFormPayload', () => {
  it('空文字はデフォルトで payload から除外する', () => {
    expect(buildFormPayload({ name: '本流', notes: '' })).toEqual({ name: '本流' })
  })

  it('nullableFields に含まれる空文字は null にする', () => {
    expect(buildFormPayload({ name: '本流', notes: '' }, { nullableFields: ['notes'] })).toEqual({
      name: '本流',
      notes: null,
    })
  })

  it('numberFields は 0 を含めて数値化する', () => {
    expect(buildFormPayload({ length_cm: '0' }, { numberFields: ['length_cm'] })).toEqual({
      length_cm: 0,
    })
  })
})
