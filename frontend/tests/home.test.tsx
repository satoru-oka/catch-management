import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const session = {
  id: 'ses1',
  user_id: 'u',
  spot_id: 'sp1',
  date: today,
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
  id: 'catch1',
  session_id: 'ses1',
  fish_species: 'ヤマメ',
  length_cm: 25,
  weight_g: 500,
  lure_id: null,
  lure_name: 'D-コンタクト',
  lure_color: 'アユ',
  caught_at: `${today}T08:30:00.000Z`,
  is_released: true,
  photo_url: null,
  notes: null,
  created_at: '',
  sessions: { date: today, spot_id: 'sp1' },
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

describe('HomePage', () => {
  it('読み込み中は FullScreenSpinner', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    getUser.mockReturnValue(new Promise(() => {}))

    render(<HomePage />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('釣果と釣行を取得してダッシュボードを表示する', async () => {
    apiFetch.mockResolvedValueOnce([catchRecord])
    apiFetch.mockResolvedValueOnce([session])

    render(<HomePage />)

    expect(await screen.findByText('こんにちは、釣り太郎さん！')).toBeInTheDocument()
    expect(screen.getByText('最近の釣果')).toBeInTheDocument()
    expect(screen.getByText('ヤマメ')).toBeInTheDocument()
    expect(screen.getByText(/球磨川/)).toBeInTheDocument()

    await waitFor(() => {
      expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/catches')
      expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/sessions')
      expect(getUser).toHaveBeenCalled()
    })
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
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce([])

    render(<HomePage />)

    expect(await screen.findByText('こんにちは、anglerさん！')).toBeInTheDocument()
  })

  it('釣果 0 件で空状態の案内が出る', async () => {
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce([])

    render(<HomePage />)

    expect(await screen.findByText('釣果記録がまだありません')).toBeInTheDocument()
  })

  it('読み込み失敗時はエラーバナーを表示する', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(500, '取得失敗'))
    apiFetch.mockResolvedValueOnce([])

    render(<HomePage />)

    expect(await screen.findByText('読み込みに失敗しました: 取得失敗')).toBeInTheDocument()
  })
})
