'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'

export default function NewCatchPage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fish_species: '',
    length_cm: '',
    weight_g: '',
    lure_name: '',
    lure_color: '',
    is_released: 'true',
    notes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const data: any = Object.fromEntries(Object.entries(form).filter(([_, v]) => v !== ''))
    if (data.length_cm) data.length_cm = parseFloat(data.length_cm)
    if (data.weight_g) data.weight_g = parseFloat(data.weight_g)
    data.is_released = form.is_released === 'true'
    await apiFetch(`/api/sessions/${id}/catches`, { method: 'POST', body: JSON.stringify(data) })
    router.push(`/sessions/${id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">釣果追加</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">魚種 *</label>
            <input type="text" name="fish_species" value={form.fish_species} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="アマゴ、ヤマメ、イワナ..." required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">サイズ (cm)</label>
              <input type="number" name="length_cm" value={form.length_cm} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="25.5" step="0.1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">重さ (g)</label>
              <input type="number" name="weight_g" value={form.weight_g} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="200" step="0.1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ルアー名</label>
              <input type="text" name="lure_name" value={form.lure_name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dコンタクト63" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カラー</label>
              <input type="text" name="lure_color" value={form.lure_color} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="チャート" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">リリース / キープ</label>
            <select name="is_released" value={form.is_released} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="true">リリース</option>
              <option value="false">キープ</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ヒットした場所や状況など..." />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50">
            {loading ? '保存中...' : '釣果を保存'}
          </button>
        </form>
      </main>
    </div>
  )
}