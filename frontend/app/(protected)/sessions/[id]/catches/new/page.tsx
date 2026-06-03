'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CatchForm } from '@/components/CatchForm'
import { apiFetch, ApiError } from '@/lib/api'
import {
  CATCH_NUMBER_FIELDS,
  EMPTY_CATCH_FORM,
  type CatchFormState,
} from '@/lib/catchFormConfig'
import { buildFormPayload } from '@/lib/formPayload'
import { fetchAllPages } from '@/lib/pagination'
import type { Lure, Catch } from '@/lib/types'

export default function NewCatchPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const sessionId = params.id
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lures, setLures] = useState<Lure[]>([])
  const [form, setForm] = useState<CatchFormState>(EMPTY_CATCH_FORM)

  useEffect(() => {
    fetchAllPages<Lure>('/api/lures', (path) => apiFetch<Lure[]>(path))
      .then(setLures)
      .catch(() => setLures([]))
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleLureSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    if (!id) {
      setForm({ ...form, lure_id: '', lure_name: '', lure_color: '' })
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
      numberFields: CATCH_NUMBER_FIELDS,
    })
    data.is_released = form.is_released === 'true'
    try {
      await apiFetch<Catch>(`/api/sessions/${sessionId}/catches`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      router.push(`/sessions/${sessionId}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '保存に失敗しました')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">釣果追加</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <CatchForm
          form={form}
          lures={lures}
          submitting={submitting}
          submitLabel="釣果を保存"
          error={error}
          showPlaceholders
          onChange={handleChange}
          onLureSelect={handleLureSelect}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  )
}
