import { describe, expect, it } from 'vitest'
import { getRequiredSupabaseEnv } from '@/lib/supabase-env'

describe('createClient', () => {
  it('Supabase env が未設定なら明示的なエラーを投げる', async () => {
    expect(() => getRequiredSupabaseEnv({})).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません'
    )
  })

  it('Supabase env が設定済みなら url と key を返す', () => {
    expect(
      getRequiredSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      })
    ).toEqual({
      url: 'https://test.supabase.co',
      key: 'test-anon-key',
    })
  })
})
