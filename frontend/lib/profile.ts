import type { User } from '@supabase/supabase-js'

export type Profile = {
  name: string
  email: string | null
  avatarUrl: string | null
}

export function extractProfile(user: User | null): Profile {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (typeof meta.display_name === 'string' && meta.display_name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    user?.email?.split('@')[0] ||
    'ゲスト'
  const avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : null

  return {
    name,
    email: user?.email ?? null,
    avatarUrl,
  }
}

export function profileInitial(name: string): string {
  return [...name][0] ?? 'ゲ'
}
