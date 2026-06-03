'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'
import { buildFormPayload } from '@/lib/formPayload'
import { FullScreenSpinner } from '@/lib/Loading'
import { LIST_PAGE_SIZE, withPagination } from '@/lib/pagination'
import type { Lure } from '@/lib/types'

type FormState = {
  name: string
  type: string
  color: string
  length_mm: string
  weight_g: string
  notes: string
}

const emptyForm: FormState = { name: '', type: '', color: '', length_mm: '', weight_g: '', notes: '' }
const nullableFields = ['type', 'color', 'length_mm', 'weight_g', 'notes']
const numberFields = ['length_mm', 'weight_g']

const fromLure = (l: Lure): FormState => ({
  name: l.name,
  type: l.type ?? '',
  color: l.color ?? '',
  length_mm: l.length_mm?.toString() ?? '',
  weight_g: l.weight_g?.toString() ?? '',
  notes: l.notes ?? '',
})

const toPayload = (f: FormState, nullEmpty = false) =>
  buildFormPayload(f, {
    nullableFields: nullEmpty ? nullableFields : [],
    numberFields,
  })

export default function LuresPage() {
  const router = useRouter()
  const [lures, setLures] = useState<Lure[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const loadPage = useCallback((offset = 0) =>
    apiFetch<Lure[]>(
      withPagination('/api/lures', { limit: LIST_PAGE_SIZE, offset }),
    )
      .then((page) => {
        setLures((current) => (offset === 0 ? page : [...current, ...page]))
        setHasMore(page.length === LIST_PAGE_SIZE)
      })
      .catch((e: ApiError) => setError(e.detail)), [])

  const reload = useCallback(() => loadPage(0), [loadPage])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const startEdit = (l: Lure) => {
    setEditingId(l.id)
    setForm(fromLure(l))
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
        await apiFetch<Lure>(`/api/lures/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(toPayload(form, true)),
        })
      } else {
        await apiFetch<Lure>('/api/lures', {
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
    if (!confirm('このルアーを削除しますか?')) return
    try {
      await apiFetch(`/api/lures/${id}`, { method: 'DELETE' })
      setLures(lures.filter((l) => l.id !== id))
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : '削除に失敗しました')
    }
  }

  const loadMore = async () => {
    setLoadingMore(true)
    await loadPage(lures.length)
    setLoadingMore(false)
  }

  if (loading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">ルアー管理</h1>
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
            {showForm ? 'キャンセル' : '＋ ルアー追加'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-700">{editingId ? '編集' : '新規追加'}</h2>
            <div>
              <label htmlFor="lure-form-name" className="block text-sm font-medium text-gray-700 mb-1">ルアー名 *</label>
              <input type="text" id="lure-form-name" name="name" value={form.name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dコンタクト63" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lure-form-type" className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                <select id="lure-form-type" name="type" value={form.type} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">選択</option>
                  <option>ミノー</option><option>スプーン</option><option>スピナー</option>
                  <option>クランク</option><option>その他</option>
                </select>
              </div>
              <div>
                <label htmlFor="lure-form-color" className="block text-sm font-medium text-gray-700 mb-1">カラー</label>
                <input type="text" id="lure-form-color" name="color" value={form.color} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="チャート" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lure-form-length_mm" className="block text-sm font-medium text-gray-700 mb-1">長さ (mm)</label>
                <input type="number" id="lure-form-length_mm" name="length_mm" value={form.length_mm} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="63" step="0.1" />
              </div>
              <div>
                <label htmlFor="lure-form-weight_g" className="block text-sm font-medium text-gray-700 mb-1">重さ (g)</label>
                <input type="number" id="lure-form-weight_g" name="weight_g" value={form.weight_g} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="4.5" step="0.1" />
              </div>
            </div>
            <div>
              <label htmlFor="lure-form-notes" className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea id="lure-form-notes" name="notes" value={form.notes} onChange={handleChange} rows={2}
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
            <div className="text-5xl mb-4" aria-hidden="true">🎣</div>
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
                  <div className="flex flex-col gap-1 ml-4 text-sm">
                    <button onClick={() => startEdit(lure)} className="text-gray-500 hover:text-gray-700">編集</button>
                    <button onClick={() => handleDelete(lure.id)} className="text-red-400 hover:text-red-600">削除</button>
                  </div>
                </div>
              </div>
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full bg-white border border-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {loadingMore ? '読み込み中...' : 'もっと読み込む'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
