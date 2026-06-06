'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Brain,
  ChefHat,
  ChartPie,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  Dumbbell,
  FilePlus2,
  House,
  Images,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Sun,
  TrendingUp,
  Utensils,
  UsersRound,
  X,
} from 'lucide-react'
import { useNotificaciones } from '@/lib/useNotificaciones'
import { useTheme } from '@/components/ThemeProvider'

type NavItem = {
  type?: 'item'
  href: string
  label: string
  icon: LucideIcon
  badge?: number
  exact?: boolean
}

type NavGroup = {
  type: 'group'
  key: string
  label: string
  icon: LucideIcon
  badge?: number
  items: NavItem[]
}

type NavEntry = NavItem | NavGroup

type NavSection = {
  key: string
  label: string
  href: string
  icon: LucideIcon
  items: NavEntry[]
  badge?: number
}

const PRIMARY_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: House },
  { href: '/clientes', label: 'Clientes', icon: UsersRound },
]

const NUTRICION_ITEMS: NavItem[] = [
  { href: '/nutricion', label: 'Dashboard', icon: House, exact: true },
  { href: '/dietas', label: 'Planes activos', icon: Utensils, exact: true },
  { href: '/dietas/plantillas', label: 'Plantillas', icon: ListChecks },
]

const ENTRENAMIENTO_ITEMS: NavItem[] = [
  { href: '/entrenos', label: 'Dashboard', icon: Dumbbell, exact: true },
  { href: '/entrenos/brain-ia', label: 'Revisión IA', icon: Brain },
  { href: '/entrenos/nueva', label: 'Crear plan', icon: FilePlus2 },
  { href: '/entrenos/generar-ia', label: 'Plan con IA', icon: Sparkles },
  { href: '/entrenos/plantillas', label: 'Plantillas', icon: ListChecks },
  { href: '/entrenos/ejercicios', label: 'Ejercicios', icon: Database },
]


const RECETARIO_ITEMS: NavItem[] = [
  { href: '/dietas/alimentos', label: 'Alimentos', icon: Database },
  { href: '/recetas', label: 'Recetas', icon: ChefHat, exact: true },
  { href: '/recetas/cobertura', label: 'Cobertura', icon: ChartPie },
  { href: '/recetas/imagenes', label: 'Imágenes', icon: Images },
  { href: '/recetas/cola', label: 'Pendientes', icon: ClipboardList },
  { href: '/recetas/revisar', label: 'Revisión', icon: ListChecks },
]

const COSTES_COMPRA_ITEMS: NavItem[] = [
  { href: '/compra', label: 'Lista compra', icon: ShoppingCart },
  { href: '/precios', label: 'Precios', icon: Store },
  { href: '/precios/escandallo', label: 'Escandallo', icon: TrendingUp },
  { href: '/precios/rentabilidad', label: 'Rentabilidad', icon: Activity },
]

const CONOCIMIENTO_ITEMS: NavItem[] = [
  { href: '/sistema', label: 'Dashboard', icon: House, exact: true },
  { href: '/coach/metodologia', label: 'Metodología', icon: SlidersHorizontal },
  { href: '/conocimiento', label: 'Base de conocimiento', icon: Brain },
  { href: '/cuestionarios', label: 'Cuestionarios', icon: ClipboardList },
]

function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

function isGroup(entry: NavEntry): entry is NavGroup {
  return entry.type === 'group'
}

function isActiveEntry(pathname: string, entry: NavEntry) {
  if (isGroup(entry)) {
    return entry.items.some(item => isActivePath(pathname, item.href, item.exact))
  }
  return isActivePath(pathname, entry.href, entry.exact)
}

function isActiveSection(pathname: string, section: NavSection) {
  return isActivePath(pathname, section.href, true) || section.items.some(entry => isActiveEntry(pathname, entry))
}

function collectEntryHrefs(entry: NavEntry): string[] {
  if (isGroup(entry)) return entry.items.map(item => item.href)
  return [entry.href]
}

