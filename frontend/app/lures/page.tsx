'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

export default function LuresPage() {
  const router = useRouter()
  const [lures, setLures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: '',
    color: '',
    length_mm: '',
    weight_g: '',
    notes: '',
  })

  useEffect(() => {
    apiFetch('/api/lures').then((data) => {
      setLures(data)
      setLoading(false)
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data: any = Object.fromEntries(Object.entries(form).filter(([_, v]) => v !== ''))
    if (data.length_mm) data.length_mm = parseFloat(data.length_mm)
    if (data.weight_g) data.weight_g = parseFloat(data.weight_g)
    const newLure = await apiFetch('/api/lures', { method: 'POST', body: JSON.stringify(data) })
    setLures([...lures, newLure])
    setShowForm(false)
    setForm({ name: '', type: '', color: '', length_mm: '', weight_g: '', notes: '' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このルアーを削除しますか？')) return
    await apiFetch(`/api/lures/${id}`, { method: 'DELETE' })
    setLures(lures.filter((l) => l.id !== id))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">ルアー管理</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            {showForm ? 'キャンセル' : '＋ ルアー追加'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ルアー名 *</label>
              <input type="text" name="name" value={form.name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dコンタクト63" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                <select name="type" value={form.type} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">選択</option>
                  <option>ミノー</option><option>スプーン</option><option>スピナー</option>
                  <option>クランク</option><option>その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カラー</label>
                <input type="text" name="color" value={form.color} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="チャート" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">長さ (mm)</label>
                <input type="number" name="length_mm" value={form.length_mm} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="63" step="0.1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">重さ (g)</label>
                <input type="number" name="weight_g" value={form.weight_g} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="4.5" step="0.1" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="使用感など..." />
            </div>
            <button type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm">
              保存
            </button>
          </form>
        )}

        {lures.length === 0 ? (
          <div className="text-center text-gray-400 py-16 bg-white rounded-xl shadow-sm">
            <div className="text-5xl mb-4">🎣</div>
            <p>ルアーがまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lures.map((lure) => (
              <div key={lure.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-800">{lure.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {lure.type ?? '—'} / {lure.color ?? '—'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {lure.length_mm && `${lure.length_mm}mm`}
                      {lure.weight_g && ` / ${lure.weight_g}g`}
                    </div>
                    {lure.notes && <p className="text-sm text-gray-400 mt-2">{lure.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(lure.id)}
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