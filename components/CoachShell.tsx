'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Barbell,
  CaretRight,
  CircleNotch,
  FilePlus,
  ForkKnife,
  House,
  MagnifyingGlass,
  Moon,
  Plus,
  Sun,
  UserPlus,
} from '@phosphor-icons/react'
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
  if (pathname.startsWith('/contenido')) {
    return { area: 'Inicio', title: 'Contenido', actionHref: '/contenido', actionLabel: 'Nueva pieza', actionIcon: Plus }
  }
  if (pathname.startsWith('/agentes')) {
    return { area: 'Inicio', title: 'Revisión IA', actionHref: '/dashboard', actionLabel: 'Volver al dashboard', actionIcon: House }
  }
  if (pathname.startsWith('/entrenos/plantillas')) {
    return { area: 'Planes', title: 'Plantillas de entreno', actionHref: '/entrenos/nueva', actionLabel: 'Crear plan', actionIcon: Barbell }
  }
  if (pathname.startsWith('/entrenos/ejercicios')) {
    return { area: 'Planes', title: 'Biblioteca de ejercicios', actionHref: '/entrenos/nueva', actionLabel: 'Crear plan', actionIcon: Barbell }
  }
  if (pathname.startsWith('/entrenos')) {
    return { area: 'Entrenamiento', title: 'Training OS', actionHref: '/entrenos/nueva', actionLabel: 'Crear plan', actionIcon: Barbell }
  }
  if (pathname.startsWith('/nutricion')) {
    return { area: 'Nutrición', title: 'Dashboard nutrición', actionHref: '/dietas/nueva', actionLabel: 'Nueva dieta', actionIcon: ForkKnife }
  }
  if (pathname.startsWith('/compra')) {
    return { area: 'Compra y costes', title: 'Lista de la compra', actionHref: '/precios', actionLabel: 'Consultar precios', actionIcon: FilePlus }
  }
  if (pathname.startsWith('/dietas/plantillas')) {
    return { area: 'Planes', title: 'Plantillas de dieta', actionHref: '/dietas/nueva', actionLabel: 'Nueva dieta', actionIcon: ForkKnife }
  }
  if (pathname.startsWith('/dietas')) {
    return { area: 'Nutrición', title: 'Planes y alimentos', actionHref: '/dietas/nueva', actionLabel: 'Nueva dieta', actionIcon: ForkKnife }
  }
  if (pathname.startsWith('/recetas/cobertura')) {
    return { area: 'Recetario', title: 'Cobertura de recetas', actionHref: '/recetas/nueva', actionLabel: 'Nueva receta', actionIcon: Plus }
  }
  if (pathname.startsWith('/recetas/revisar')) {
    return { area: 'Recetario', title: 'Revisión de recetas', actionHref: '/recetas/nueva', actionLabel: 'Nueva receta', actionIcon: Plus }
  }
  if (pathname.startsWith('/recetas')) {
    return { area: 'Nutrición', title: 'Recetario', actionHref: '/recetas/nueva', actionLabel: 'Nueva receta', actionIcon: Plus }
  }
  if (pathname.startsWith('/precios/escandallo')) {
    return { area: 'Control', title: 'Coste de recetas', actionHref: '/recetas', actionLabel: 'Ver recetas', actionIcon: FilePlus }
  }
  if (pathname.startsWith('/precios/rentabilidad')) {
    return { area: 'Control', title: 'Rentabilidad por cliente', actionHref: '/clientes', actionLabel: 'Ver clientes', actionIcon: UserPlus }
  }
  if (pathname.startsWith('/precios')) {
    return { area: 'Compra y costes', title: 'Precios', actionHref: '/precios/escandallo', actionLabel: 'Coste de recetas', actionIcon: FilePlus }
  }
  if (pathname.startsWith('/ajustes') || pathname.startsWith('/sistema')) {
    return { area: 'Ajustes', title: 'Ajustes', actionHref: '/dashboard', actionLabel: 'Volver al dashboard', actionIcon: House }
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
  const context = getCoachContext(pathname)
  const ActionIcon = context.actionIcon
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="coach-atelier-topbar sticky top-0 z-20 px-4 sm:px-6 lg:px-8">
      <div className="coach-atelier-topbar__inner">
        <div className="coach-atelier-context min-w-0">
          <div className="coach-atelier-register hidden sm:flex" aria-label={`Coach OS, ${context.area}`}>
            <Link href="/dashboard" prefetch>Coach OS</Link>
            <CaretRight size={10} aria-hidden="true" />
            <span>{context.area}</span>
          </div>
          <span className="coach-atelier-context__rule hidden sm:block" aria-hidden="true" />
          <p className="coach-atelier-context__title">{context.title}</p>
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
          <Link href={context.actionHref} prefetch className="coach-atelier-primary-action">
            <ActionIcon size={14} />
            <span>{context.actionLabel}</span>
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
        <CircleNotch size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="coach-atelier-shell flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <CoachFloatingControls />
      <main className="coach-atelier-main flex-1 overflow-auto pb-nav-safe layout-main">
        {pathname !== '/clientes' && <CoachTopBar pathname={pathname || '/dashboard'} />}
        {padded ? <div className="p-6 max-w-[120rem] mx-auto">{children}</div> : children}
      </main>
    </div>
  )
}
