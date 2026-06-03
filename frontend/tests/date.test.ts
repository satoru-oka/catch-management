import { describe, expect, it } from 'vitest'
import { tokyoDateIso } from '@/lib/date'

describe('tokyoDateIso', () => {
  it('UTC 15:00 以降は JST の翌日として返す', () => {
    expect(tokyoDateIso(new Date('2026-05-31T15:30:00.000Z'))).toBe('2026-06-01')
  })

  it('UTC 15:00 前は JST の同日として返す', () => {
    expect(tokyoDateIso(new Date('2026-05-31T14:30:00.000Z'))).toBe('2026-05-31')
  })
})
