'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

export default function CoachShell({ children, padded = false }: { children: React.ReactNode; padded?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    async function checkSession() {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (!active) return

      if (error || !user) {
        const next = encodeURIComponent(pathname || '/dashboard')
        router.replace(`/login?next=${next}`)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      if (profile?.role && profile.role !== 'coach') {
        router.replace('/cliente')
        return
      }

      setReady(true)
    }

    checkSession()

    return () => {
      active = false
    }
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto pb-nav-safe layout-main">
        {padded ? <div className="p-6 max-w-5xl mx-auto">{children}</div> : children}
      </main>
    </div>
  )
}
