import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRequiredSupabaseEnv } from '@/lib/supabase-env'

const createSupabaseClient = vi.fn(() => ({ auth: {} }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createSupabaseClient,
}))

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_ANON_KEY = 'test-anon-key'

beforeEach(() => {
  vi.resetModules()
  createSupabaseClient.mockClear()
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY
})

describe('createClient', () => {
  it('Supabase env helper は未設定なら明示的なエラーを投げる', () => {
    expect(() => getRequiredSupabaseEnv({})).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません'
    )
  })

  it('Supabase env helper は設定済みなら url と key を返す', () => {
    expect(
      getRequiredSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      })
    ).toEqual({
      url: SUPABASE_URL,
      key: SUPABASE_ANON_KEY,
    })
  })

  it('env から Supabase client を作り、同じ instance を再利用する', async () => {
    const { createClient } = await import('@/lib/supabase')

    const first = createClient()
    const second = createClient()

    expect(first).toBe(second)
    expect(createSupabaseClient).toHaveBeenCalledTimes(1)
    expect(createSupabaseClient).toHaveBeenCalledWith(SUPABASE_URL, SUPABASE_ANON_KEY)
  })

  it('Supabase env が未設定なら明示的なエラーを投げる', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const { createClient } = await import('@/lib/supabase')

    expect(() => createClient()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません'
    )
    expect(createSupabaseClient).not.toHaveBeenCalled()
  })
})
