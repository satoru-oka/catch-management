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

import NewSessionPage from '@/app/(protected)/sessions/new/page'

beforeEach(() => {
  push.mockReset()
  back.mockReset()
  apiFetch.mockReset()
})

afterEach(() => vi.clearAllMocks())

describe('NewSessionPage', () => {
  it('マウント時にスポット一覧を取得する', async () => {
    apiFetch.mockResolvedValueOnce([
      { id: 'sp1', name: '本流ポイント', river_name: '球磨川' },
    ])
    render(<NewSessionPage />)

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/spots')
    })
    // セレクトオプションに反映されることまで確認
    expect(await screen.findByRole('option', { name: '球磨川 / 本流ポイント' })).toBeInTheDocument()
  })

  it('スポット取得失敗でも UI が落ちず空リストで描画される', async () => {
    apiFetch.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500, detail: 'x' }))
    render(<NewSessionPage />)
    expect(await screen.findByText(/ポイント管理/)).toBeInTheDocument()
  })

  it('日付は今日の YYYY-MM-DD で初期化される', () => {
    apiFetch.mockResolvedValueOnce([])
    render(<NewSessionPage />)
    const today = new Date().toISOString().split('T')[0]
    const dateInput = screen.getByLabelText('日付 *') as HTMLInputElement
    expect(dateInput.value).toBe(today)
  })

  it('保存時に空文字フィールドを除外して POST、成功で / へ遷移', async () => {
    apiFetch.mockResolvedValueOnce([{ id: 'sp1', name: 'A', river_name: null }]) // mount
    apiFetch.mockResolvedValueOnce({ id: 'ses1' }) // save
    render(<NewSessionPage />)
    await screen.findByRole('option', { name: 'A' })
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('ポイント'), 'sp1')
    await user.type(screen.getByLabelText('メモ'), '雨後の良い流れ')
    await user.click(screen.getByRole('button', { name: '釣行を保存' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))

    const [, init] = apiFetch.mock.calls[1]
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    // 空文字は送らない仕様
    expect(body).not.toHaveProperty('start_time')
    expect(body).not.toHaveProperty('weather')
    expect(body.spot_id).toBe('sp1')
    expect(body.notes).toBe('雨後の良い流れ')
    expect(typeof body.date).toBe('string')
  })

  it('保存失敗時は ApiError.detail を表示し画面遷移しない', async () => {
    apiFetch.mockResolvedValueOnce([])
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockRejectedValueOnce(new ApiError(400, '不正な入力'))
    render(<NewSessionPage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '釣行を保存' }))

    expect(await screen.findByText('不正な入力')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '釣行を保存' })).toBeEnabled()
  })

  it('保存中はボタンが "保存中..." で disabled', async () => {
    apiFetch.mockResolvedValueOnce([])
    let resolveSave: (value: unknown) => void = () => {}
    apiFetch.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveSave = r
        }),
    )
    render(<NewSessionPage />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '釣行を保存' }))

    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled()
    resolveSave({ id: 'ses1' })
  })

  it('ヘッダの ← 戻る で router.back を呼ぶ', async () => {
    apiFetch.mockResolvedValueOnce([])
    render(<NewSessionPage />)
    await userEvent.setup().click(screen.getByRole('button', { name: '← 戻る' }))
    expect(back).toHaveBeenCalled()
  })

  it('スポットが空ならポイント管理への誘導が表示される', async () => {
    apiFetch.mockResolvedValueOnce([])
    render(<NewSessionPage />)
    expect(await screen.findByRole('button', { name: 'ポイント管理' })).toBeInTheDocument()
  })
})
