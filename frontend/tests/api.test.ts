import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `lib/supabase` の createClient を差し替え可能にするため、トップでモックする。
const signOut = vi.fn().mockResolvedValue(undefined)
const getSession = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: {
      getSession,
      signOut,
    },
  }),
}))

import { ApiError, apiFetch } from '@/lib/api'

beforeEach(() => {
  getSession.mockReset()
  signOut.mockClear()
  signOut.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(response: Partial<Response> & { jsonBody?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonBody,
    ...response,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('apiFetch', () => {
  it('Authorization ヘッダにアクセストークンを付与して fetch する', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok-123' } } })
    const fetchMock = mockFetch({ ok: true, status: 200, jsonBody: { ok: true } })

    const result = await apiFetch('/api/spots/')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test.local/api/spots/',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-123',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('options で渡したヘッダ・メソッド・body をマージする', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    const fetchMock = mockFetch({ ok: true, status: 200, jsonBody: {} })

    await apiFetch('/api/spots/', {
      method: 'POST',
      body: JSON.stringify({ name: 'a' }),
      headers: { 'X-Custom': 'yes' },
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'a' }))
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
      'X-Custom': 'yes',
    })
  })

  it('セッション無しなら 401 ApiError を投げ、認証切れイベントを通知する', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const fetchMock = mockFetch({ ok: true, status: 200 })
    const unauthorized = vi.fn()
    window.addEventListener('auth:unauthorized', unauthorized)

    try {
      await expect(apiFetch('/api/spots/')).rejects.toMatchObject({
        status: 401,
        detail: 'Not authenticated',
      })
      expect(fetchMock).not.toHaveBeenCalled()
      expect(signOut).not.toHaveBeenCalled()
      expect(unauthorized).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('auth:unauthorized', unauthorized)
    }
  })

  it('レスポンス 401 でも認証切れイベントを通知してエラーを投げる', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    mockFetch({ ok: false, status: 401, jsonBody: { detail: 'Token expired' } })
    const unauthorized = vi.fn()
    window.addEventListener('auth:unauthorized', unauthorized)

    try {
      await expect(apiFetch('/api/spots/')).rejects.toBeInstanceOf(ApiError)
      expect(signOut).not.toHaveBeenCalled()
      expect(unauthorized).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('auth:unauthorized', unauthorized)
    }
  })

  it('4xx/5xx エラーで body の detail を使った ApiError を投げる', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    mockFetch({ ok: false, status: 404, jsonBody: { detail: '見つかりません' } })

    await expect(apiFetch('/api/spots/x')).rejects.toMatchObject({
      status: 404,
      detail: '見つかりません',
    })
  })

  it('エラーレスポンスの body が JSON でなくてもクラッシュしない', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('not json')
        },
      }),
    )

    await expect(apiFetch('/api/spots/')).rejects.toMatchObject({
      status: 500,
      detail: 'HTTP 500',
    })
  })

  it('204 No Content では undefined を返す', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    mockFetch({ ok: true, status: 204 })

    const result = await apiFetch('/api/spots/x', { method: 'DELETE' })

    expect(result).toBeUndefined()
  })

})

describe('ApiError', () => {
  it('status と detail を保持し、message にも含める', () => {
    const err = new ApiError(404, 'not found')
    expect(err.status).toBe(404)
    expect(err.detail).toBe('not found')
    expect(err.message).toContain('404')
    expect(err.message).toContain('not found')
    expect(err).toBeInstanceOf(Error)
  })
})
