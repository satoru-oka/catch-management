'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FullScreenSpinner } from '@/lib/Loading'
import BottomNav from '@/components/BottomNav'
import { UNAUTHORIZED_EVENT } from '@/lib/api'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const handleUnauthorized = useCallback(async () => {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } catch {
      // Redirect anyway; stale local auth state is worse than a failed sign-out.
    }
    router.replace('/login')
  }, [router])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session) {
        router.replace('/login')
        return
      }
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
    })
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    }
  }, [handleUnauthorized, router])

  if (!ready) return <FullScreenSpinner />

  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  )
}
