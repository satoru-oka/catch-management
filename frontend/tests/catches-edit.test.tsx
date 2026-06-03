import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const back = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back }),
  useParams: () => ({ id: 'ses1', catchId: 'c1' }),
}))

const apiFetch = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) }
})

import EditCatchPage from '@/app/(protected)/sessions/[id]/catches/[catchId]/edit/page'

const catchData = {
  id: 'c1',
  session_id: 'ses1',
  fish_species: 'ヤマメ',
  length_cm: 22.5,
  weight_g: null,
  lure_id: null,
  lure_name: 'スプーン',
  lure_color: '赤金',
  caught_at: null,
  is_released: false,
  photo_url: null,
  notes: '良型',
  created_at: '',
}

beforeEach(() => {
  push.mockReset()
  back.mockReset()
  apiFetch.mockReset()
})

afterEach(() => vi.clearAllMocks())

describe('EditCatchPage', () => {
  it('読み込み中は FullScreenSpinner を表示する', () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    render(<EditCatchPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('既存の値でフォームを初期化する (length_cm は数値→文字列、null は空)', async () => {
    apiFetch.mockResolvedValueOnce(catchData)
    apiFetch.mockResolvedValueOnce([])
    render(<EditCatchPage />)

    expect((await screen.findByLabelText('魚種 *')) as HTMLInputElement).toHaveValue('ヤマメ')
    expect((screen.getByLabelText('サイズ (cm)') as HTMLInputElement).value).toBe('22.5')
    // weight_g は null だったので空
    expect((screen.getByLabelText('重さ (g)') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('リリース / キープ') as HTMLSelectElement).value).toBe('false')
  })

  it('変更を保存で PUT し、詳細ページへ戻る', async () => {
    apiFetch.mockResolvedValueOnce(catchData)
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce(undefined) // PUT
    render(<EditCatchPage />)
    await screen.findByLabelText('魚種 *')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('重さ (g)'), '180')
    await user.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/sessions/ses1'))
    const [url, init] = apiFetch.mock.calls[2]
    expect(url).toBe('/api/catches/c1')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    expect(body.length_cm).toBe(22.5)
    expect(body.weight_g).toBe(180)
    expect(body.is_released).toBe(false)
  })

  it('nullable な既存値を UI からクリアできる', async () => {
    apiFetch.mockResolvedValueOnce(catchData)
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce(undefined)
    render(<EditCatchPage />)
    await screen.findByLabelText('魚種 *')
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('サイズ (cm)'))
    await user.clear(screen.getByLabelText('ルアー名'))
    await user.clear(screen.getByLabelText('カラー'))
    await user.clear(screen.getByLabelText('メモ'))
    await user.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/sessions/ses1'))
    const [, init] = apiFetch.mock.calls[2]
    const body = JSON.parse(init.body)
    expect(body.length_cm).toBeNull()
    expect(body.weight_g).toBeNull()
    expect(body.lure_id).toBeNull()
    expect(body.lure_name).toBeNull()
    expect(body.lure_color).toBeNull()
    expect(body.notes).toBeNull()
  })

  it('削除ボタン: confirm 受諾で DELETE し詳細ページへ戻る', async () => {
    apiFetch.mockResolvedValueOnce(catchData)
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce(undefined) // DELETE
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<EditCatchPage />)
    await screen.findByLabelText('魚種 *')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/sessions/ses1'))
    expect(apiFetch).toHaveBeenLastCalledWith('/api/catches/c1', { method: 'DELETE' })
    confirmSpy.mockRestore()
  })

  it('削除ボタン: confirm キャンセルで API 呼び出しなし', async () => {
    apiFetch.mockResolvedValueOnce(catchData)
    apiFetch.mockResolvedValueOnce([])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<EditCatchPage />)
    await screen.findByLabelText('魚種 *')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(push).not.toHaveBeenCalled()
    expect(apiFetch).toHaveBeenCalledTimes(2) // 初期 fetch のみ
    confirmSpy.mockRestore()
  })

  it('削除エラー時は alert に detail が出る', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockResolvedValueOnce(catchData)
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockRejectedValueOnce(new ApiError(500, '削除失敗'))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<EditCatchPage />)
    await screen.findByLabelText('魚種 *')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('削除失敗'))
    confirmSpy.mockRestore()
    alertSpy.mockRestore()
  })
})
