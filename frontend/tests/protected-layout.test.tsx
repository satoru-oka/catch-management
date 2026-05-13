import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

const getSession = vi.fn()
const onAuthStateChange = vi.fn()
const unsubscribe = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: { getSession, onAuthStateChange },
  }),
}))

import ProtectedLayout from '@/app/(protected)/layout'

beforeEach(() => {
  replace.mockReset()
  getSession.mockReset()
  onAuthStateChange.mockReset()
  unsubscribe.mockReset()
  // デフォルトで onAuthStateChange は subscription オブジェクトを返す
  onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe } },
  })
})

afterEach(() => vi.clearAllMocks())

describe('ProtectedLayout', () => {
  it('セッション確認中は FullScreenSpinner で children を隠す', () => {
    getSession.mockReturnValue(new Promise(() => {})) // 永遠に未解決
    render(
      <ProtectedLayout>
        <div data-testid="child">PROTECTED</div>
      </ProtectedLayout>,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  it('セッションがあれば children を描画する', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } })
    render(
      <ProtectedLayout>
        <div data-testid="child">PROTECTED</div>
      </ProtectedLayout>,
    )

    expect(await screen.findByTestId('child')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('セッションが無ければ /login に置換遷移し children は描画しない', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    render(
      <ProtectedLayout>
        <div data-testid="child">PROTECTED</div>
      </ProtectedLayout>,
    )

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  it('onAuthStateChange でセッションが切れたら /login に遷移する', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } })
    let authCallback: ((event: string, session: unknown) => void) | undefined
    onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe } } }
    })
    render(
      <ProtectedLayout>
        <div data-testid="child">PROTECTED</div>
      </ProtectedLayout>,
    )
    await screen.findByTestId('child')

    // 認証が切れたイベントを発火
    authCallback?.('SIGNED_OUT', null)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })

  it('アンマウント時にサブスクリプションを解除する', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } })
    const { unmount } = render(
      <ProtectedLayout>
        <div data-testid="child">PROTECTED</div>
      </ProtectedLayout>,
    )
    await screen.findByTestId('child')

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('getSession 解決前にアンマウントされても children は出さない (cancelled フラグ)', async () => {
    let resolveSession: (value: { data: { session: unknown } }) => void = () => {}
    getSession.mockImplementation(
      () =>
        new Promise((r) => {
          resolveSession = r
        }),
    )
    const { unmount } = render(
      <ProtectedLayout>
        <div data-testid="child">PROTECTED</div>
      </ProtectedLayout>,
    )
    unmount()
    resolveSession({ data: { session: { user: { id: 'u' } } } })

    // children はそもそもアンマウントされているので存在しないが、
    // 重要なのは「unmount 後の解決で replace('/login') が呼ばれない」こと。
    await new Promise((r) => setTimeout(r, 0))
    expect(replace).not.toHaveBeenCalled()
  })
})
