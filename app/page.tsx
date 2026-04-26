'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/login'
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error || !profile) {
          window.location.href = '/login'
          return
        }

        if (profile.role === 'coach') {
          window.location.href = '/dashboard'
        } else {
          window.location.href = '/cliente'
        }
      } catch (err) {
        console.error('Auth error:', err)
        window.location.href = '/login'
      }
    }

    checkAuth()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
    </div>
  )
}
