'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'
import { buildFormPayload } from '@/lib/formPayload'
import { FullScreenSpinner } from '@/lib/Loading'
import type { Spot } from '@/lib/types'

type FormState = {
  name: string
  river_name: string
  latitude: string
  longitude: string
  notes: string
}

const emptyForm: FormState = { name: '', river_name: '', latitude: '', longitude: '', notes: '' }
const nullableFields = ['river_name', 'latitude', 'longitude', 'notes']
const numberFields = ['latitude', 'longitude']

const fromSpot = (s: Spot): FormState => ({
  name: s.name,
  river_name: s.river_name ?? '',
  latitude: s.latitude?.toString() ?? '',
  longitude: s.longitude?.toString() ?? '',
  notes: s.notes ?? '',
})

const toPayload = (f: FormState, nullEmpty = false) =>
  buildFormPayload(f, {
    nullableFields: nullEmpty ? nullableFields : [],
    numberFields,
  })

export default function SpotsPage() {
  const router = useRouter()
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const reload = () =>
    apiFetch<Spot[]>('/api/spots')
      .then(setSpots)
      .catch((e: ApiError) => setError(e.detail))

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const startEdit = (s: Spot) => {
    setEditingId(s.id)
    setForm(fromSpot(s))
    setShowForm(true)
  }

  const cancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await apiFetch<Spot>(`/api/spots/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(toPayload(form, true)),
        })
      } else {
        await apiFetch<Spot>('/api/spots', {
          method: 'POST',
          body: JSON.stringify(toPayload(form)),
        })
      }
      cancel()
      await reload()
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : '保存に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このポイントを削除しますか?')) return
    try {
      await apiFetch(`/api/spots/${id}`, { method: 'DELETE' })
      setSpots(spots.filter((s) => s.id !== id))
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : '削除に失敗しました')
    }
  }

  if (loading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">ポイント管理</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={showForm ? cancel : startCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            {showForm ? 'キャンセル' : '＋ ポイント追加'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-700">{editingId ? '編集' : '新規追加'}</h2>
            <div>
              <label htmlFor="spot-form-name" className="block text-sm font-medium text-gray-700 mb-1">ポイント名 *</label>
              <input type="text" id="spot-form-name" name="name" value={form.name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="上流の淵" required />
            </div>
            <div>
              <label htmlFor="spot-form-river_name" className="block text-sm font-medium text-gray-700 mb-1">川の名前</label>
              <input type="text" id="spot-form-river_name" name="river_name" value={form.river_name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="○○川" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="spot-form-latitude" className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                <input type="number" id="spot-form-latitude" name="latitude" value={form.latitude} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="35.681" step="any" />
              </div>
              <div>
                <label htmlFor="spot-form-longitude" className="block text-sm font-medium text-gray-700 mb-1">経度</label>
                <input type="number" id="spot-form-longitude" name="longitude" value={form.longitude} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="139.767" step="any" />
              </div>
            </div>
            <div>
              <label htmlFor="spot-form-notes" className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea id="spot-form-notes" name="notes" value={form.notes} onChange={handleChange} rows={2}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ポイントの特徴など..." />
            </div>
            <button type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm">
              保存
            </button>
          </form>
        )}

        {spots.length === 0 ? (
          <div className="text-center text-gray-400 py-16 bg-white rounded-xl shadow-sm">
            <div className="text-5xl mb-4" aria-hidden="true">📍</div>
            <p>ポイントがまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {spots.map((spot) => (
              <div key={spot.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-800">{spot.name}</div>
                    <div className="text-sm text-gray-500 mt-1">{spot.river_name ?? '川名未設定'}</div>
                    {spot.latitude && (
                      <div className="text-xs text-gray-400 mt-1">
                        {spot.latitude}, {spot.longitude}
                      </div>
                    )}
                    {spot.notes && <p className="text-sm text-gray-400 mt-2">{spot.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1 ml-4 text-sm">
                    <button onClick={() => startEdit(spot)} className="text-gray-500 hover:text-gray-700">編集</button>
                    <button onClick={() => handleDelete(spot.id)} className="text-red-400 hover:text-red-600">削除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
