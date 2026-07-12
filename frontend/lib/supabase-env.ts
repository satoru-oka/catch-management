type SupabaseEnv = Readonly<Record<string, string | undefined>>

export function getRequiredSupabaseEnv(env: SupabaseEnv = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません'
    )
  }

  return { url, key }
}
