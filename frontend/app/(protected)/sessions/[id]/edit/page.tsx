'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'
import { FullScreenSpinner } from '@/lib/Loading'
import type { SessionDetail, Spot } from '@/lib/types'

type FormState = {
  spot_id: string
  date: string
  start_time: string
  end_time: string
  water_level: string
  water_clarity: string
  weather: string
  notes: string
}

const empty: FormState = {
  spot_id: '',
  date: '',
  start_time: '',
  end_time: '',
  water_level: '',
  water_clarity: '',
  weather: '',
  notes: '',
}

export default function EditSessionPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [form, setForm] = useState<FormState>(empty)

  useEffect(() => {
    Promise.all([
      apiFetch<SessionDetail>(`/api/sessions/${id}`),
      apiFetch<Spot[]>('/api/spots').catch(() => [] as Spot[]),
    ])
      .then(([s, sp]) => {
        setSpots(sp)
        setForm({
          spot_id: s.spot_id ?? '',
          date: s.date,
          start_time: s.start_time ?? '',
          end_time: s.end_time ?? '',
          water_level: s.water_level ?? '',
          water_clarity: s.water_clarity ?? '',
          weather: s.weather ?? '',
          notes: s.notes ?? '',
        })
      })
      .catch((e: ApiError) => setError(e.detail))
      .finally(() => setLoading(false))
  }, [id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    // 空文字フィールドは送らない (バックエンドが None を捨てて未指定扱いにする)
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))
    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      router.push(`/sessions/${id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '保存に失敗しました')
      setSubmitting(false)
    }
  }

  if (loading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">釣行を編集</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <label htmlFor="session-edit-date" className="block text-sm font-medium text-gray-700 mb-1">日付 *</label>
            <input type="date" id="session-edit-date" name="date" value={form.date} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label htmlFor="session-edit-spot_id" className="block text-sm font-medium text-gray-700 mb-1">ポイント</label>
            <select id="session-edit-spot_id" name="spot_id" value={form.spot_id} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">未設定</option>
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.river_name ? `${s.river_name} / ${s.name}` : s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="session-edit-start_time" className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
              <input type="time" id="session-edit-start_time" name="start_time" value={form.start_time} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="session-edit-end_time" className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
              <input type="time" id="session-edit-end_time" name="end_time" value={form.end_time} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label htmlFor="session-edit-weather" className="block text-sm font-medium text-gray-700 mb-1">天気</label>
            <select id="session-edit-weather" name="weather" value={form.weather} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">未設定</option>
              <option>晴れ</option><option>曇り</option><option>雨</option><option>雪</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="session-edit-water_level" className="block text-sm font-medium text-gray-700 mb-1">水量</label>
              <select id="session-edit-water_level" name="water_level" value={form.water_level} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">未設定</option>
                <option>低水</option><option>平水</option><option>増水</option><option>大増水</option>
              </select>
            </div>
            <div>
              <label htmlFor="session-edit-water_clarity" className="block text-sm font-medium text-gray-700 mb-1">水色</label>
              <select id="session-edit-water_clarity" name="water_clarity" value={form.water_clarity} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">未設定</option>
                <option>クリア</option><option>ステイン</option><option>笹濁り</option><option>濁り</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="session-edit-notes" className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
            <textarea id="session-edit-notes" name="notes" value={form.notes} onChange={handleChange} rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50">
            {submitting ? '保存中...' : '変更を保存'}
          </button>
        </form>
      </main>
    </div>
  )
}
