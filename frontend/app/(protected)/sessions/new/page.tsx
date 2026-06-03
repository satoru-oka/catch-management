'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'
import { tokyoDateIso } from '@/lib/date'
import { buildFormPayload } from '@/lib/formPayload'
import { fetchAllPages } from '@/lib/pagination'
import {
  EMPTY_SESSION_FORM,
  type SessionFormState,
} from '@/lib/sessionFormConfig'
import type { Spot, Session } from '@/lib/types'

export default function NewSessionPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [form, setForm] = useState<SessionFormState>({
    ...EMPTY_SESSION_FORM,
    date: tokyoDateIso(),
  })

  useEffect(() => {
    fetchAllPages<Spot>('/api/spots', (path) => apiFetch<Spot[]>(path))
      .then(setSpots)
      .catch(() => setSpots([]))
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const data = buildFormPayload(form)
    try {
      await apiFetch<Session>('/api/sessions', { method: 'POST', body: JSON.stringify(data) })
      router.push('/')
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '保存に失敗しました')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">新規釣行</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <label htmlFor="session-new-date" className="block text-sm font-medium text-gray-700 mb-1">日付 *</label>
            <input type="date" id="session-new-date" name="date" value={form.date} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label htmlFor="session-new-spot_id" className="block text-sm font-medium text-gray-700 mb-1">ポイント</label>
            <select id="session-new-spot_id" name="spot_id" value={form.spot_id} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">選択してください</option>
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.river_name ? `${s.river_name} / ${s.name}` : s.name}
                </option>
              ))}
            </select>
            {spots.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                ポイントは <button type="button" onClick={() => router.push('/spots')} className="underline">ポイント管理</button> から追加できます
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="session-new-start_time" className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
              <input type="time" id="session-new-start_time" name="start_time" value={form.start_time} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="session-new-end_time" className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
              <input type="time" id="session-new-end_time" name="end_time" value={form.end_time} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label htmlFor="session-new-weather" className="block text-sm font-medium text-gray-700 mb-1">天気</label>
            <select id="session-new-weather" name="weather" value={form.weather} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">選択してください</option>
              <option>晴れ</option><option>曇り</option><option>雨</option><option>雪</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="session-new-water_level" className="block text-sm font-medium text-gray-700 mb-1">水量</label>
              <select id="session-new-water_level" name="water_level" value={form.water_level} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">選択</option>
                <option>低水</option><option>平水</option><option>増水</option><option>大増水</option>
              </select>
            </div>
            <div>
              <label htmlFor="session-new-water_clarity" className="block text-sm font-medium text-gray-700 mb-1">水色</label>
              <select id="session-new-water_clarity" name="water_clarity" value={form.water_clarity} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">選択</option>
                <option>クリア</option><option>ステイン</option><option>笹濁り</option><option>濁り</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="session-new-notes" className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
            <textarea id="session-new-notes" name="notes" value={form.notes} onChange={handleChange} rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="釣行のメモを入力..." />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50">
            {submitting ? '保存中...' : '釣行を保存'}
          </button>
        </form>
      </main>
    </div>
  )
}
