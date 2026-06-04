'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Bot,
  Brain,
  ChefHat,
  ChartPie,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  Dumbbell,
  House,
  Images,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
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
  href: string
  label: string
  icon: LucideIcon
  badge?: number
}

type NavSection = {
  key: string
  label: string
  icon: LucideIcon
  items: NavItem[]
  badge?: number
}

const PRIMARY_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Radar', icon: House },
  { href: '/clientes', label: 'Clientes', icon: UsersRound },
  { href: '/agentes', label: 'Inbox IA', icon: Bot },
  { href: '/entrenos', label: 'Entrenamiento', icon: Dumbbell },
]

const NUTRICION_ITEMS: NavItem[] = [
  { href: '/dietas', label: 'Dietas activas', icon: Utensils },
  { href: '/dietas/plantillas', label: 'Plantillas', icon: ListChecks },
  { href: '/dietas/alimentos', label: 'Alimentos', icon: Database },
  { href: '/compra', label: 'Lista compra', icon: ShoppingCart },
  { href: '/precios', label: 'Precios', icon: Store },
  { href: '/precios/escandallo', label: 'Escandallo', icon: TrendingUp },
  { href: '/precios/rentabilidad', label: 'Rentabilidad', icon: Activity },
]


const RECETARIO_ITEMS: NavItem[] = [
  { href: '/recetas', label: 'Biblioteca', icon: ChefHat },
  { href: '/recetas/cobertura', label: 'Cobertura', icon: ChartPie },
  { href: '/recetas/imagenes', label: 'Imágenes', icon: Images },
  { href: '/recetas/cola', label: 'Pendientes', icon: ClipboardList },
  { href: '/recetas/revisar', label: 'Revisión', icon: ListChecks },
]

const CONOCIMIENTO_ITEMS: NavItem[] = [
  { href: '/coach/metodologia', label: 'Metodología', icon: SlidersHorizontal },
  { href: '/conocimiento', label: 'Base de conocimiento', icon: Brain },
]

const EXTRA_ITEMS: NavItem[] = [
  { href: '/cuestionarios', label: 'Cuestionarios', icon: ClipboardList },
]

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
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
  const active = isActivePath(pathname, item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
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

function SidebarSection({
  section,
  pathname,
  expanded,
  onToggle,
}: {
  section: NavSection
  pathname: string
  expanded: boolean
  onToggle: () => void
}) {
  const active = section.items.some(item => isActivePath(pathname, item.href))
  const Icon = section.icon

  return (
    <div className="mt-1">
      <button
        onClick={onToggle}
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
          <ChevronDown size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {expanded && (
        <div className="ml-3 mt-1 border-l pl-3 space-y-0.5" style={{ borderColor: 'var(--border)' }}>
          {section.items.map(item => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              badgeTone={item.href === '/recetas/cola' ? 'danger' : 'accent'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { noLeidas } = useNotificaciones()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [recetasPendientes, setRecetasPendientes] = useState(0)
  const [agentesPendientes, setAgentesPendientes] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    supabase
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision')
      .then(({ count }) => setRecetasPendientes(count ?? 0))

    const fetchAgentes = () => {
      supabase
        .from('agente_tareas')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente')
        .then(({ count }) => setAgentesPendientes(count ?? 0))
    }
    fetchAgentes()
    const interval = setInterval(fetchAgentes, 60_000)
    return () => clearInterval(interval)
  }, [])

  const primaryItems = PRIMARY_ITEMS.map(item => {
    if (item.href === '/agentes') return { ...item, badge: agentesPendientes }
    if (item.href === '/clientes') return { ...item, badge: noLeidas }
    return item
  })

  const sections: NavSection[] = [
    { key: 'nutricion', label: 'Nutrición', icon: Utensils, items: NUTRICION_ITEMS },
    {
      key: 'recetario',
      label: 'Recetario',
      icon: ChefHat,
      badge: recetasPendientes,
      items: RECETARIO_ITEMS.map(item => item.href === '/recetas/cola' ? { ...item, badge: recetasPendientes } : item),
    },
    { key: 'conocimiento', label: 'Conocimiento', icon: Brain, items: CONOCIMIENTO_ITEMS },
  ]

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const section of sections) {
      initial[section.key] = section.items.some(item => isActivePath(pathname, item.href))
    }
    return initial
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarContent = (
    <>
      <div className="flex-shrink-0 p-5 border-b" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black tracking-tight"
            style={{
              background: 'var(--text)',
              color: 'var(--bg)',
            }}
          >
            CN
          </div>
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
              badgeTone={item.href === '/respuestas' ? 'danger' : 'accent'}
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
            onToggle={() => setExpanded(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
          />
        ))}

        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
          {EXTRA_ITEMS.map(item => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
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
    </>
  )
}
