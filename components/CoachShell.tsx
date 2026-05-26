'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, Loader2, Moon, Sun } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { useTheme } from '@/components/ThemeProvider'
import { supabase } from '@/lib/supabase'

function CoachFloatingControls() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="fixed right-3 z-30 flex flex-col gap-2 lg:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}>
      <Link
        href="/dashboard"
        className="h-11 w-11 rounded-2xl border flex items-center justify-center"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
          color: 'var(--text)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        aria-label="Ir al dashboard"
      >
        <Home size={17} />
      </Link>
      <button
        type="button"
        onClick={toggleTheme}
        className="h-11 w-11 rounded-2xl border flex items-center justify-center"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
          color: 'var(--text)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </div>
  )
}

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
      <CoachFloatingControls />
      <main className="flex-1 overflow-auto pb-nav-safe layout-main">
        {padded ? <div className="p-6 max-w-5xl mx-auto">{children}</div> : children}
      </main>
    </div>
  )
}
