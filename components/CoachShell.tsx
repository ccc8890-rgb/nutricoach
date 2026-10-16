'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight,
  Dumbbell,
  FilePlus2,
  Home,
  Loader2,
  Moon,
  Plus,
  Search,
  Sun,
  UserPlus,
  Utensils,
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { useTheme } from '@/components/ThemeProvider'
import { supabase } from '@/lib/supabase'

type CoachContext = {
  area: string
  title: string
  actionHref: string
  actionLabel: string
  actionIcon: React.ElementType
}

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

function getCoachContext(pathname: string): CoachContext {
  if (pathname.startsWith('/clientes')) {
    return { area: 'Inicio', title: 'Clientes', actionHref: '/clientes/nuevo', actionLabel: 'Nuevo cliente', actionIcon: UserPlus }
  }
  if (pathname.startsWith('/agentes')) {
    return { area: 'Inicio', title: 'Revisión IA', actionHref: '/dashboard', actionLabel: 'Volver al dashboard', actionIcon: Home }
  }
  if (pathname.startsWith('/entrenos')) {
    return { area: 'Entrenamiento', title: 'Training OS', actionHref: '/entrenos/nueva', actionLabel: 'Crear plan', actionIcon: Dumbbell }
  }
  if (pathname.startsWith('/nutricion')) {
    return { area: 'Nutrición', title: 'Dashboard nutrición', actionHref: '/dietas/nueva', actionLabel: 'Nueva dieta', actionIcon: Utensils }
  }
  if (pathname.startsWith('/compra')) {
    return { area: 'Nutrición', title: 'Compra y costes', actionHref: '/precios/escandallo', actionLabel: 'Escandallo', actionIcon: FilePlus2 }
  }
  if (pathname.startsWith('/dietas')) {
    return { area: 'Nutrición', title: 'Planes y alimentos', actionHref: '/dietas/nueva', actionLabel: 'Nueva dieta', actionIcon: Utensils }
  }
  if (pathname.startsWith('/recetas')) {
    return { area: 'Nutrición', title: 'Recetario', actionHref: '/recetas/nueva', actionLabel: 'Nueva receta', actionIcon: Plus }
  }
  if (pathname.startsWith('/precios')) {
    return { area: 'Nutrición', title: 'Costes y rentabilidad', actionHref: '/precios/escandallo', actionLabel: 'Escandallo', actionIcon: FilePlus2 }
  }
  if (pathname.startsWith('/ajustes') || pathname.startsWith('/sistema')) {
    return { area: 'Ajustes', title: 'Ajustes', actionHref: '/dashboard', actionLabel: 'Volver al dashboard', actionIcon: Home }
  }
  if (pathname.startsWith('/conocimiento') || pathname.startsWith('/coach') || pathname.startsWith('/cuestionarios')) {
    return { area: 'Ajustes', title: 'Método y conocimiento', actionHref: '/conocimiento/nueva', actionLabel: 'Nueva nota', actionIcon: Plus }
  }
  return { area: 'Inicio', title: 'Dashboard', actionHref: '/clientes/nuevo', actionLabel: 'Nuevo cliente', actionIcon: UserPlus }
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

function CoachTopBar({ pathname }: { pathname: string }) {
  const context = getCoachContext(pathname)
  const ActionIcon = context.actionIcon

  return (
    <header
      className="coach-atelier-topbar sticky top-0 z-20 border-b px-4 sm:px-6 lg:px-8"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in srgb, var(--bg) 96%, transparent)',
      }}
    >
      <div className="coach-atelier-topbar__inner flex items-center justify-between gap-5">
        <div className="coach-atelier-context flex min-w-0 items-center gap-4">
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.11em]" style={{ color: 'var(--text-muted)' }}>
              <Link href="/dashboard" prefetch className="transition-colors hover:text-[var(--text)]">Coach OS</Link>
              <ChevronRight size={11} />
              <span>{context.area}</span>
            </div>
          </div>
          <span className="coach-atelier-context__rule hidden sm:block" aria-hidden="true" />
          <h1 className="truncate text-lg font-semibold tracking-[-0.035em] sm:text-xl" style={{ color: 'var(--text)' }}>
            {context.title}
          </h1>
        </div>

        <div className="coach-atelier-actions flex min-w-0 items-center gap-2">
          {!pathname.startsWith('/clientes') && (
            <Link
              href="/clientes"
              className="coach-atelier-search hidden h-10 min-w-[19rem] items-center gap-2 border px-3 lg:flex"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
              aria-label="Buscar cliente"
            >
              <Search size={15} />
              <span className="truncate text-sm">Buscar cliente</span>
              <span className="ml-auto border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ borderColor: 'var(--border)' }}>
                Abrir
              </span>
            </Link>
          )}
          <Link href={context.actionHref} prefetch className="btn btn-primary btn-sm">
            <ActionIcon size={14} />
            {context.actionLabel}
          </Link>
        </div>
      </div>
    </header>
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
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="coach-atelier-shell flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <CoachFloatingControls />
      <main className="coach-atelier-main flex-1 overflow-auto pb-nav-safe layout-main">
        <CoachTopBar pathname={pathname || '/dashboard'} />
        {padded ? <div className="p-6 max-w-[120rem] mx-auto">{children}</div> : children}
      </main>
    </div>
  )
}
