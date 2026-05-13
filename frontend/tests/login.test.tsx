import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const signInWithPassword = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
    },
  }),
}))

import LoginPage from '@/app/login/page'

beforeEach(() => {
  push.mockReset()
  signInWithPassword.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

async function fillForm(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('メールアドレス'), email)
  await user.type(screen.getByLabelText('パスワード'), password)
  return user
}

describe('LoginPage', () => {
  it('初期表示でメール/パスワード入力欄とログインボタンが見える', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
  })

  it('成功時に signInWithPassword が呼ばれ "/" に遷移する', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    render(<LoginPage />)
    const user = await fillForm('a@example.com', 'password123')

    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'password123',
    })
    expect(push).toHaveBeenCalledWith('/')
  })

  it('失敗時にエラーメッセージを表示し、画面遷移しない', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'invalid grant' },
    })
    render(<LoginPage />)
    const user = await fillForm('a@example.com', 'wrong')

    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(
      await screen.findByText('メールアドレスまたはパスワードが正しくありません'),
    ).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    // ボタンは押せる状態に戻っている
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeEnabled()
  })

  it('リクエスト中はボタンが "ログイン中..." になり disabled になる', async () => {
    let resolveAuth: (value: { error: null }) => void = () => {}
    signInWithPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAuth = resolve
        }),
    )
    render(<LoginPage />)
    const user = await fillForm('a@example.com', 'password123')

    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    const button = screen.getByRole('button', { name: 'ログイン中...' })
    expect(button).toBeDisabled()

    // 後始末: 解決して await の dangling を防ぐ
    resolveAuth({ error: null })
  })

  it('入力が空のままだと submit 自体が走らない (HTML required)', async () => {
    render(<LoginPage />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(signInWithPassword).not.toHaveBeenCalled()
  })
})
