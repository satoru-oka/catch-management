'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, ApiError } from './api'
import { buildFormPayload, type FormPayload } from './formPayload'
import { LIST_PAGE_SIZE, withPagination } from './pagination'

export type UseResourceListOptions<T extends { id: string }, F extends Record<string, string>> = {
  endpoint: string
  emptyForm: F
  fromEntity: (entity: T) => F
  nullableFields: readonly (keyof F & string)[]
  numberFields: readonly (keyof F & string)[]
  deleteConfirm: string
}

export function useResourceList<T extends { id: string }, F extends Record<string, string>>(
  opts: UseResourceListOptions<T, F>,
) {
  const { endpoint, emptyForm, fromEntity, nullableFields, numberFields, deleteConfirm } = opts
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<F>(emptyForm)

  const loadPage = useCallback(
    (offset = 0) =>
      apiFetch<T[]>(withPagination(endpoint, { limit: LIST_PAGE_SIZE, offset }))
        .then((page) => {
          // 失敗 → 再取得成功でエラーバナーが残らないようクリアする (#97)
          setError(null)
          setItems((current) => (offset === 0 ? page : [...current, ...page]))
          setHasMore(page.length === LIST_PAGE_SIZE)
        })
        .catch((e: ApiError) => setError(e.detail)),
    [endpoint],
  )

  const reload = useCallback(() => loadPage(0), [loadPage])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }))
  }

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const startEdit = (item: T) => {
    setEditingId(item.id)
    setForm(fromEntity(item))
    setShowForm(true)
  }

  const cancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const toPayload = (nullEmpty: boolean): FormPayload =>
    buildFormPayload(form, {
      nullableFields: nullEmpty ? (nullableFields as readonly string[]) : [],
      numberFields: numberFields as readonly string[],
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await apiFetch<T>(`${endpoint}/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(toPayload(true)),
        })
      } else {
        await apiFetch<T>(endpoint, {
          method: 'POST',
          body: JSON.stringify(toPayload(false)),
        })
      }
      cancel()
      await reload()
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : '保存に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(deleteConfirm)) return
    try {
      await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' })
      // ローカル配列から除くだけだと、loadMore の offset (= items.length) と
      // hasMore がサーバ状態とずれ、次ページで重複・欠落が起こり得る。
      // 先頭ページから取り直して状態を一貫させる (#73)。
      await reload()
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : '削除に失敗しました')
    }
  }

  const loadMore = async () => {
    setLoadingMore(true)
    await loadPage(items.length)
    setLoadingMore(false)
  }

  return {
    items,
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
  }
}
