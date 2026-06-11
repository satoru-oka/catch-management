'use client'

import { useRouter } from 'next/navigation'
import { FormInput, FormTextarea } from '@/components/Form'
import { FullScreenSpinner } from '@/lib/Loading'
import type { Spot } from '@/lib/types'
import { useResourceList } from '@/lib/useResourceList'

type FormState = {
  name: string
  river_name: string
  latitude: string
  longitude: string
  notes: string
}

const EMPTY_FORM: FormState = { name: '', river_name: '', latitude: '', longitude: '', notes: '' }
const NULLABLE_FIELDS = ['river_name', 'latitude', 'longitude', 'notes'] as const
const NUMBER_FIELDS = ['latitude', 'longitude'] as const

export default function SpotsPage() {
  const router = useRouter()
  const {
    items: spots,
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
  } = useResourceList<Spot, FormState>({
    endpoint: '/api/spots',
    emptyForm: EMPTY_FORM,
    fromEntity: (s) => ({
      name: s.name,
      river_name: s.river_name ?? '',
      latitude: s.latitude?.toString() ?? '',
      longitude: s.longitude?.toString() ?? '',
      notes: s.notes ?? '',
    }),
    nullableFields: NULLABLE_FIELDS,
    numberFields: NUMBER_FIELDS,
    deleteConfirm: 'このポイントを削除しますか?',
  })

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
            <FormInput label="ポイント名" name="name" type="text" value={form.name} onChange={handleChange} placeholder="上流の淵" required />
            <FormInput label="川の名前" name="river_name" type="text" value={form.river_name} onChange={handleChange} placeholder="○○川" />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="緯度" name="latitude" type="number" value={form.latitude} onChange={handleChange} placeholder="35.681" step="any" />
              <FormInput label="経度" name="longitude" type="number" value={form.longitude} onChange={handleChange} placeholder="139.767" step="any" />
            </div>
            <FormTextarea label="メモ" name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="ポイントの特徴など..." />
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
