'use client'

import { useRouter } from 'next/navigation'
import { FormInput, FormSelect, FormTextarea } from '@/components/Form'
import { FullScreenSpinner } from '@/lib/Loading'
import type { Lure } from '@/lib/types'
import { useResourceList } from '@/lib/useResourceList'

type FormState = {
  name: string
  type: string
  color: string
  length_mm: string
  weight_g: string
  notes: string
}

const EMPTY_FORM: FormState = { name: '', type: '', color: '', length_mm: '', weight_g: '', notes: '' }
const NULLABLE_FIELDS = ['type', 'color', 'length_mm', 'weight_g', 'notes'] as const
const NUMBER_FIELDS = ['length_mm', 'weight_g'] as const

export default function LuresPage() {
  const router = useRouter()
  const {
    items: lures,
    loading,
    loadingMore,
    hasMore,
    error,
    showForm,
    editingId,
    form,
    handleChange,
    startCreate,
    startEdit,
    cancel,
    handleSubmit,
    handleDelete,
    loadMore,
  } = useResourceList<Lure, FormState>({
    endpoint: '/api/lures',
    emptyForm: EMPTY_FORM,
    fromEntity: (l) => ({
      name: l.name,
      type: l.type ?? '',
      color: l.color ?? '',
      length_mm: l.length_mm?.toString() ?? '',
      weight_g: l.weight_g?.toString() ?? '',
      notes: l.notes ?? '',
    }),
    nullableFields: NULLABLE_FIELDS,
    numberFields: NUMBER_FIELDS,
    deleteConfirm: 'このルアーを削除しますか?',
  })

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
            <FormInput label="ルアー名" name="name" type="text" value={form.name} onChange={handleChange} placeholder="Dコンタクト63" className="text-gray-900" required />
            <div className="grid grid-cols-2 gap-4">
              <FormSelect label="種別" name="type" value={form.type} onChange={handleChange} className="text-gray-900">
                <option value="">選択</option>
                <option>ミノー</option><option>スプーン</option><option>スピナー</option>
                <option>クランク</option><option>その他</option>
              </FormSelect>
              <FormInput label="カラー" name="color" type="text" value={form.color} onChange={handleChange} placeholder="チャート" className="text-gray-900" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="長さ (mm)" name="length_mm" type="number" value={form.length_mm} onChange={handleChange} placeholder="63" step="0.1" className="text-gray-900" />
              <FormInput label="重さ (g)" name="weight_g" type="number" value={form.weight_g} onChange={handleChange} placeholder="4.5" step="0.1" className="text-gray-900" />
            </div>
            <FormTextarea label="メモ" name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="使用感など..." className="text-gray-900" />
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
