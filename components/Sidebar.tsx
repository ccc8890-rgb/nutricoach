'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  House,
  ChatTeardrop,
  Users,
  BookOpen,
  ForkKnife,
  Barbell,
  ClipboardText,
  Brain,
  Flask,
  SignOut,
  Sun,
  Moon,
  List,
  X,
  Storefront,
  ShoppingCart,
  Clock,
  CaretRight,
  CaretDown,
  CalendarBlank,
  SquaresFour,
  TrendUp,
  Receipt,
  Scales,
} from '@phosphor-icons/react'
import { useNotificaciones } from '@/lib/useNotificaciones'
import { useTheme } from '@/components/ThemeProvider'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: House },
  { href: '/respuestas', label: 'Consulta', icon: ChatTeardrop },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/cuestionarios', label: 'Cuestionarios', icon: ClipboardText },
  { href: '/conocimiento', label: 'Conocimiento', icon: Brain },
  { href: '/ia-test', label: 'Probador IA', icon: Flask },
]

const BOTTOM_TAB_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: House },
  { href: '/respuestas', label: 'Consulta', icon: ChatTeardrop },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/dietas/plantillas', label: 'Dietas', icon: Scales },
  { href: '/recetas', label: 'Recetas', icon: BookOpen },
]

const ENTRENOS_SUBITEMS = [
  { href: '/entrenos', label: 'Planes', icon: Barbell },
  { href: '/entrenos/plantillas', label: 'Planificación', icon: CalendarBlank },
  { href: '/entrenos/generar-ia', label: 'Generar con IA', icon: Brain },
]

