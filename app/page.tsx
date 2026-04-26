'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function redirect() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // No profile found – redirect to login
        window.location.href = '/login'
        return
      }

      if (profile.role === 'coach') {
        window.location.href = '/dashboard'
      } else if (profile.role === 'cliente') {
        window.location.href = '/cliente'
      } else {
        // Unknown role – redirect to login
        window.location.href = '/login'
      }
    }

    redirect()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return null
}
