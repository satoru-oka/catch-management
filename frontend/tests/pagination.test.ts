import { describe, expect, it, vi } from 'vitest'

import { fetchAllPages, withPagination } from '@/lib/pagination'

describe('pagination helpers', () => {
  it('limit/offset を query に付与する', () => {
    expect(withPagination('/api/catches?fish_species=ヤマメ', { limit: 25, offset: 50 })).toBe(
      '/api/catches?fish_species=%E3%83%A4%E3%83%9E%E3%83%A1&limit=25&offset=50',
    )
  })

  it('最終ページまで取得して結合する', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
      .mockResolvedValueOnce([{ id: 'c' }])

    const rows = await fetchAllPages('/api/items', fetchPage, 2)

    expect(rows).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect(fetchPage).toHaveBeenNthCalledWith(1, '/api/items?limit=2&offset=0')
    expect(fetchPage).toHaveBeenNthCalledWith(2, '/api/items?limit=2&offset=2')
  })
})
