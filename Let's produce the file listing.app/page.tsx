'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Home() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (session) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          if (profileError) throw profileError

          if (profile?.role === 'coach') {
            window.location.href = '/dashboard'
          } else {
            window.location.href = '/cliente'
          }
        } else {
          window.location.href = '/login'
        }
      } catch (err) {
        console.error('Error checking session:', err)
        window.location.href = '/login'
      }
    }

    checkSession()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-6 h-6 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
        <span>Cargando…</span>
      </div>
    </div>
  )
}
