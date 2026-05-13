import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const back = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back }),
  useParams: () => ({ id: 'ses1' }),
}))

const apiFetch = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) }
})

import SessionDetailPage from '@/app/(protected)/sessions/[id]/page'

const sessionDetail = {
  id: 'ses1',
  user_id: 'u',
  spot_id: 'sp1',
  date: '2026-05-01',
  start_time: '06:30:00',
  end_time: '10:00:00',
  water_level: '平水',
  water_clarity: 'クリア',
  weather: '晴れ',
  notes: '良い流れ',
  created_at: '',
  spots: { name: '本流ポイント', river_name: '球磨川' },
  catches: [
    {
      id: 'c1',
      session_id: 'ses1',
      fish_species: 'ヤマメ',
      length_cm: 22.5,
      weight_g: null,
      lure_id: null,
      lure_name: 'Dコンタクト',
      lure_color: 'チャート',
      caught_at: null,
      is_released: true,
      photo_url: null,
      notes: null,
      created_at: '',
    },
  ],
}

beforeEach(() => {
  push.mockReset()
  back.mockReset()
  apiFetch.mockReset()
})

afterEach(() => vi.clearAllMocks())

describe('SessionDetailPage', () => {
  it('読み込み中は FullScreenSpinner', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    render(<SessionDetailPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('釣行情報・釣果カードを表示する', async () => {
    apiFetch.mockResolvedValueOnce(sessionDetail)
    render(<SessionDetailPage />)

    expect(await screen.findByText('2026-05-01 の釣行')).toBeInTheDocument()
    // 場所・天気・釣果
    expect(screen.getByText(/球磨川/)).toBeInTheDocument()
    expect(screen.getByText('ヤマメ')).toBeInTheDocument()
    expect(screen.getByText('リリース')).toBeInTheDocument()
    // 釣果数表示
    expect(screen.getByText('釣果 (1匹)')).toBeInTheDocument()
  })

  it('釣果が無いときは空状態メッセージ', async () => {
    apiFetch.mockResolvedValueOnce({ ...sessionDetail, catches: [] })
    render(<SessionDetailPage />)
    expect(await screen.findByText('まだ釣果がありません')).toBeInTheDocument()
    expect(screen.getByText('釣果 (0匹)')).toBeInTheDocument()
  })

  it('釣果カードクリックで編集ページへ遷移', async () => {
    apiFetch.mockResolvedValueOnce(sessionDetail)
    render(<SessionDetailPage />)
    await screen.findByText('ヤマメ')
    const user = userEvent.setup()

    await user.click(screen.getByText('ヤマメ'))

    expect(push).toHaveBeenCalledWith('/sessions/ses1/catches/c1/edit')
  })

  it('編集ボタンで編集ページへ遷移', async () => {
    apiFetch.mockResolvedValueOnce(sessionDetail)
    render(<SessionDetailPage />)
    await screen.findByText('2026-05-01 の釣行')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '編集' }))

    expect(push).toHaveBeenCalledWith('/sessions/ses1/edit')
  })

  it('＋ 釣果追加 ボタンで新規追加ページへ遷移', async () => {
    apiFetch.mockResolvedValueOnce(sessionDetail)
    render(<SessionDetailPage />)
    await screen.findByText('2026-05-01 の釣行')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '＋ 釣果追加' }))

    expect(push).toHaveBeenCalledWith('/sessions/ses1/catches/new')
  })

  it('削除: confirm 受諾で DELETE しホームへ', async () => {
    apiFetch.mockResolvedValueOnce(sessionDetail)
    apiFetch.mockResolvedValueOnce(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SessionDetailPage />)
    await screen.findByText('2026-05-01 の釣行')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
    expect(apiFetch).toHaveBeenLastCalledWith('/api/sessions/ses1', { method: 'DELETE' })
    confirmSpy.mockRestore()
  })

  it('削除: confirm キャンセルで API を呼ばない', async () => {
    apiFetch.mockResolvedValueOnce(sessionDetail)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SessionDetailPage />)
    await screen.findByText('2026-05-01 の釣行')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('読み込みエラー時はエラーメッセージのみ表示', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(404, '釣行が見つかりません'))
    render(<SessionDetailPage />)
    expect(await screen.findByText('釣行が見つかりません')).toBeInTheDocument()
    // ヘッダの編集/削除ボタンは出ていない
    expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
  })

  it('スポット情報が無くても落ちずに "場所未設定" を出す', async () => {
    apiFetch.mockResolvedValueOnce({ ...sessionDetail, spots: null })
    render(<SessionDetailPage />)
    expect(await screen.findByText(/場所未設定/)).toBeInTheDocument()
  })
})
