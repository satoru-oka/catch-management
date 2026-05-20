import { createClient } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`)
    this.status = status
    this.detail = detail
  }
}

async function getToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function notifyUnauthorized() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('auth:unauthorized'))
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken()
  if (!token) {
    notifyUnauthorized()
    throw new ApiError(401, 'Not authenticated')
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (res.status === 401) {
    notifyUnauthorized()
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // body wasn't JSON
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
