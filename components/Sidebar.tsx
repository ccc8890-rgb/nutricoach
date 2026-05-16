'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  Dumbbell,
  LogOut,
  BookOpen,
  ClipboardList,
  MessageSquareReply,
  ChevronRight,
  ChevronDown,
  LayoutTemplate,
  Sun,
  Moon,
  Apple,
  Sandwich,
  Calendar,
  BrainCircuit,
  FlaskConical,
  Receipt,
  Menu,
  X,
  Store,
  ShoppingCart,
  Clock,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { useNotificaciones } from '@/lib/useNotificaciones'
import { useTheme } from '@/components/ThemeProvider'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/respuestas', label: 'Consulta', icon: MessageSquareReply },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/cuestionarios', label: 'Cuestionarios', icon: ClipboardList },
  { href: '/conocimiento', label: 'Conocimiento', icon: BrainCircuit },
  { href: '/ia-test', label: 'Probador IA', icon: FlaskConical },
]

const ENTRENOS_SUBITEMS = [
  { href: '/entrenos', label: 'Planes', icon: Dumbbell },
  { href: '/entrenos/plantillas', label: 'Planificación', icon: Calendar },
  { href: '/entrenos/generar-ia', label: 'Generar con IA', icon: BrainCircuit },
]

const NUTRICION_SUBITEMS = [
  { href: '/dietas/plantillas', label: 'Planes nutricionales', icon: LayoutTemplate },
  { href: '/dietas', label: 'Dietas activas', icon: Apple },
  { href: '/dietas/alimentos', label: 'Alimentos', icon: Sandwich },
  { href: '/recetas', label: 'Recetario', icon: BookOpen },
  { href: '/recetas/cola', label: 'Pendientes', icon: Clock },
  { href: '/precios', label: 'Precios', icon: Store },
  { href: '/precios/scraping', label: 'Scraping', icon: ShoppingCart },
  { href: '/precios/escandallo', label: 'Escandallo', icon: Receipt },
  { href: '/precios/rentabilidad', label: 'Rentabilidad', icon: TrendingUp },
  { href: '/precios/enriquecer', label: 'Enriquecer', icon: Sparkles },
  { href: '/compra', label: 'Lista de la compra', icon: ShoppingCart },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { noLeidas } = useNotificaciones()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [recetasPendientes, setRecetasPendientes] = useState(0)

  // Cerrar mobile al navegar
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

  const sidebarContent = (
    <>
      {/* Logo — glass premium con acento graphite + breathing glow */}
      <div
        className="flex-shrink-0 p-5 border-b"
        style={{ borderColor: 'var(--glass-border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold tracking-tight animate-breathe"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              color: '#1C1C1E',
            }}
          >
            CN
          </div>
          <div>
            <p
              className="font-bold leading-tight text-[15px]"
              style={{ color: 'var(--text)' }}
            >
              Casanova
            </p>
            <p
              className="text-[11px] font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Panel de coach
            </p>
          </div>
        </div>
      </div>

      {/* Navegación */}
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
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
                />
              )}
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{label}</span>
              {href === '/respuestas' && noLeidas > 0 && (
                <span
                  className="ml-auto text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                  style={{ background: 'var(--error)' }}
                >
                  {noLeidas > 99 ? '99+' : noLeidas}
                </span>
              )}
              {isActive && href !== '/respuestas' && (
                <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--accent)' }} />
              )}
            </Link>
          )
        })}

        {/* Entrenos — sección colapsable */}
        <div className="mt-1">
          <button
            onClick={() => setEntrenosExpandido(!entrenosExpandido)}
            className={`sidebar-link w-full ${entrenosActiva ? 'active' : ''}`}
            style={entrenosActiva ? { position: 'relative', overflow: 'visible' } : {}}
          >
            {entrenosActiva && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
              />
            )}
            <Dumbbell size={18} strokeWidth={entrenosActiva ? 2.5 : 1.8} />
            <span>Entrenos</span>
            {entrenosExpandido ? (
              <ChevronDown size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
            )}
          </button>

          {entrenosExpandido && (
            <div
              className="ml-3 mt-0.5 border-l pl-3 space-y-0.5"
              style={{ borderColor: 'var(--border)' }}
            >
              {ENTRENOS_SUBITEMS.map(({ href, label, icon: Icon }) => {
                const isSubActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-link ${isSubActive ? 'active' : ''}`}
                    style={isSubActive ? { position: 'relative', overflow: 'visible' } : {}}
                  >
                    {isSubActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                        style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
                      />
                    )}
                    <Icon size={16} strokeWidth={isSubActive ? 2.5 : 1.8} />
                    <span>{label}</span>
                    {isSubActive && (
                      <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--accent)' }} />
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Nutrición — sección colapsable */}
        <div className="mt-1">
          <button
            onClick={() => setNutricionExpandido(!nutricionExpandido)}
            className={`sidebar-link w-full ${nutricionActiva ? 'active' : ''}`}
            style={nutricionActiva ? { position: 'relative', overflow: 'visible' } : {}}
          >
            {nutricionActiva && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
              />
            )}
            <UtensilsCrossed size={18} strokeWidth={nutricionActiva ? 2.5 : 1.8} />
            <span>Nutrición</span>
            {nutricionExpandido ? (
              <ChevronDown size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
            )}
          </button>

          {nutricionExpandido && (
            <div
              className="ml-3 mt-0.5 border-l pl-3 space-y-0.5"
              style={{ borderColor: 'var(--border)' }}
            >
              {NUTRICION_SUBITEMS.map(({ href, label, icon: Icon }) => {
                const isSubActive = pathname === href || pathname.startsWith(href + '/')
                const showBadge = href === '/recetas/cola' && recetasPendientes > 0
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-link ${isSubActive ? 'active' : ''}`}
                    style={isSubActive ? { position: 'relative', overflow: 'visible' } : {}}
                  >
                    {isSubActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                        style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
                      />
                    )}
                    <Icon size={16} strokeWidth={isSubActive ? 2.5 : 1.8} />
                    <span>{label}</span>
                    {showBadge && (
                      <span
                        className="ml-auto text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                        style={{ background: 'var(--error)' }}
                      >
                        {recetasPendientes > 99 ? '99+' : recetasPendientes}
                      </span>
                    )}
                    {isSubActive && !showBadge && (
                      <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--accent)' }} />
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Theme toggle + Logout — glass bottom */}
      <div
        className="flex-shrink-0 p-3 border-t space-y-1"
        style={{ borderColor: 'var(--glass-border)' }}
      >
        <button
          onClick={toggleTheme}
          className="sidebar-link w-full"
          style={{ color: 'var(--text-muted)' }}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
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

  // Para evitar hydration mismatch, el botón hamburguesa y overlay
  // se renderizan con suppressHydrationWarning hasta que el cliente tome control
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <>
      {/* Botón hamburguesa — visible solo en mobile */}
      {mounted && (
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            background: mobileOpen ? 'var(--surface)' : 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {mobileOpen ? <X size={18} style={{ color: 'var(--text)' }} /> : <Menu size={18} style={{ color: 'var(--text)' }} />}
        </button>
      )}

      {/* Overlay para mobile */}
      {mounted && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar desktop (siempre visible) + mobile (toggle) */}
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
        }}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
