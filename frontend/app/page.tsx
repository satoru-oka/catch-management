'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'

export default function HomePage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/login')
        return
      }
      const data2 = await apiFetch('/api/sessions')
      setSessions(data2)
      setLoading(false)
    }
    init()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎣</span>
          <h1 className="text-xl font-bold text-gray-800">釣果管理</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/spots')} className="text-sm text-gray-500 hover:text-gray-700">
            📍 ポイント
          </button>
          <button onClick={() => router.push('/lures')} className="text-sm text-gray-500 hover:text-gray-700">
            🎣 ルアー
          </button>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">
            ログアウト
          </button>
        </div>
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

        {sessions.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <div className="text-5xl mb-4">🎣</div>
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