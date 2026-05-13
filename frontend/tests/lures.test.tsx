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

import LuresPage from '@/app/(protected)/lures/page'

const baseLure = {
  id: 'l1',
  user_id: 'u',
  name: 'Dコンタクト63',
  type: 'ミノー',
  color: 'チャート',
  length_mm: 63,
  weight_g: 4.5,
  notes: '春先に強い',
  created_at: '',
}

beforeEach(() => {
  push.mockReset()
  back.mockReset()
  apiFetch.mockReset()
})

afterEach(() => vi.clearAllMocks())

describe('LuresPage', () => {
  it('読み込み中は FullScreenSpinner を表示', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    render(<LuresPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('ルアー一覧をカード表示する', async () => {
    apiFetch.mockResolvedValueOnce([baseLure])
    render(<LuresPage />)
    expect(await screen.findByText('Dコンタクト63')).toBeInTheDocument()
  })

  it('空配列なら "ルアーがまだありません" が出る', async () => {
    apiFetch.mockResolvedValueOnce([])
    render(<LuresPage />)
    expect(await screen.findByText('ルアーがまだありません')).toBeInTheDocument()
  })

  it('追加 → POST → reload の流れで length_mm/weight_g が数値化される', async () => {
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce({ id: 'l2' })
    apiFetch.mockResolvedValueOnce([{ ...baseLure, id: 'l2', name: '新ルアー' }])
    render(<LuresPage />)
    await screen.findByText('ルアーがまだありません')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '＋ ルアー追加' }))
    await user.type(screen.getByLabelText('ルアー名 *'), '新ルアー')
    await user.selectOptions(screen.getByLabelText('種別'), 'スプーン')
    await user.type(screen.getByLabelText('長さ (mm)'), '50')
    await user.type(screen.getByLabelText('重さ (g)'), '3.5')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
    const [url, init] = apiFetch.mock.calls[1]
    expect(url).toBe('/api/lures')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body.name).toBe('新ルアー')
    expect(body.type).toBe('スプーン')
    expect(body.length_mm).toBe(50)
    expect(body.weight_g).toBe(3.5)
    expect(body).not.toHaveProperty('color')
    expect(body).not.toHaveProperty('notes')
  })

  it('編集ボタンで既存値が入ったフォームを開き PUT する', async () => {
    apiFetch.mockResolvedValueOnce([baseLure])
    apiFetch.mockResolvedValueOnce({ ...baseLure })
    apiFetch.mockResolvedValueOnce([baseLure])
    render(<LuresPage />)
    await screen.findByText('Dコンタクト63')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '編集' }))
    const colorInput = screen.getByLabelText('カラー') as HTMLInputElement
    expect(colorInput.value).toBe('チャート')
    await user.clear(colorInput)
    await user.type(colorInput, 'ピンク')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      const [url, init] = apiFetch.mock.calls[1]
      expect(url).toBe('/api/lures/l1')
      expect(init.method).toBe('PUT')
      const body = JSON.parse(init.body)
      expect(body.color).toBe('ピンク')
    })
  })

  it('削除ボタン: confirm 受諾で DELETE され UI から消える', async () => {
    apiFetch.mockResolvedValueOnce([baseLure])
    apiFetch.mockResolvedValueOnce(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LuresPage />)
    await screen.findByText('Dコンタクト63')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect(apiFetch).toHaveBeenLastCalledWith('/api/lures/l1', { method: 'DELETE' })
    })
    await waitFor(() =>
      expect(screen.queryByText('Dコンタクト63')).not.toBeInTheDocument(),
    )
    confirmSpy.mockRestore()
  })

  it('保存に失敗すると alert が出てフォームは開いたまま', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockRejectedValueOnce(new ApiError(400, '名前必須'))
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<LuresPage />)
    await screen.findByText('ルアーがまだありません')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '＋ ルアー追加' }))
    await user.type(screen.getByLabelText('ルアー名 *'), 'X')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('名前必須'))
    expect(screen.getByLabelText('ルアー名 *')).toBeInTheDocument()
    alertSpy.mockRestore()
  })

  it('一覧取得失敗時はエラーバナー表示', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(500, '一覧取得失敗'))
    render(<LuresPage />)
    expect(await screen.findByText('一覧取得失敗')).toBeInTheDocument()
  })
})
