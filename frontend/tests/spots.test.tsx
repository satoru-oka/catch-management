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

  it('50 件取得した場合はもっと読み込むボタンで次ページを追加する', async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) => ({
      ...baseSpot,
      id: `sp${i}`,
      name: `ポイント${i}`,
    }))
    apiFetch.mockResolvedValueOnce(firstPage)
    apiFetch.mockResolvedValueOnce([{ ...baseSpot, id: 'sp51', name: '追加ポイント' }])
    render(<SpotsPage />)
    await screen.findByText('ポイント0')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'もっと読み込む' }))

    await waitFor(() => {
      expect(apiFetch).toHaveBeenLastCalledWith('/api/spots?limit=50&offset=50')
    })
    expect(await screen.findByText('追加ポイント')).toBeInTheDocument()
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

  it('編集時は nullable な既存値を null にクリアできる', async () => {
    apiFetch.mockResolvedValueOnce([baseSpot])
    apiFetch.mockResolvedValueOnce({ ...baseSpot, river_name: null, latitude: null, notes: null })
    apiFetch.mockResolvedValueOnce([{ ...baseSpot, river_name: null, latitude: null, notes: null }])
    render(<SpotsPage />)
    await screen.findByText('本流ポイント')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '編集' }))
    await user.clear(screen.getByLabelText('川の名前'))
    await user.clear(screen.getByLabelText('緯度'))
    await user.clear(screen.getByLabelText('メモ'))
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      const [url, init] = apiFetch.mock.calls[1]
      expect(url).toBe('/api/spots/sp1')
      expect(init.method).toBe('PUT')
      const body = JSON.parse(init.body)
      expect(body.river_name).toBeNull()
      expect(body.latitude).toBeNull()
      expect(body.notes).toBeNull()
    })
  })

  it('削除後の もっと読み込む は削除前の総取得件数を offset として使う', async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) => ({
      ...baseSpot,
      id: `sp${i}`,
      name: `ポイント${i}`,
    }))
    apiFetch.mockResolvedValueOnce(firstPage) // 初期 list
    apiFetch.mockResolvedValueOnce(undefined) // DELETE
    apiFetch.mockResolvedValueOnce([{ ...baseSpot, id: 'sp50', name: '次ページ先頭' }])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SpotsPage />)
    await screen.findByText('ポイント0')
    const user = userEvent.setup()

    const deleteButtons = screen.getAllByRole('button', { name: '削除' })
    await user.click(deleteButtons[0])
    await waitFor(() =>
      expect(screen.queryByText('ポイント0')).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'もっと読み込む' }))

    // 削除で items.length=49 になっても offset=50 を使うこと (重複行防止)
    await waitFor(() => {
      expect(apiFetch).toHaveBeenLastCalledWith('/api/spots?limit=50&offset=50')
    })
    expect(await screen.findByText('次ページ先頭')).toBeInTheDocument()
    confirmSpy.mockRestore()
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
