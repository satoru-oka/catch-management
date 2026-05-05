'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

export default function SpotsPage() {
  const router = useRouter()
  const [spots, setSpots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    river_name: '',
    latitude: '',
    longitude: '',
    notes: '',
  })

  useEffect(() => {
    apiFetch('/api/spots').then((data) => {
      setSpots(data)
      setLoading(false)
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data: any = Object.fromEntries(Object.entries(form).filter(([_, v]) => v !== ''))
    if (data.latitude) data.latitude = parseFloat(data.latitude)
    if (data.longitude) data.longitude = parseFloat(data.longitude)
    const newSpot = await apiFetch('/api/spots', { method: 'POST', body: JSON.stringify(data) })
    setSpots([...spots, newSpot])
    setShowForm(false)
    setForm({ name: '', river_name: '', latitude: '', longitude: '', notes: '' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このポイントを削除しますか？')) return
    await apiFetch(`/api/spots/${id}`, { method: 'DELETE' })
    setSpots(spots.filter((s) => s.id !== id))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">ポイント管理</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            {showForm ? 'キャンセル' : '＋ ポイント追加'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ポイント名 *</label>
              <input type="text" name="name" value={form.name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="上流の淵" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">川の名前</label>
              <input type="text" name="river_name" value={form.river_name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="○○川" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                <input type="number" name="latitude" value={form.latitude} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="35.681" step="any" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">経度</label>
                <input type="number" name="longitude" value={form.longitude} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="139.767" step="any" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
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
            <div className="text-5xl mb-4">📍</div>
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
                  <button
                    onClick={() => handleDelete(spot.id)}
                    className="text-red-400 hover:text-red-600 text-sm ml-4"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}