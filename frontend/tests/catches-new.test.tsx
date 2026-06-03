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

import NewCatchPage from '@/app/(protected)/sessions/[id]/catches/new/page'

const lures = [
  {
    id: 'l1',
    user_id: 'u',
    name: 'Dコンタクト63',
    type: 'ミノー',
    color: 'チャート',
    length_mm: 63,
    weight_g: 4.5,
    notes: null,
    created_at: '',
  },
]

beforeEach(() => {
  push.mockReset()
  back.mockReset()
  apiFetch.mockReset()
})

afterEach(() => vi.clearAllMocks())

describe('NewCatchPage', () => {
  it('マウント時に /api/lures を取得しオプションへ反映する', async () => {
    apiFetch.mockResolvedValueOnce(lures)
    render(<NewCatchPage />)

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/lures?limit=200&offset=0'))
    expect(
      await screen.findByRole('option', { name: 'Dコンタクト63 / チャート' }),
    ).toBeInTheDocument()
  })

  it('ルアー選択でルアー名/カラー欄が自動入力される', async () => {
    apiFetch.mockResolvedValueOnce(lures)
    render(<NewCatchPage />)
    await screen.findByRole('option', { name: 'Dコンタクト63 / チャート' })
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(/ルアー \(登録済から選択\)/), 'l1')

    expect((screen.getByLabelText('ルアー名') as HTMLInputElement).value).toBe('Dコンタクト63')
    expect((screen.getByLabelText('カラー') as HTMLInputElement).value).toBe('チャート')
  })

  it('ルアー選択を解除するとルアー名/カラーがクリアされる', async () => {
    apiFetch.mockResolvedValueOnce(lures)
    render(<NewCatchPage />)
    await screen.findByRole('option', { name: 'Dコンタクト63 / チャート' })
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(/ルアー \(登録済から選択\)/), 'l1')
    await user.selectOptions(screen.getByLabelText(/ルアー \(登録済から選択\)/), '')

    expect((screen.getByLabelText('ルアー名') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('カラー') as HTMLInputElement).value).toBe('')
  })

  it('保存時に length_cm/weight_g は数値、is_released は boolean に正規化される', async () => {
    apiFetch.mockResolvedValueOnce(lures)
    apiFetch.mockResolvedValueOnce({ id: 'c1' })
    render(<NewCatchPage />)
    await screen.findByRole('option', { name: 'Dコンタクト63 / チャート' })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('魚種 *'), 'ヤマメ')
    await user.type(screen.getByLabelText('サイズ (cm)'), '22.5')
    await user.type(screen.getByLabelText('重さ (g)'), '120')
    await user.selectOptions(screen.getByLabelText('リリース / キープ'), 'false')
    await user.click(screen.getByRole('button', { name: '釣果を保存' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/sessions/ses1'))
    const [url, init] = apiFetch.mock.calls[1]
    expect(url).toBe('/api/sessions/ses1/catches')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body.fish_species).toBe('ヤマメ')
    expect(body.length_cm).toBe(22.5)
    expect(body.weight_g).toBe(120)
    expect(body.is_released).toBe(false)
    // 空フィールドは送らない
    expect(body).not.toHaveProperty('lure_id')
    expect(body).not.toHaveProperty('notes')
  })

  it('ルアー一覧取得失敗でも UI は表示される', async () => {
    apiFetch.mockRejectedValueOnce(new Error('boom'))
    render(<NewCatchPage />)
    expect(await screen.findByLabelText('魚種 *')).toBeInTheDocument()
  })

  it('保存失敗時はエラー表示し画面遷移しない', async () => {
    const { ApiError } = await import('@/lib/api')
    apiFetch.mockResolvedValueOnce([])
    apiFetch.mockRejectedValueOnce(new ApiError(404, '釣行が見つかりません'))
    render(<NewCatchPage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('魚種 *'), 'ヤマメ')
    await user.click(screen.getByRole('button', { name: '釣果を保存' }))

    expect(await screen.findByText('釣行が見つかりません')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
