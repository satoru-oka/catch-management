import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const back = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back }),
}))

const apiFetch = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) }
})

// recharts は SVG 描画ライブラリで jsdom 上ではうまく機能しない (width=0 になりがち)。
// 集計ロジックの検証が目的なので chart 部分は data 属性付きの軽量モックに置き換える。
vi.mock('@/app/(protected)/stats/charts', () => ({
  MonthlyBarChart: ({ data }: { data: unknown }) => (
    <div data-testid="monthly-chart" data-rows={JSON.stringify(data)} />
  ),
  SpeciesPieChart: ({ data }: { data: unknown }) => (
    <div data-testid="species-chart" data-rows={JSON.stringify(data)} />
  ),
}))

import StatsPage from '@/app/(protected)/stats/page'

beforeEach(() => {
  back.mockReset()
  apiFetch.mockReset()
})

afterEach(() => vi.clearAllMocks())

describe('StatsPage', () => {
  it('読み込み中は FullScreenSpinner', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    render(<StatsPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('3 つの API を並列に取得する', async () => {
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce([])
    render(<StatsPage />)

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
    const urls = apiFetch.mock.calls.map((c) => c[0])
    expect(urls).toContain('/api/sessions/stats/monthly')
    expect(urls).toContain('/api/lures/stats')
    expect(urls).toContain('/api/catches')
  })

  it('月別データを月昇順に並べてチャートに渡す', async () => {
    apiFetch.mockResolvedValueOnce({
      '2026-05': { session_count: 2, catch_count: 5 },
      '2026-03': { session_count: 1, catch_count: 1 },
      '2026-04': { session_count: 0, catch_count: 0 },
    })
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce([])
    render(<StatsPage />)

    const chart = await screen.findByTestId('monthly-chart')
    const rows = JSON.parse(chart.getAttribute('data-rows')!)
    expect(rows.map((r: { month: string }) => r.month)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
    ])
  })

  it('魚種データは catches を集計し count 降順', async () => {
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce([
      { id: 'c1', fish_species: 'ヤマメ' },
      { id: 'c2', fish_species: 'ヤマメ' },
      { id: 'c3', fish_species: 'イワナ' },
      { id: 'c4', fish_species: 'ヤマメ' },
    ])
    render(<StatsPage />)

    const chart = await screen.findByTestId('species-chart')
    const rows = JSON.parse(chart.getAttribute('data-rows')!) as Array<{
      name: string
      count: number
    }>
    expect(rows).toEqual([
      { name: 'ヤマメ', count: 3 },
      { name: 'イワナ', count: 1 },
    ])
  })

  it('ルアー別ランキング: count 降順、トップ 5 のみ表示、トップ基準で割合計算', async () => {
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce({
      A: { count: 10, avg_length: 25 },
      B: { count: 4, avg_length: 22 },
      C: { count: 6, avg_length: 30 },
      D: { count: 2, avg_length: 18 },
      E: { count: 1, avg_length: 15 },
      F: { count: 1, avg_length: 12 },
      G: { count: 1, avg_length: 10 }, // 6 件目以降は表示されない
    })
    apiFetch.mockResolvedValueOnce([])
    render(<StatsPage />)

    await screen.findByText('A')
    // 上位 5 件のみ
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.getByText('E')).toBeInTheDocument()
    expect(screen.queryByText('G')).not.toBeInTheDocument()
    // 件数表示
    expect(screen.getByText(/10匹 \/ 平均25cm/)).toBeInTheDocument()
  })

  it('全データ空ならそれぞれ "データがありません" を表示', async () => {
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce([])
    render(<StatsPage />)

    const empties = await screen.findAllByText('データがありません')
    expect(empties.length).toBe(3)
    expect(screen.queryByTestId('monthly-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('species-chart')).not.toBeInTheDocument()
  })

  it('読み込み失敗時はエラーバナー (集計セクションは "データがありません" のまま)', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(500, '集計取得失敗'))
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce([])
    render(<StatsPage />)

    expect(await screen.findByText('集計取得失敗')).toBeInTheDocument()
  })

  it('← 戻る で router.back', async () => {
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce({})
    apiFetch.mockResolvedValueOnce([])
    render(<StatsPage />)
    await screen.findByText('統計')
    await userEvent.setup().click(screen.getByRole('button', { name: '前のページに戻る' }))
    expect(back).toHaveBeenCalled()
  })
})
