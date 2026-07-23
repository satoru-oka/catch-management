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

  it('numberFields の非数値入力は nullable でなければ省略する', () => {
    expect(buildFormPayload({ length_cm: 'abc' }, { numberFields: ['length_cm'] })).toEqual({})
  })

  it('numberFields の非数値入力は nullable なら null にする', () => {
    expect(
      buildFormPayload(
        { length_cm: 'abc' },
        { numberFields: ['length_cm'], nullableFields: ['length_cm'] },
      ),
    ).toEqual({ length_cm: null })
  })
})
