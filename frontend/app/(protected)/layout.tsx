'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FullScreenSpinner } from '@/lib/Loading'
import BottomNav from '@/components/BottomNav'
import { UNAUTHORIZED_EVENT } from '@/lib/api'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const redirectToLogin = () => router.replace('/login')
    const handleUnauthorized = async () => {
      try {
        await supabase.auth.signOut()
      } catch {
        // Redirect anyway so stale local state does not keep protected UI visible.
      }
      redirectToLogin()
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session) {
        redirectToLogin()
        return
      }
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) redirectToLogin()
    })
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)

    return () => {
      cancelled = true
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
      sub.subscription.unsubscribe()
    }
  }, [router])

  if (!ready) return <FullScreenSpinner />

  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  )
}
