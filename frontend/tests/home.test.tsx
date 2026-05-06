import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const apiFetch = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) }
})

const signOut = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { signOut } }),
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

beforeEach(() => {
  push.mockReset()
  apiFetch.mockReset()
  signOut.mockClear()
  signOut.mockResolvedValue(undefined)
})

afterEach(() => vi.clearAllMocks())

describe('HomePage', () => {
  it('読み込み中は FullScreenSpinner', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    render(<HomePage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('釣行履歴をカードとして表示する', async () => {
    apiFetch.mockResolvedValueOnce([session])
    render(<HomePage />)
    expect(await screen.findByText('2026-05-01')).toBeInTheDocument()
    expect(screen.getByText(/球磨川/)).toBeInTheDocument()
  })

  it('履歴 0 件で空状態の案内が出る', async () => {
    apiFetch.mockResolvedValueOnce([])
    render(<HomePage />)
    expect(await screen.findByText('釣行記録がまだありません')).toBeInTheDocument()
  })

  it('カードクリックで詳細ページへ遷移', async () => {
    apiFetch.mockResolvedValueOnce([session])
    render(<HomePage />)
    await screen.findByText('2026-05-01')
    const user = userEvent.setup()

    await user.click(screen.getByText('2026-05-01'))

    expect(push).toHaveBeenCalledWith('/sessions/ses1')
  })

  it('ナビゲーション: ポイント / ルアー / 統計 / 新規釣行', async () => {
    apiFetch.mockResolvedValueOnce([])
    render(<HomePage />)
    await screen.findByText('釣行履歴')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'ポイント管理ページへ' }))
    expect(push).toHaveBeenLastCalledWith('/spots')
    await user.click(screen.getByRole('button', { name: 'ルアー管理ページへ' }))
    expect(push).toHaveBeenLastCalledWith('/lures')
    await user.click(screen.getByRole('button', { name: '統計ページへ' }))
    expect(push).toHaveBeenLastCalledWith('/stats')
    await user.click(screen.getByRole('button', { name: '＋ 新規釣行' }))
    expect(push).toHaveBeenLastCalledWith('/sessions/new')
  })

  it('ログアウトで signOut が呼ばれ /login に遷移', async () => {
    apiFetch.mockResolvedValueOnce([])
    render(<HomePage />)
    await screen.findByText('釣行履歴')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'ログアウト' }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
    expect(push).toHaveBeenCalledWith('/login')
  })

  it('読み込み失敗時はエラーバナーを表示する', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(500, '取得失敗'))
    render(<HomePage />)
    expect(await screen.findByText('読み込みに失敗しました: 取得失敗')).toBeInTheDocument()
  })
})
