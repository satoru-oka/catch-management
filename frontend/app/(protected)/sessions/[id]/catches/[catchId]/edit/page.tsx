'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CatchForm } from '@/components/CatchForm'
import { apiFetch, ApiError } from '@/lib/api'
import {
  CATCH_NULLABLE_FIELDS,
  CATCH_NUMBER_FIELDS,
  EMPTY_CATCH_FORM,
  type CatchFormState,
} from '@/lib/catchFormConfig'
import { buildFormPayload } from '@/lib/formPayload'
import { FullScreenSpinner } from '@/lib/Loading'
import { fetchAllPages } from '@/lib/pagination'
import type { Catch, Lure } from '@/lib/types'

export default function EditCatchPage() {
  const router = useRouter()
  const params = useParams<{ id: string; catchId: string }>()
  const sessionId = params.id
  const catchId = params.catchId
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lures, setLures] = useState<Lure[]>([])
  const [form, setForm] = useState<CatchFormState>(EMPTY_CATCH_FORM)

  useEffect(() => {
    Promise.all([
      apiFetch<Catch>(`/api/catches/${catchId}`),
      fetchAllPages<Lure>('/api/lures', (path) => apiFetch<Lure[]>(path)).catch(
        () => [] as Lure[],
      ),
    ])
      .then(([c, ls]) => {
        setLures(ls)
        setForm({
          fish_species: c.fish_species,
          length_cm: c.length_cm?.toString() ?? '',
          weight_g: c.weight_g?.toString() ?? '',
          lure_id: c.lure_id ?? '',
          lure_name: c.lure_name ?? '',
          lure_color: c.lure_color ?? '',
          is_released: c.is_released ? 'true' : 'false',
          notes: c.notes ?? '',
        })
      })
      .catch((e: ApiError) => setError(e.detail))
      .finally(() => setLoading(false))
  }, [catchId])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleLureSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    if (!id) {
      setForm({ ...form, lure_id: '' })
      return
    }
    const lure = lures.find((l) => l.id === id)
    if (!lure) return
    setForm({
      ...form,
      lure_id: lure.id,
      lure_name: lure.name,
      lure_color: lure.color ?? '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const data: Record<string, unknown> = buildFormPayload(form, {
      nullableFields: CATCH_NULLABLE_FIELDS,
      numberFields: CATCH_NUMBER_FIELDS,
    })
    data.is_released = form.is_released === 'true'
    try {
      await apiFetch(`/api/catches/${catchId}`, { method: 'PUT', body: JSON.stringify(data) })
      router.push(`/sessions/${sessionId}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '保存に失敗しました')
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('この釣果を削除しますか?')) return
    try {
      await apiFetch(`/api/catches/${catchId}`, { method: 'DELETE' })
      router.push(`/sessions/${sessionId}`)
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : '削除に失敗しました')
    }
  }

  if (loading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800 flex-1">釣果を編集</h1>
        <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">削除</button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <CatchForm
          form={form}
          lures={lures}
          submitting={submitting}
          submitLabel="変更を保存"
          error={error}
          showPlaceholders={false}
          onChange={handleChange}
          onLureSelect={handleLureSelect}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  )
}
