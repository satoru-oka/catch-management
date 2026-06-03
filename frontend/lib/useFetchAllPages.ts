'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from './api'
import { fetchAllPages } from './pagination'

export function useFetchAllPages<T>(endpoint: string): {
  data: T[]
  loading: boolean
} {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchAllPages<T>(endpoint, (path) => apiFetch<T[]>(path))
      .then((rows) => {
        if (!cancelled) setData(rows)
      })
      .catch(() => {
        if (!cancelled) setData([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [endpoint])

  return { data, loading }
}
