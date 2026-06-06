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

function getCoachContext(pathname: string): CoachContext {
  if (pathname.startsWith('/clientes')) {
    return { area: 'Inicio', title: 'Clientes', actionHref: '/clientes/nuevo', actionLabel: 'Nuevo cliente', actionIcon: UserPlus }
  }
  if (pathname.startsWith('/agentes')) {
    return { area: 'Sistema', title: 'Revisión IA', actionHref: '/dashboard', actionLabel: 'Volver al dashboard', actionIcon: Home }
  }
  if (pathname.startsWith('/entrenos')) {
    return { area: 'Entrenamiento', title: 'Training OS', actionHref: '/entrenos/nueva', actionLabel: 'Crear plan', actionIcon: Dumbbell }
  }
  if (pathname.startsWith('/dietas') || pathname.startsWith('/compra')) {
    return { area: 'Nutrición', title: 'Planes y alimentos', actionHref: '/dietas/nueva', actionLabel: 'Nueva dieta', actionIcon: Utensils }
  }
  if (pathname.startsWith('/recetas')) {
    return { area: 'Nutrición', title: 'Recetario', actionHref: '/recetas/nueva', actionLabel: 'Nueva receta', actionIcon: Plus }
  }
  if (pathname.startsWith('/precios')) {
    return { area: 'Nutrición', title: 'Costes y rentabilidad', actionHref: '/precios/escandallo', actionLabel: 'Escandallo', actionIcon: FilePlus2 }
  }
  if (pathname.startsWith('/conocimiento') || pathname.startsWith('/coach') || pathname.startsWith('/cuestionarios')) {
    return { area: 'Sistema', title: 'Método y conocimiento', actionHref: '/conocimiento/nueva', actionLabel: 'Nueva nota', actionIcon: Plus }
  }
  return { area: 'Inicio', title: 'Dashboard', actionHref: '/clientes/nuevo', actionLabel: 'Nuevo cliente', actionIcon: UserPlus }
}

function CoachFloatingControls() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="fixed right-3 z-30 flex gap-2 lg:hidden" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
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

function CoachTopBar({ pathname }: { pathname: string }) {
  const context = getCoachContext(pathname)
  const ActionIcon = context.actionIcon

  return (
    <div
      className="sticky top-0 z-20 border-b px-4 py-3 sm:px-6 lg:px-8"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            <Link href="/dashboard" className="transition-colors hover:text-[var(--text)]">
              Coach OS
            </Link>
            <ChevronRight size={12} />
            <span>{context.area}</span>
          </div>
          <h1 className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl" style={{ color: 'var(--text)' }}>
            {context.title}
          </h1>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div
            className="hidden h-10 min-w-[260px] items-center gap-2 rounded-2xl border px-3 lg:flex"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            <Search size={15} />
            <span className="truncate text-sm">Buscar cliente, plan o tarea</span>
            <span className="ml-auto rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: 'var(--border)' }}>
              global
            </span>
          </div>
          <Link href={context.actionHref} className="btn btn-primary btn-sm">
            <ActionIcon size={14} />
            {context.actionLabel}
          </Link>
        </div>
      </div>
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
        <CoachTopBar pathname={pathname || '/dashboard'} />
        {padded ? <div className="p-6 max-w-5xl mx-auto">{children}</div> : children}
      </main>
    </div>
  )
}