function Badge({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'danger' }) {
  if (value <= 0) return null
  return (
    <span
      className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
      style={{
        background: tone === 'danger' ? 'var(--error)' : 'var(--accent)',
        color: tone === 'danger' ? '#ffffff' : 'var(--bg)',
      }}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

function NavLink({
  item,
  pathname,
  badgeTone,
}: {
  item: NavItem
  pathname: string
  badgeTone?: 'accent' | 'danger'
}) {
  const active = isActivePath(pathname, item.href, item.exact)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      prefetch
      className={`sidebar-link ${active ? 'active' : ''}`}
      style={active ? { position: 'relative', overflow: 'visible' } : undefined}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-5 rounded-full"
          style={{ background: 'var(--accent)' }}
        />
      )}
      <Icon size={18} strokeWidth={active ? 2.35 : 1.8} />
      <span className="truncate">{item.label}</span>
      {item.badge ? <Badge value={item.badge} tone={badgeTone} /> : null}
      {active && !item.badge && (
        <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--accent)' }} />
      )}
    </Link>
  )
}

function SectionPanelContent({
  section,
  pathname,
}: {
  section: NavSection
  pathname: string
}) {
  return (
    <div className="space-y-1">
      {section.items.map(entry => {
        if (isGroup(entry)) {
          const GroupIcon = entry.icon
          return (
            <div key={entry.key} className="pt-1">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <GroupIcon size={14} strokeWidth={1.9} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  {entry.label}
                </span>
                {entry.badge ? <Badge value={entry.badge} tone="danger" /> : null}
              </div>
              <div className="space-y-0.5">
                {entry.items.map(item => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    badgeTone={item.href === '/recetas/cola' ? 'danger' : 'accent'}
                  />
                ))}
              </div>
            </div>
          )
        }

        return (
          <NavLink
            key={entry.href}
            item={entry}
            pathname={pathname}
            badgeTone="accent"
          />
        )
      })}
    </div>
  )
}

function SidebarSection({
  section,
  pathname,
  expanded,
}: {
  section: NavSection
  pathname: string
  expanded: boolean
}) {
  const active = isActiveSection(pathname, section)
  const Icon = section.icon

  return (
    <div className="relative mt-1">
      <Link
        href={section.href}
        prefetch
        className={`sidebar-link w-full ${active ? 'active' : ''}`}
        style={active ? { position: 'relative', overflow: 'visible' } : undefined}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-5 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
        )}
        <Icon size={18} strokeWidth={active ? 2.35 : 1.8} />
        <span>{section.label}</span>
        {section.badge ? <Badge value={section.badge} tone="danger" /> : null}
        {expanded ? (
          <>
            <ChevronRight size={14} className="ml-auto hidden xl:block" style={{ color: 'var(--text-muted)' }} />
            <ChevronDown size={14} className="ml-auto xl:hidden" style={{ color: 'var(--text-muted)' }} />
          </>
        ) : (
          <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
        )}
      </Link>

      {expanded && (
        <div
          className="ml-3 mt-1 border-l pl-3 xl:hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          <SectionPanelContent section={section} pathname={pathname} />
        </div>
      )}
    </div>
  )
}