const NUTRICION_SUBITEMS = [
  { href: '/dietas/plantillas', label: 'Planes nutricionales', icon: SquaresFour },
  { href: '/dietas', label: 'Dietas activas', icon: Scales },
  { href: '/dietas/alimentos', label: 'Alimentos', icon: ForkKnife },
  { href: '/recetas', label: 'Recetario', icon: BookOpen },
  { href: '/recetas/cola', label: 'Pendientes', icon: Clock },
  { href: '/precios', label: 'Precios', icon: Storefront },
  { href: '/precios/escandallo', label: 'Escandallo', icon: Receipt },
  { href: '/precios/rentabilidad', label: 'Rentabilidad', icon: TrendUp },
  { href: '/compra', label: 'Lista de la compra', icon: ShoppingCart },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { noLeidas } = useNotificaciones()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [recetasPendientes, setRecetasPendientes] = useState(0)

  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    supabase
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision')
      .then(({ count }) => { if (count) setRecetasPendientes(count) })
  }, [])

  const nutricionActiva = NUTRICION_SUBITEMS.some(
    s => pathname === s.href || pathname.startsWith(s.href + '/')
  )
  const [nutricionExpandido, setNutricionExpandido] = useState(nutricionActiva)

  const entrenosActiva = ENTRENOS_SUBITEMS.some(
    s => pathname === s.href || pathname.startsWith(s.href + '/')
  )
  const [entrenosExpandido, setEntrenosExpandido] = useState(entrenosActiva)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node) && mobileOpen) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileOpen])

  const sidebarContent = (
    <>
      <div
        className="flex-shrink-0 p-5 border-b"
        style={{ borderColor: 'var(--glass-border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              color: '#1C1C1E',
            }}
          >
            CN
          </div>
          <div>
            <p className="font-semibold leading-tight text-[14px]" style={{ color: 'var(--text)' }}>
              Casanova
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Panel de coach
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              style={isActive ? { position: 'relative', overflow: 'visible' } : {}}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
              <span>{label}</span>
              {href === '/respuestas' && noLeidas > 0 && (
                <span
                  className="ml-auto text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                  style={{ background: 'var(--error)' }}
                >
                  {noLeidas > 99 ? '99+' : noLeidas}
                </span>
              )}
            </Link>
          )
        })}

        <div className="mt-1">
          <button
            onClick={() => setEntrenosExpandido(!entrenosExpandido)}
            className={`sidebar-link w-full ${entrenosActiva ? 'active' : ''}`}
            style={entrenosActiva ? { position: 'relative', overflow: 'visible' } : {}}
          >
            {entrenosActiva && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
            <Barbell size={18} weight={entrenosActiva ? 'fill' : 'regular'} />
            <span>Entrenos</span>
            {entrenosExpandido
              ? <CaretDown size={12} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
              : <CaretRight size={12} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
            }
          </button>
          {entrenosExpandido && (
            <div className="ml-3 mt-0.5 border-l pl-3 space-y-0.5" style={{ borderColor: 'var(--border)' }}>
              {ENTRENOS_SUBITEMS.map(({ href, label, icon: Icon }) => {
                const isSubActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-link ${isSubActive ? 'active' : ''}`}
                  >
                    <Icon size={16} weight={isSubActive ? 'fill' : 'regular'} />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-1">
          <button
            onClick={() => setNutricionExpandido(!nutricionExpandido)}
            className={`sidebar-link w-full ${nutricionActiva ? 'active' : ''}`}
            style={nutricionActiva ? { position: 'relative', overflow: 'visible' } : {}}
          >
            {nutricionActiva && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
            <ForkKnife size={18} weight={nutricionActiva ? 'fill' : 'regular'} />
            <span>Nutrición</span>
            {nutricionExpandido
              ? <CaretDown size={12} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
              : <CaretRight size={12} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
            }
          </button>
          {nutricionExpandido && (
            <div className="ml-3 mt-0.5 border-l pl-3 space-y-0.5" style={{ borderColor: 'var(--border)' }}>
              {NUTRICION_SUBITEMS.map(({ href, label, icon: Icon }) => {
                const isSubActive = pathname === href || pathname.startsWith(href + '/')
                const showBadge = href === '/recetas/cola' && recetasPendientes > 0
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-link ${isSubActive ? 'active' : ''}`}
                  >
                    <Icon size={16} weight={isSubActive ? 'fill' : 'regular'} />
                    <span>{label}</span>
                    {showBadge && (
                      <span
                        className="ml-auto text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--error)' }}
                      >
                        {recetasPendientes > 99 ? '99+' : recetasPendientes}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      <div
        className="flex-shrink-0 p-3 border-t space-y-1"
        style={{ borderColor: 'var(--glass-border)' }}
      >
        <button
          onClick={toggleTheme}
          className="sidebar-link w-full"
          style={{ color: 'var(--text-muted)' }}
        >
          {theme === 'dark'
            ? <Sun size={18} weight="regular" />
            : <Moon size={18} weight="regular" />
          }
          <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        <button onClick={handleLogout} className="sidebar-link w-full" style={{ color: 'var(--text-muted)' }}>
          <SignOut size={18} weight="regular" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <>
      {/* ── Mobile: fila de controles superior ── */}
      {mounted && (
        <div className="fixed top-3 left-0 right-0 z-50 lg:hidden flex items-center justify-between px-3 pointer-events-none">

          {/* Botón volver — siempre visible si no es raíz */}
          <button
            onClick={() => router.back()}
            className="pointer-events-auto w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.3)',
            }}
            aria-label="Volver"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 13L5 8L10 3" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Pill derecho: tema + menú */}
          <div
            className="pointer-events-auto flex items-center gap-1 rounded-2xl p-1"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ color: 'var(--text-secondary)' }}
              aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark'
                ? <Sun size={16} weight="regular" />
                : <Moon size={16} weight="regular" />
              }
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ color: 'var(--text)' }}
              aria-label="Menú"
            >
              {mobileOpen
                ? <X size={16} weight="bold" />
                : <List size={16} weight="regular" />
              }
            </button>
          </div>
        </div>
      )}

      {/* Overlay */}
      {mounted && mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sheetRef}
        className={`
          relative w-64 min-h-screen flex flex-col border-r overflow-hidden
          transition-transform duration-300
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40
          ${mounted && mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
        `}
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          transitionTimingFunction: 'var(--ease-drawer)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile: Bottom Tab Bar ── */}
      {mounted && (
        <nav
          className="lg:hidden"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderTop: '1px solid var(--glass-border)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: 72,
              padding: '0 4px',
            }}
          >
            {BOTTOM_TAB_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              const showBadge = href === '/respuestas' && noLeidas > 0
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    textDecoration: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    position: 'relative',
                    padding: '8px 0',
                    transition: 'transform 0.12s var(--ease-out-strong)',
                  }}
                  onPointerDown={e => {
                    const el = e.currentTarget
                    el.style.transform = 'scale(0.88)'
                    const up = () => { el.style.transform = ''; document.removeEventListener('pointerup', up) }
                    document.addEventListener('pointerup', up)
                  }}
                >
                  {/* Pill activo detrás del icono */}
                  {isActive && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -60%)',
                        width: 48,
                        height: 32,
                        borderRadius: 12,
                        background: 'var(--accent-bg)',
                        border: '1px solid var(--accent-ring)',
                      }}
                    />
                  )}

                  {/* Icono */}
                  <span style={{ position: 'relative' }}>
                    <Icon
                      size={26}
                      weight={isActive ? 'fill' : 'regular'}
                      style={{
                        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                        transition: 'color 0.18s var(--ease-out-strong)',
                        display: 'block',
                      }}
                    />
                    {showBadge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -2,
                          right: -4,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--error)',
                          border: '1.5px solid var(--bg)',
                        }}
                      />
                    )}
                  </span>

                  {/* Label */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                      transition: 'color 0.18s var(--ease-out-strong)',
                      letterSpacing: isActive ? '-0.01em' : 0,
                      lineHeight: 1,
                    }}
                  >
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </>
  )
}
