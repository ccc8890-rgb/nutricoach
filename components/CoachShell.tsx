'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CircleNotch,
  House,
  Moon,
  Sun,
} from '@phosphor-icons/react'
import Sidebar from '@/components/Sidebar'
import { useTheme } from '@/components/ThemeProvider'
import { supabase } from '@/lib/supabase'

type CoachAccess = 'coach' | 'login' | 'cliente'

let coachAccessCache: CoachAccess | null = null
let coachAccessPromise: Promise<CoachAccess> | null = null
let authListenerReady = false

function resetCoachAccessCache() {
  coachAccessCache = null
  coachAccessPromise = null
}

function installAuthCacheReset() {
  if (authListenerReady || typeof window === 'undefined') return
  authListenerReady = true
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      resetCoachAccessCache()
    }
  })
}

async function getCoachAccess(): Promise<CoachAccess> {
  if (coachAccessCache) return coachAccessCache
  if (coachAccessPromise) return coachAccessPromise

  coachAccessPromise = (async () => {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) return 'login'

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'coach') return 'cliente'

    return 'coach'
  })()

  try {
    coachAccessCache = await coachAccessPromise
    return coachAccessCache
  } finally {
    coachAccessPromise = null
  }
}

function CoachFloatingControls() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="fixed right-3 z-30 flex gap-2 lg:hidden" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
      <Link
        href="/dashboard"
        prefetch
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
        <House size={17} />
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
  const [ready, setReady] = useState(() => coachAccessCache === 'coach')

  useEffect(() => {
    installAuthCacheReset()
    let active = true

    async function checkSession() {
      if (coachAccessCache === 'coach') {
        setReady(true)
        return
      }

      setReady(false)
      const access = await getCoachAccess()

      if (!active) return

      if (access === 'login') {
        const next = encodeURIComponent(pathname || '/dashboard')
        router.replace(`/login?next=${next}`)
        return
      }

      if (access === 'cliente') {
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
        <CircleNotch size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="coach-atelier-shell flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <CoachFloatingControls />
      <main className="coach-atelier-main flex-1 overflow-auto pb-nav-safe layout-main">
        {padded ? <div className="p-6 max-w-[120rem] mx-auto">{children}</div> : children}
      </main>
    </div>
  )
}
