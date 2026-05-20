import { render, screen } from '@testing-library/react'
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

const session = {
  id: 'ses1',
  user_id: 'u',
  spot_id: 'sp1',
  date: '2026-05-01',
  start_time: null,
  end_time: null,
  water_level: '平水',
  water_clarity: 'クリア',
  weather: '晴れ',
  notes: null,
  created_at: '',
  spots: { name: '本流ポイント', river_name: '球磨川' },
}

const catchRecord = {
  id: 'c1',
  user_id: 'u',
  session_id: 'ses1',
  fish_species: 'ブラックバス',
  length_cm: 42,
  weight_g: 1200,
  caught_at: '2026-05-01T07:00:00',
  lure_id: null,
  photo_url: null,
  notes: null,
  created_at: '',
  sessions: { date: '2026-05-01', spot_id: 'sp1' },
}

beforeEach(() => {
  apiFetch.mockReset()
  getUser.mockReset()
  getUser.mockResolvedValue({
    data: {
      user: {
        email: 'angler@example.com',
        user_metadata: { display_name: '釣り人' },
      },
    },
  })
})

afterEach(() => vi.clearAllMocks())

describe('HomePage', () => {
  it('読み込み中は FullScreenSpinner', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    render(<HomePage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('最近の釣果を表示する', async () => {
    apiFetch.mockResolvedValueOnce([catchRecord])
    apiFetch.mockResolvedValueOnce([session])

    render(<HomePage />)

    expect(await screen.findByText('ブラックバス')).toBeInTheDocument()
    expect(screen.getAllByText('42').length).toBeGreaterThan(0)
    expect(screen.getByText(/球磨川/)).toBeInTheDocument()
    expect(screen.getByText(/こんにちは、釣り人さん/)).toBeInTheDocument()
  })

  it('履歴 0 件で空状態の案内が出る', async () => {
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce([])

    render(<HomePage />)

    expect(await screen.findByText('釣果記録がまだありません')).toBeInTheDocument()
  })

  it('主要リンクが期待するページへ向いている', async () => {
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce([])

    render(<HomePage />)

    await screen.findByText('釣果記録がまだありません')
    expect(screen.getByRole('link', { name: '設定' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: '＋ 釣果を記録' })).toHaveAttribute(
      'href',
      '/sessions/new',
    )
    expect(screen.getByRole('link', { name: /総釣果数/ })).toHaveAttribute('href', '/stats')
  })

  it('読み込み失敗時はエラーバナーを表示する', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(500, '取得失敗'))
    apiFetch.mockResolvedValueOnce([])

    render(<HomePage />)

    expect(await screen.findByText('読み込みに失敗しました: 取得失敗')).toBeInTheDocument()
  })
})
