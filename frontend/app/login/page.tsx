'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FullScreenSpinner } from '@/lib/Loading'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let active = true

    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return
        if (data.session) {
          router.replace('/')
          return
        }
        setCheckingSession(false)
      })
      .catch(() => {
        if (active) setCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }

    router.push('/')
  }

  if (checkingSession) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2" aria-hidden="true">🐟</div>
          <h1 className="text-2xl font-bold text-gray-800">釣果ログ</h1>
          <p className="text-gray-500 text-sm mt-1">ログインしてください</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="example@email.com" required />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="••••••••" required />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:opacity-95 text-white font-bold py-2.5 rounded-xl text-sm shadow transition disabled:opacity-50">
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
