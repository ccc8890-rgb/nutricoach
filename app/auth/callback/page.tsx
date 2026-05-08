'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      const invtoken = searchParams.get('invtoken')

      if (!code) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        if (invtoken) {
          router.push(`/registro/${invtoken}?error=auth`)
        } else {
          router.push('/login?error=auth')
        }
        return
      }

      // Sincronizar sesión con cookies del servidor (necesario para SSR/API routes)
      if (data.session) {
        try {
          await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
          })
        } catch {
          // No crítico — las rutas cliente funcionan sin cookies
        }
      }

      if (invtoken) {
        const res = await fetch('/api/registro-invitacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: invtoken, modo: 'vincular' }),
        })
        const data2 = await res.json()
        if (data2.ok) {
          router.push('/cliente')
        } else {
          router.push(`/registro/${invtoken}?error=${encodeURIComponent(data2.error ?? 'Error al vincular')}`)
        }
      } else {
        router.push('/dashboard')
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
