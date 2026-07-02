import { createClient } from '@/lib/supabase'

export const UNAUTHORIZED_EVENT = 'auth:unauthorized'

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`)
    this.status = status
    this.detail = detail
  }
}

// NEXT_PUBLIC_* は `process.env.NEXT_PUBLIC_API_URL` という字句で参照した箇所だけが
// next build 時にブラウザバンドルへインライン展開される。`const env = process.env` の
// ようにエイリアス経由で読むと展開されず、本番ブラウザでは undefined になり全 API 呼び
// 出しが失敗する (next/dist/docs .../environment-variables.md 参照)。必ず字句どおり参照する。
// また失敗は ApiError で投げ、呼び出し側の `catch((e: ApiError) => setError(e.detail))`
// が undefined（空表示）にならないようにする。
export function getRequiredApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new ApiError(0, 'NEXT_PUBLIC_API_URL が設定されていません')
  }
  return url
}

async function getToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function notifyUnauthorized() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
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

  const res = await fetch(`${getRequiredApiUrl()}${path}`, {
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
