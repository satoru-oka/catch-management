'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionForm } from '@/components/SessionForm'
import { apiFetch, ApiError } from '@/lib/api'
import { tokyoDateIso } from '@/lib/date'
import { buildFormPayload } from '@/lib/formPayload'
import { fetchAllPages } from '@/lib/pagination'
import {
  EMPTY_SESSION_FORM,
  type SessionFormState,
} from '@/lib/sessionFormConfig'
import type { Spot, Session } from '@/lib/types'

export default function NewSessionPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [form, setForm] = useState<SessionFormState>({
    ...EMPTY_SESSION_FORM,
    date: tokyoDateIso(),
  })

  useEffect(() => {
    fetchAllPages<Spot>('/api/spots', (path) => apiFetch<Spot[]>(path))
      .then(setSpots)
      .catch(() => setSpots([]))
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const data = buildFormPayload(form)
    try {
      await apiFetch<Session>('/api/sessions', { method: 'POST', body: JSON.stringify(data) })
      router.push('/')
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '保存に失敗しました')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">新規釣行</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <SessionForm
          mode="create"
          form={form}
          spots={spots}
          submitting={submitting}
          submitLabel="釣行を保存"
          error={error}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onNavigateToSpots={() => router.push('/spots')}
        />
      </main>
    </div>
  )
}
