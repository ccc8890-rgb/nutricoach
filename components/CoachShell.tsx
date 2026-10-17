'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CaretRight,
  CircleNotch,
  House,
  MagnifyingGlass,
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

function getCoachArea(pathname: string): string {
  if (pathname.startsWith('/clientes') || pathname.startsWith('/contenido') || pathname.startsWith('/agentes')) return 'Inicio'
  if (pathname.startsWith('/entrenos/plantillas') || pathname.startsWith('/entrenos/ejercicios') || pathname.startsWith('/dietas/plantillas')) return 'Planes'
  if (pathname.startsWith('/entrenos')) return 'Entrenamiento'
  if (pathname.startsWith('/recetas')) return 'Recetario'
  if (pathname.startsWith('/compra') || pathname.startsWith('/precios')) return 'Compra y costes'
  if (pathname.startsWith('/nutricion') || pathname.startsWith('/dietas')) return 'Nutrición'
  if (pathname.startsWith('/ajustes') || pathname.startsWith('/sistema') || pathname.startsWith('/conocimiento') || pathname.startsWith('/coach') || pathname.startsWith('/cuestionarios')) return 'Ajustes'
  return 'Inicio'
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

function CoachTopBar({ pathname }: { pathname: string }) {
  const area = getCoachArea(pathname)
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="coach-atelier-topbar sticky top-0 z-20 px-4 sm:px-6 lg:px-8">
      <div className="coach-atelier-topbar__inner">
        <div className="coach-atelier-context min-w-0">
          <div className="coach-atelier-register hidden sm:flex" aria-label={`Coach OS, ${area}`}>
            <Link href="/dashboard" prefetch>Coach OS</Link>
            <CaretRight size={10} aria-hidden="true" />
            <span>{area}</span>
          </div>
        </div>

        <div className="coach-atelier-actions">
          {!pathname.startsWith('/clientes') && (
            <Link
              href="/clientes"
              className="coach-atelier-search hidden lg:flex"
              aria-label="Buscar cliente"
            >
              <MagnifyingGlass size={14} />
              <span>Buscar cliente</span>
            </Link>
          )}
          <button type="button" onClick={toggleTheme} className="coach-atelier-icon-action hidden sm:grid" aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </header>
  )
}

export default function CoachShell({ children, padded = false }: { children: React.ReactNode; padded?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const mostrarBarraContextual = !pathname?.startsWith('/contenido')
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
        {mostrarBarraContextual && <CoachTopBar pathname={pathname || '/dashboard'} />}
        {padded ? <div className="p-6 max-w-[120rem] mx-auto">{children}</div> : children}
      </main>
    </div>
  )
}
