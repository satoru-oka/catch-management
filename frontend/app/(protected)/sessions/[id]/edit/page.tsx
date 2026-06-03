'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { SessionForm } from '@/components/SessionForm'
import { apiFetch, ApiError } from '@/lib/api'
import { buildFormPayload } from '@/lib/formPayload'
import { FullScreenSpinner } from '@/lib/Loading'
import { fetchAllPages } from '@/lib/pagination'
import {
  EMPTY_SESSION_FORM,
  SESSION_NULLABLE_FIELDS,
  type SessionFormState,
} from '@/lib/sessionFormConfig'
import type { SessionDetail, Spot } from '@/lib/types'

export default function EditSessionPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [form, setForm] = useState<SessionFormState>(EMPTY_SESSION_FORM)

  useEffect(() => {
    Promise.all([
      apiFetch<SessionDetail>(`/api/sessions/${id}`),
      fetchAllPages<Spot>('/api/spots', (path) => apiFetch<Spot[]>(path)).catch(
        () => [] as Spot[],
      ),
    ])
      .then(([s, sp]) => {
        setSpots(sp)
        setForm({
          spot_id: s.spot_id ?? '',
          date: s.date,
          start_time: s.start_time ?? '',
          end_time: s.end_time ?? '',
          water_level: s.water_level ?? '',
          water_clarity: s.water_clarity ?? '',
          weather: s.weather ?? '',
          notes: s.notes ?? '',
        })
      })
      .catch((e: ApiError) => setError(e.detail))
      .finally(() => setLoading(false))
  }, [id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload = buildFormPayload(form, { nullableFields: SESSION_NULLABLE_FIELDS })
    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      router.push(`/sessions/${id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '保存に失敗しました')
      setSubmitting(false)
    }
  }

  if (loading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">釣行を編集</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <SessionForm
          mode="edit"
          form={form}
          spots={spots}
          submitting={submitting}
          submitLabel="変更を保存"
          error={error}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  )
}
