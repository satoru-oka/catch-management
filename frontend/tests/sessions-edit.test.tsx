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

import EditSessionPage from '@/app/(protected)/sessions/[id]/edit/page'

const sessionDetail = {
  id: 'ses1',
  user_id: 'u',
  spot_id: 'sp1',
  date: '2026-05-01',
  start_time: '06:30:00',
  end_time: null,
  water_level: '平水',
  water_clarity: null,
  weather: '晴れ',
  notes: '良い流れ',
  created_at: '2026-05-01T00:00:00Z',
  spots: null,
  catches: [],
}

beforeEach(() => {
  push.mockReset()
  back.mockReset()
  apiFetch.mockReset()
})

afterEach(() => vi.clearAllMocks())

describe('EditSessionPage', () => {
  it('読み込み中は FullScreenSpinner を表示する', () => {
    apiFetch.mockReturnValue(new Promise(() => {})) // 永遠に未解決
    render(<EditSessionPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('既存値でフォームを初期化する (null は空文字に変換)', async () => {
    apiFetch.mockResolvedValueOnce(sessionDetail)
    apiFetch.mockResolvedValueOnce([{ id: 'sp1', name: 'A', river_name: null }])
    render(<EditSessionPage />)

    const dateInput = (await screen.findByLabelText('日付 *')) as HTMLInputElement
    expect(dateInput.value).toBe('2026-05-01')
    expect((screen.getByLabelText('開始時間') as HTMLInputElement).value).toBe('06:30:00')
    // 終了時間は null だったので空
    expect((screen.getByLabelText('終了時間') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('天気') as HTMLSelectElement).value).toBe('晴れ')
    expect((screen.getByLabelText('メモ') as HTMLTextAreaElement).value).toBe('良い流れ')
  })

  it('変更を保存で空文字を除いて PUT し、詳細ページへ遷移する', async () => {
    apiFetch.mockResolvedValueOnce(sessionDetail)
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockResolvedValueOnce(undefined) // PUT
    render(<EditSessionPage />)
    await screen.findByLabelText('日付 *')
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('メモ'))
    await user.type(screen.getByLabelText('メモ'), '更新メモ')
    await user.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/sessions/ses1'))
    const [url, init] = apiFetch.mock.calls[2]
    expect(url).toBe('/api/sessions/ses1')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    expect(body.notes).toBe('更新メモ')
    // null → 空文字 → 除外なので end_time/water_clarity は送られない
    expect(body).not.toHaveProperty('end_time')
    expect(body).not.toHaveProperty('water_clarity')
  })

  it('読み込み失敗時はエラーメッセージを表示する', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(404, '見つかりません'))
    apiFetch.mockResolvedValueOnce([]) // 並行で走るスポット取得
    render(<EditSessionPage />)
    expect(await screen.findByText('見つかりません')).toBeInTheDocument()
  })

  it('保存失敗時はエラーメッセージを表示し遷移しない', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockResolvedValueOnce(sessionDetail)
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockRejectedValueOnce(new ApiError(400, '入力エラー'))
    render(<EditSessionPage />)
    await screen.findByLabelText('日付 *')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText('入力エラー')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
