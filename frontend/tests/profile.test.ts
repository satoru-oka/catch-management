import type { User } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { extractProfile, profileInitial } from '@/lib/profile'

function user(overrides: Partial<User>): User {
  return {
    id: 'u1',
    app_metadata: {},
    aud: 'authenticated',
    created_at: '',
    ...overrides,
  } as User
}

describe('extractProfile', () => {
  it('display_name を優先して avatar_url も取り出す', () => {
    const profile = extractProfile(
      user({
        email: 'satoru@example.com',
        user_metadata: {
          display_name: '釣り太郎',
          full_name: '別名',
          avatar_url: 'https://example.com/avatar.png',
        },
      }),
    )

    expect(profile).toEqual({
      name: '釣り太郎',
      email: 'satoru@example.com',
      avatarUrl: 'https://example.com/avatar.png',
    })
  })

  it('名前 metadata が無ければメールアカウント名に fallback する', () => {
    expect(extractProfile(user({ email: 'angler@example.com', user_metadata: {} })).name).toBe(
      'angler',
    )
  })

  it('ユーザーが無ければゲスト profile を返す', () => {
    expect(extractProfile(null)).toEqual({
      name: 'ゲスト',
      email: null,
      avatarUrl: null,
    })
  })
})

describe('profileInitial', () => {
  it('サロゲートペアを壊さず先頭文字を返す', () => {
    expect(profileInitial('🎣太郎')).toBe('🎣')
  })

  it('空文字なら fallback を返す', () => {
    expect(profileInitial('')).toBe('ゲ')
  })
})
