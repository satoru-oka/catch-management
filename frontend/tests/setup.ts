import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 一部モジュールが import 時に process.env を読むので setup 段階でデフォルトを与える。
process.env.NEXT_PUBLIC_API_URL ??= 'https://api.test.local'
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

afterEach(() => {
  cleanup()
})
