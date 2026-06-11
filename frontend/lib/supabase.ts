import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getRequiredSupabaseEnv } from './supabase-env'

let client: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (!client) {
    const { url, key } = getRequiredSupabaseEnv()

    client = createSupabaseClient(url, key)
  }
  return client
}
