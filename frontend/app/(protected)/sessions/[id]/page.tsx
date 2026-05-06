'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'
import { FullScreenSpinner } from '@/lib/Loading'
import type { SessionDetail } from '@/lib/types'

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<SessionDetail>(`/api/sessions/${id}`)
      .then(setSession)
      .catch((e: ApiError) => setError(e.detail))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!confirm('この釣行を削除しますか? (釣果もすべて削除されます)')) return
    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
      router.push('/')
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : '削除に失敗しました')
    }
  }

  if (loading) return <FullScreenSpinner />
  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 text-sm">{error ?? '釣行が見つかりません'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800 flex-1">{session.date} の釣行</h1>
        <button
          onClick={() => router.push(`/sessions/${id}/edit`)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >編集</button>
        <button
          onClick={handleDelete}
          className="text-sm text-red-500 hover:text-red-700"
        >削除</button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-3">釣行情報</h2>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div>📍 {session.spots?.river_name ?? '場所未設定'} {session.spots?.name ? `/ ${session.spots.name}` : ''}</div>
            <div>🌤 {session.weather ?? '—'}</div>
            <div>💧 水量: {session.water_level ?? '—'}</div>
            <div>🌊 水色: {session.water_clarity ?? '—'}</div>
            {session.start_time && <div>⏰ {session.start_time} 〜 {session.end_time ?? '—'}</div>}
          </div>
          {session.notes && <p className="text-sm text-gray-500 mt-3 border-t pt-3">{session.notes}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-700">釣果 ({session.catches?.length ?? 0}匹)</h2>
            <button
              onClick={() => router.push(`/sessions/${id}/catches/new`)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
            >
              ＋ 釣果追加
            </button>
          </div>

          {session.catches?.length === 0 ? (
            <div className="text-center text-gray-400 py-10 bg-white rounded-xl shadow-sm">
              <div className="text-4xl mb-2" aria-hidden="true">🐟</div>
              <p className="text-sm">まだ釣果がありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {session.catches?.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/sessions/${id}/catches/${c.id}/edit`)}
                  className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{c.fish_species}</span>
                    <span className="text-sm text-gray-400">{c.is_released ? 'リリース' : 'キープ'}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {c.length_cm && `${c.length_cm}cm`}{c.weight_g && ` / ${c.weight_g}g`}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    🎣 {c.lure_name ?? '—'} {c.lure_color ? `/ ${c.lure_color}` : ''}
                  </div>
                  {c.notes && <p className="text-sm text-gray-400 mt-1">{c.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
