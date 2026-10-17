'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, type ElementType } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Barbell,
  BookOpenText,
  CaretDown,
  CaretRight,
  ChartLineUp,
  ChartPieSlice,
  ClipboardText,
  Database,
  FilmSlate,
  ForkKnife,
  Gear,
  House,
  List,
  Moon,
  ShoppingCart,
  SidebarSimple,
  SignOut,
  Storefront,
  Sun,
  TrendUp,
  UsersThree,
  X,
} from '@phosphor-icons/react'
import { useNotificaciones } from '@/lib/useNotificaciones'
import { useTheme } from '@/components/ThemeProvider'

type NavItem = {
  type?: 'item'
  href: string
  label: string
  icon: ElementType
  badge?: number
  exact?: boolean
}

type NavGroup = {
  type: 'group'
  key: string
  label: string
  icon: ElementType
  badge?: number
  items: NavItem[]
}

type NavEntry = NavItem | NavGroup

type NavSection = {
  key: string
  label: string
  href: string
  icon: ElementType
  items: NavEntry[]
  badge?: number
}

const PRIMARY_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: House },
  { href: '/clientes', label: 'Clientes', icon: UsersThree },
  { href: '/contenido', label: 'Contenido', icon: FilmSlate },
]

const PLANES_ITEMS: NavItem[] = [
  { href: '/dietas/plantillas', label: 'Plantillas de dieta', icon: ForkKnife },
  { href: '/entrenos/plantillas', label: 'Plantillas de entreno', icon: Barbell },
  { href: '/entrenos/ejercicios', label: 'Ejercicios', icon: Database },
]

const RECETARIO_ITEMS: NavItem[] = [
  { href: '/recetas', label: 'Recetas', icon: BookOpenText, exact: true },
  { href: '/dietas/alimentos', label: 'Alimentos', icon: Database },
  { href: '/recetas/revisar', label: 'Revisión', icon: ClipboardText },
]

const COMPRA_ITEMS: NavItem[] = [
  { href: '/compra', label: 'Lista compra', icon: ShoppingCart },
  { href: '/precios', label: 'Precios', icon: Storefront, exact: true },
]

// Pantallas de control, que se miran de vez en cuando
const CONTROL_ITEMS: NavItem[] = [
  { href: '/recetas/cobertura', label: 'Cobertura de recetas', icon: ChartPieSlice },
  { href: '/precios/escandallo', label: 'Coste de recetas', icon: TrendUp },
  { href: '/precios/rentabilidad', label: 'Rentabilidad por cliente', icon: ChartLineUp },
]

// Ajustes agrupa también estas pantallas (Método y conocimiento)
const AJUSTES_PREFIJOS = ['/ajustes', '/sistema', '/coach', '/conocimiento', '/cuestionarios']

