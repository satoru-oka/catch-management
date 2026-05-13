'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { FullScreenSpinner } from '@/lib/Loading'

type Profile = {
  name: string
  email: string
  avatarUrl: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user
        if (!u) return
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>
        const name =
          (typeof meta.display_name === 'string' && meta.display_name) ||
          (typeof meta.full_name === 'string' && meta.full_name) ||
          u.email?.split('@')[0] ||
          'ゲスト'
        const avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : null
        setProfile({ name, email: u.email ?? '', avatarUrl })
      })
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  if (!profile) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="bg-gradient-to-br from-sky-400 to-blue-500 text-white px-6 pt-8 pb-10 rounded-b-3xl shadow-md">
        <h1 className="text-2xl font-bold">設定</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-6 space-y-4">
        <section className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover border-2 border-sky-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-sky-100 text-sky-500 flex items-center justify-center text-2xl font-bold">
              {profile.name[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-gray-800 truncate">{profile.name}</div>
            <div className="text-xs text-gray-500 truncate">{profile.email}</div>
          </div>
          <button
            className="text-xs text-sky-600 border border-sky-200 rounded-full px-3 py-1 opacity-60 cursor-not-allowed"
            disabled
            aria-label="プロフィール編集 (準備中)"
          >
            編集
          </button>
        </section>

        <section className="bg-white rounded-2xl shadow-md overflow-hidden">
          <Link
            href="/lures"
            className="flex items-center justify-between px-5 py-4 hover:bg-sky-50"
          >
            <span className="flex items-center gap-3 text-gray-800">
              <span className="text-xl" aria-hidden="true">🎣</span>
              ルアー管理
            </span>
            <span className="text-gray-300">›</span>
          </Link>
        </section>

        <section className="bg-white rounded-2xl shadow-md overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-red-50"
          >
            <span className="flex items-center gap-3 text-red-600">
              <span className="text-xl" aria-hidden="true">↩️</span>
              ログアウト
            </span>
            <span className="text-gray-300">›</span>
          </button>
        </section>
      </main>
    </div>
  )
}