function SecondarySidebar({
  section,
  pathname,
}: {
  section: NavSection | null
  pathname: string
}) {
  if (!section) return null

  const Icon = section.icon

  return (
    <aside
      className="hidden w-64 min-h-screen flex-col border-r xl:flex"
      style={{
        background: 'color-mix(in srgb, var(--surface) 88%, var(--bg))',
        borderColor: 'var(--glass-border)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="flex-shrink-0 border-b p-5" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl border"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-elevated)',
              color: 'var(--text)',
            }}
          >
            <Icon size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
              Módulo activo
            </p>
            <h2 className="truncate text-[15px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
              {section.label}
            </h2>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <SectionPanelContent section={section} pathname={pathname} />
      </nav>
    </aside>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { noLeidas } = useNotificaciones()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [recetasPendientes, setRecetasPendientes] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    supabase
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision')
      .then(({ count }) => setRecetasPendientes(count ?? 0))

  }, [])

  const primaryItems = PRIMARY_ITEMS.map(item => {
    if (item.href === '/clientes') return { ...item, badge: noLeidas }
    return item
  })

  const nutricionItems: NavEntry[] = [
    ...NUTRICION_ITEMS,
    {
      type: 'group',
      key: 'recetario',
      label: 'Recetario',
      icon: ChefHat,
      badge: recetasPendientes,
      items: RECETARIO_ITEMS.map(item => item.href === '/recetas/cola' ? { ...item, badge: recetasPendientes } : item),
    },
    {
      type: 'group',
      key: 'costes-compra',
      label: 'Costes y compra',
      icon: Store,
      items: COSTES_COMPRA_ITEMS,
    },
  ]

  const sections: NavSection[] = [
    { key: 'nutricion', label: 'Nutrición', href: '/nutricion', icon: Utensils, badge: recetasPendientes, items: nutricionItems },
    { key: 'entrenamiento', label: 'Entrenamiento', href: '/entrenos', icon: Dumbbell, items: ENTRENAMIENTO_ITEMS },
    { key: 'sistema', label: 'Sistema', href: '/sistema', icon: Settings, items: CONOCIMIENTO_ITEMS },
  ]

  useEffect(() => {
    const hrefs = new Set<string>([
      ...PRIMARY_ITEMS.map(item => item.href),
      ...sections.flatMap(section => [section.href, ...section.items.flatMap(collectEntryHrefs)]),
    ])

    hrefs.forEach(href => router.prefetch(href))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const section of sections) {
      initial[section.key] = isActiveSection(pathname, section)
    }
    return initial
  })

  useEffect(() => {
    setExpanded(() => {
      const next: Record<string, boolean> = {}

      for (const section of sections) {
        next[section.key] = isActiveSection(pathname, section)
      }

      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const selectedSection = sections.find(section => expanded[section.key]) ?? null

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarContent = (
    <>
      <div className="flex-shrink-0 p-5 border-b" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            prefetch
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black tracking-tight"
            style={{
              background: 'var(--text)',
              color: 'var(--bg)',
            }}
            aria-label="Volver a Inicio"
          >
            CN
          </Link>
          <div className="min-w-0">
            <p className="font-bold leading-tight text-[15px]" style={{ color: 'var(--text)' }}>
              Casanova
            </p>
            <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
              Health OS
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="ml-auto inline-flex h-8 items-center rounded-full border p-1 transition-colors"
            style={{
              borderColor: 'var(--glass-border)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
            }}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors"
              style={{
                background: theme === 'light' ? 'var(--surface-elevated)' : 'transparent',
                color: theme === 'light' ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              <Sun size={13} />
            </span>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors"
              style={{
                background: theme === 'dark' ? 'var(--surface-elevated)' : 'transparent',
                color: theme === 'dark' ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              <Moon size={13} />
            </span>
          </button>
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        <div className="mb-2">
          <p className="px-3 mb-1 text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--text-muted)' }}>
            Trabajo
          </p>
          {primaryItems.map(item => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              badgeTone="accent"
            />
          ))}
        </div>

        <p className="px-3 mt-2 mb-1 text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--text-muted)' }}>
          Módulos
        </p>
        {sections.map(section => (
          <SidebarSection
            key={section.key}
            section={section}
            pathname={pathname}
            expanded={expanded[section.key] ?? false}
          />
        ))}
      </nav>

      <div className="flex-shrink-0 p-3 border-t space-y-1" style={{ borderColor: 'var(--glass-border)' }}>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {mounted && (
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="fixed left-4 z-50 lg:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
            background: mobileOpen ? 'var(--surface)' : 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(12px)',
          }}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {mobileOpen ? <X size={18} style={{ color: 'var(--text)' }} /> : <Menu size={18} style={{ color: 'var(--text)' }} />}
        </button>
      )}

      {mounted && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          relative w-64 min-h-screen flex flex-col border-r overflow-hidden
          transition-transform duration-300 ease-out
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40
          ${mounted && mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
        `}
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {sidebarContent}
      </aside>

      <SecondarySidebar section={selectedSection} pathname={pathname || '/dashboard'} />
    </>
  )
}
