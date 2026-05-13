import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const back = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back }),
}))

const apiFetch = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) }
})

import SpotsPage from '@/app/(protected)/spots/page'

const baseSpot = {
  id: 'sp1',
  user_id: 'u',
  name: '本流ポイント',
  river_name: '球磨川',
  latitude: 32.5,
  longitude: 130.5,
  notes: 'ヤマメよく出る',
  created_at: '',
}

beforeEach(() => {
  push.mockReset()
  back.mockReset()
  apiFetch.mockReset()
})

afterEach(() => vi.clearAllMocks())

describe('SpotsPage', () => {
  it('読み込み中は FullScreenSpinner を表示', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    render(<SpotsPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('スポットがあればカード表示、なければ空状態を表示', async () => {
    apiFetch.mockResolvedValueOnce([baseSpot])
    render(<SpotsPage />)
    expect(await screen.findByText('本流ポイント')).toBeInTheDocument()
    expect(screen.getByText('球磨川')).toBeInTheDocument()
  })

  it('空配列なら "ポイントがまだありません" が出る', async () => {
    apiFetch.mockResolvedValueOnce([])
    render(<SpotsPage />)
    expect(await screen.findByText('ポイントがまだありません')).toBeInTheDocument()
  })

  it('追加ボタンでフォーム表示、必要なフィールドを送信して reload する', async () => {
    apiFetch.mockResolvedValueOnce([]) // 初期 list
    apiFetch.mockResolvedValueOnce({ id: 'sp2' }) // POST
    apiFetch.mockResolvedValueOnce([{ ...baseSpot, id: 'sp2', name: '新ポイント' }]) // reload
    render(<SpotsPage />)
    await screen.findByText('ポイントがまだありません')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '＋ ポイント追加' }))
    await user.type(screen.getByLabelText('ポイント名 *'), '新ポイント')
    await user.type(screen.getByLabelText('緯度'), '32.5')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
    const [url, init] = apiFetch.mock.calls[1]
    expect(url).toBe('/api/spots')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body.name).toBe('新ポイント')
    expect(body.latitude).toBe(32.5)
    expect(body).not.toHaveProperty('longitude') // 空文字は除外
    // 保存後にリロード結果が表示される
    expect(await screen.findByText('新ポイント')).toBeInTheDocument()
  })

  it('編集ボタンで既存値が入ったフォームが開き、PUT が走る', async () => {
    apiFetch.mockResolvedValueOnce([baseSpot])
    apiFetch.mockResolvedValueOnce({ ...baseSpot, name: '更新名' })
    apiFetch.mockResolvedValueOnce([{ ...baseSpot, name: '更新名' }])
    render(<SpotsPage />)
    await screen.findByText('本流ポイント')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '編集' }))
    const nameInput = screen.getByLabelText('ポイント名 *') as HTMLInputElement
    expect(nameInput.value).toBe('本流ポイント')
    await user.clear(nameInput)
    await user.type(nameInput, '更新名')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      const [url, init] = apiFetch.mock.calls[1]
      expect(url).toBe('/api/spots/sp1')
      expect(init.method).toBe('PUT')
    })
  })

  it('削除ボタン: confirm 受諾で DELETE、UI から消える', async () => {
    apiFetch.mockResolvedValueOnce([baseSpot])
    apiFetch.mockResolvedValueOnce(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SpotsPage />)
    await screen.findByText('本流ポイント')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect(apiFetch).toHaveBeenLastCalledWith('/api/spots/sp1', { method: 'DELETE' })
    })
    await waitFor(() =>
      expect(screen.queryByText('本流ポイント')).not.toBeInTheDocument(),
    )
    confirmSpy.mockRestore()
  })

  it('一覧取得失敗時はエラーバナーを表示', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(500, '取得失敗'))
    render(<SpotsPage />)
    expect(await screen.findByText('取得失敗')).toBeInTheDocument()
  })

  it('キャンセルボタンでフォームが閉じる', async () => {
    apiFetch.mockResolvedValueOnce([])
    render(<SpotsPage />)
    await screen.findByText('ポイントがまだありません')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '＋ ポイント追加' }))
    expect(screen.getByLabelText('ポイント名 *')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.queryByLabelText('ポイント名 *')).not.toBeInTheDocument()
  })
})