function AccionIcono({ label, icon: Icon, href, onClick, activo = false }: {
  label: string
  icon: ElementType
  href?: string
  onClick?: () => void
  activo?: boolean
}) {
  const clases = 'group relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)] focus-visible:bg-[var(--surface)]'
  const estilo = { color: activo ? 'var(--text)' : 'var(--text-muted)', background: activo ? 'var(--surface)' : undefined }
  const tooltip = (
    <span
      role="tooltip"
      className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' }}
    >
      {label}
    </span>
  )
  if (href) {
    return (
      <Link href={href} prefetch className={clases} style={estilo} aria-label={label} aria-current={activo ? 'page' : undefined}>
        <Icon size={17} />
        {tooltip}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={clases} style={estilo} aria-label={label}>
      <Icon size={17} />
      {tooltip}
    </button>
  )
}

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
      <Icon size={18} weight={active ? 'bold' : 'regular'} />
      <span className="truncate">{item.label}</span>
      {item.badge ? <Badge value={item.badge} tone={badgeTone} /> : null}
      {active && !item.badge && (
        <CaretRight size={14} className="ml-auto" style={{ color: 'var(--accent)' }} />
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
                <GroupIcon size={14} weight="regular" style={{ color: 'var(--text-muted)' }} />
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
        <Icon size={18} weight={active ? 'bold' : 'regular'} />
        <span>{section.label}</span>
        {section.badge ? <Badge value={section.badge} tone="danger" /> : null}
        {expanded ? (
          <>
            <CaretRight size={14} className="ml-auto hidden xl:block" style={{ color: 'var(--text-muted)' }} />
            <CaretDown size={14} className="ml-auto xl:hidden" style={{ color: 'var(--text-muted)' }} />
          </>
        ) : (
          <CaretRight size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
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

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' }}
    >
      {label}
    </span>
  )
}

function RailButton({ label, icon: Icon, href, onClick, active = false, badge = 0 }: {
  label: string
  icon: ElementType
  href?: string
  onClick?: () => void
  active?: boolean
  badge?: number
}) {
  const clases = `sidebar-link group relative !h-11 !w-11 !justify-center !gap-0 !p-0 ${active ? 'active' : ''}`
  const contenido = (
    <>
      <Icon size={20} weight={active ? 'bold' : 'regular'} />
      {badge > 0 && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ background: 'var(--error)' }} />
      )}
      <RailTooltip label={label} />
    </>
  )
  if (href) {
    return (
      <Link href={href} prefetch className={clases} aria-label={label} aria-current={active ? 'page' : undefined}>
        {contenido}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={clases} aria-label={label}>
      {contenido}
    </button>
  )
}

function RailSection({ section, pathname }: { section: NavSection; pathname: string }) {
  const active = isActiveSection(pathname, section)
  const Icon = section.icon

  return (
    <div className="group/flyout relative">
      <RailButton label={section.label} icon={Icon} href={section.href} active={active} badge={section.badge} />
      <div className="invisible absolute left-full top-0 z-50 pl-3 opacity-0 transition-opacity group-hover/flyout:visible group-hover/flyout:opacity-100 group-focus-within/flyout:visible group-focus-within/flyout:opacity-100">
        <div
          className="max-h-[80vh] w-64 overflow-y-auto rounded-xl border p-3"
          style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
            {section.label}
          </p>
          <SectionPanelContent section={section} pathname={pathname} />
        </div>
      </div>
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
  const [mounted, setMounted] = useState(false)
  // Escritorio: barra compacta por defecto; la elección del coach se recuerda en este navegador
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    setMounted(true)
    try {
      const guardado = localStorage.getItem('nutricoach:sidebar')
      if (guardado) setCollapsed(guardado === 'compacta')
    } catch {}
  }, [])

  function alternarBarra() {
    setCollapsed(previo => {
      const siguiente = !previo
      try { localStorage.setItem('nutricoach:sidebar', siguiente ? 'compacta' : 'ancha') } catch {}
      return siguiente
    })
  }
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

  const sections: NavSection[] = [
    { key: 'planes', label: 'Planes', href: '/dietas/plantillas', icon: ClipboardText, items: PLANES_ITEMS },
    {
      key: 'recetario', label: 'Recetario', href: '/recetas', icon: BookOpenText, badge: recetasPendientes,
      items: RECETARIO_ITEMS.map(item => item.href === '/recetas/revisar' ? { ...item, badge: recetasPendientes } : item),
    },
    { key: 'compra', label: 'Compra y costes', href: '/compra', icon: ShoppingCart, items: COMPRA_ITEMS },
    { key: 'control', label: 'Control', href: '/recetas/cobertura', icon: ChartLineUp, items: CONTROL_ITEMS },
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

  const ajustesActivo = AJUSTES_PREFIJOS.some(prefijo => isActivePath(pathname, prefijo))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarContent = (
    <>
      <div className="flex-shrink-0 border-b px-3 py-3" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            prefetch
            className="coach-atelier-mark w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black tracking-tight"
            style={{
              background: 'var(--text)',
              color: 'var(--bg)',
            }}
            aria-label="Volver a Inicio"
          >
            CN
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight text-[15px] tracking-[-0.025em]" style={{ color: 'var(--text)' }}>
              Casanova Lab
            </p>
          </div>
          <AccionIcono label="Contraer barra" onClick={alternarBarra} icon={SidebarSimple} />
        </div>
        <div className="mt-2 flex items-center justify-end gap-0.5 border-t pt-2" style={{ borderColor: 'var(--glass-border)' }}>
            <AccionIcono
              label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              onClick={toggleTheme}
              icon={theme === 'dark' ? Sun : Moon}
            />
            <AccionIcono label="Ajustes" href="/ajustes" icon={Gear} activo={ajustesActivo} />
            <AccionIcono label="Cerrar sesión" onClick={handleLogout} icon={SignOut} />
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

    </>
  )

  const railContent = (
    <>
      <div className="flex flex-shrink-0 justify-center border-b py-4" style={{ borderColor: 'var(--glass-border)' }}>
        <Link
          href="/dashboard"
          prefetch
          className="coach-atelier-mark flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black tracking-tight"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
          aria-label="Volver a Inicio"
        >
          CN
        </Link>
      </div>

      <div className="flex flex-shrink-0 flex-col items-center gap-1 border-b py-3" style={{ borderColor: 'var(--glass-border)' }}>
        <RailButton label="Ampliar barra" icon={SidebarSimple} onClick={alternarBarra} />
        <RailButton label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} icon={theme === 'dark' ? Sun : Moon} onClick={toggleTheme} />
        <RailButton label="Ajustes" icon={Gear} href="/ajustes" active={ajustesActivo} />
        <RailButton label="Cerrar sesión" icon={SignOut} onClick={handleLogout} />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1 py-3">
        {primaryItems.map(item => (
          <RailButton
            key={item.href}
            label={item.label}
            icon={item.icon}
            href={item.href}
            active={isActivePath(pathname, item.href, item.exact)}
            badge={item.badge}
          />
        ))}
        <div className="my-1 h-px w-8" style={{ background: 'var(--glass-border)' }} />
        {sections.map(section => (
          <RailSection key={section.key} section={section} pathname={pathname || '/dashboard'} />
        ))}
      </nav>

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
          {mobileOpen ? <X size={18} style={{ color: 'var(--text)' }} /> : <List size={18} style={{ color: 'var(--text)' }} />}
        </button>
      )}

      {mounted && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`coach-atelier-sidebar
          relative w-64 min-h-screen flex flex-col border-r
          ${collapsed ? 'lg:w-[4.5rem] lg:overflow-visible max-lg:overflow-hidden' : 'overflow-hidden'}
          transition-transform duration-300 ease-out
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40
          ${mounted && mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
        `}
        style={{
          background: 'color-mix(in srgb, var(--surface) 92%, var(--bg))',
          borderColor: 'var(--glass-border)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className={collapsed ? 'flex min-h-0 flex-1 flex-col lg:hidden' : 'flex min-h-0 flex-1 flex-col'}>
          {sidebarContent}
        </div>
        {collapsed && <div className="hidden min-h-0 flex-1 flex-col lg:flex">{railContent}</div>}
      </aside>
    </>
  )
}
