'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch, ApiError } from '@/lib/api'
import { FullScreenSpinner } from '@/lib/Loading'
import type { SessionWithSpot } from '@/lib/types'

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionWithSpot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    apiFetch<SessionWithSpot[]>('/api/sessions')
      .then((data) => setSessions(data))
      .catch((e: ApiError) => setError(e.detail))
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  if (loading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">🎣</span>
          <h1 className="text-xl font-bold text-gray-800">釣果管理</h1>
        </div>
        <nav className="flex items-center gap-3" aria-label="メインナビゲーション">
          <button onClick={() => router.push('/spots')} className="text-sm text-gray-500 hover:text-gray-700" aria-label="ポイント管理ページへ">
            <span aria-hidden="true">📍</span> ポイント
          </button>
          <button onClick={() => router.push('/lures')} className="text-sm text-gray-500 hover:text-gray-700" aria-label="ルアー管理ページへ">
            <span aria-hidden="true">🎣</span> ルアー
          </button>
          <button onClick={() => router.push('/stats')} className="text-sm text-gray-500 hover:text-gray-700" aria-label="統計ページへ">
            <span aria-hidden="true">📊</span> 統計
          </button>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">
            ログアウト
          </button>
        </nav>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-700">釣行履歴</h2>
          <button
            onClick={() => router.push('/sessions/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            ＋ 新規釣行
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            読み込みに失敗しました: {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <div className="text-5xl mb-4" aria-hidden="true">🎣</div>
            <p>釣行記録がまだありません</p>
            <p className="text-sm mt-1">「新規釣行」から記録を始めましょう</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => router.push(`/sessions/${session.id}`)}
                className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{session.date}</span>
                  <span className="text-sm text-gray-400">{session.weather ?? '—'}</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {session.spots?.river_name ?? '場所未設定'} {session.spots?.name ? `/ ${session.spots.name}` : ''}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  水況: {session.water_level ?? '—'} / {session.water_clarity ?? '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
