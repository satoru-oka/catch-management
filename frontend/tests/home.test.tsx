import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({}),
}))

const apiFetch = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) }
})

const getUser = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { getUser } }),
}))

import HomePage from '@/app/(protected)/page'

const today = new Date().toISOString().slice(0, 10)

// /api/catches/stats/summary のレスポンス相当 (#72 でサーバー集計に移行)。
const recentCatch = {
  id: 'catch1',
  session_id: 'ses1',
  fish_species: 'ヤマメ',
  length_cm: 25,
  weight_g: 500,
  lure_id: null,
  lure_name: 'D-コンタクト',
  lure_color: 'アユ',
  caught_at: null,
  is_released: true,
  photo_url: null,
  notes: null,
  created_at: '',
  sessions: { date: today, spots: { name: '本流ポイント', river_name: '球磨川' } },
}

const emptySummary = {
  today: { count: 0, total_weight_g: 0, max_length_cm: null },
  lifetime_count: 0,
  month_count: 0,
  max_catch: null,
  recent: [],
}

function summaryWith(overrides: Partial<typeof emptySummary>) {
  return { ...emptySummary, ...overrides }
}

beforeEach(() => {
  apiFetch.mockReset()
  getUser.mockReset()
  getUser.mockResolvedValue({
    data: {
      user: {
        email: 'satoru@example.com',
        user_metadata: { display_name: '釣り太郎' },
      },
    },
  })
})

afterEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('HomePage', () => {
  it('読み込み中は FullScreenSpinner', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    getUser.mockReturnValue(new Promise(() => {}))

    render(<HomePage />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('サマリーを 1 本の集計 API で取得してダッシュボードを表示する', async () => {
    apiFetch.mockResolvedValueOnce(
      summaryWith({
        today: { count: 1, total_weight_g: 500, max_length_cm: 25 },
        lifetime_count: 1,
        month_count: 1,
        max_catch: { fish_species: 'ヤマメ', length_cm: 25 },
        recent: [recentCatch],
      }),
    )

    render(<HomePage />)

    expect(await screen.findByText('こんにちは、釣り太郎さん！')).toBeInTheDocument()
    expect(screen.getByText('最近の釣果')).toBeInTheDocument()
    expect(screen.getByText('ヤマメ')).toBeInTheDocument()
    expect(screen.getByText(/球磨川/)).toBeInTheDocument()

    await waitFor(() => {
      // 全件ページングではなくサマリー 1 本だけを叩く
      expect(apiFetch).toHaveBeenCalledTimes(1)
      expect(apiFetch).toHaveBeenCalledWith('/api/catches/stats/summary')
      expect(getUser).toHaveBeenCalled()
    })
  })

  it('今日/今月の数値と JST の日付ヘッダを表示する', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-31T15:30:00.000Z')) // 2026-06-01 00:30 JST
    apiFetch.mockResolvedValueOnce(
      summaryWith({
        today: { count: 1, total_weight_g: 420, max_length_cm: 42 },
        month_count: 1,
      }),
    )

    render(<HomePage />)

    const todaySection = (await screen.findByText('今日の釣果')).closest('section')
    expect(todaySection).not.toBeNull()
    expect(within(todaySection as HTMLElement).getByText('6月1日(月)')).toBeInTheDocument()
    expect(within(todaySection as HTMLElement).getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /今月の釣果/ })).toHaveTextContent('1匹')
    expect(screen.getByRole('link', { name: /今月の釣果/ })).toHaveTextContent('06月')
  })

  it('プロフィール名が無い場合はメールアカウント名で挨拶する', async () => {
    getUser.mockResolvedValueOnce({
      data: {
        user: {
          email: 'angler@example.com',
          user_metadata: {},
        },
      },
    })
    apiFetch.mockResolvedValueOnce(emptySummary)

    render(<HomePage />)

    expect(await screen.findByText('こんにちは、anglerさん！')).toBeInTheDocument()
  })

  it('主要リンクが期待するページへ向いている', async () => {
    apiFetch.mockResolvedValueOnce(emptySummary)

    render(<HomePage />)

    await screen.findByText('釣果記録がまだありません')
    expect(screen.getByRole('link', { name: '設定' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: '＋ 釣果を記録' })).toHaveAttribute(
      'href',
      '/sessions/new',
    )
    expect(screen.getByRole('link', { name: /総釣果数/ })).toHaveAttribute('href', '/stats')
  })

  it('釣果 0 件で空状態の案内が出る', async () => {
    apiFetch.mockResolvedValueOnce(emptySummary)

    render(<HomePage />)

    expect(await screen.findByText('釣果記録がまだありません')).toBeInTheDocument()
  })

  it('読み込み失敗時はエラーバナーを表示する', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(500, '取得失敗'))

    render(<HomePage />)

    expect(await screen.findByText('読み込みに失敗しました: 取得失敗')).toBeInTheDocument()
  })
})
