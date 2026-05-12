'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
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
  Sparkles,
  Scan,
  Receipt,
  Menu,
  X,
  Store,
  Bot,
  ShoppingCart,
  Clock,
  ChevronUp,
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

// Items para bottom tab bar (solo los principales)
const BOTTOM_TAB_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/respuestas', label: 'Consulta', icon: MessageSquareReply },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/dietas/plantillas', label: 'Dietas', icon: Apple },
  { href: '/recetas', label: 'Recetas', icon: BookOpen },
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
  { href: '/precios/scraping', label: 'Scraping', icon: Bot },
  { href: '/precios/enriquecer', label: 'Enriquecer IA', icon: Sparkles },
  { href: '/precios/browser-agent', label: 'Browser Agent', icon: Scan },
  { href: '/precios/escandallo', label: 'Escandallo', icon: Receipt },
  { href: '/compra', label: 'Lista de la compra', icon: ShoppingCart },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { noLeidas } = useNotificaciones()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [recetasPendientes, setRecetasPendientes] = useState(0)
  const [menuAbierto, setMenuAbierto] = useState<'entrenos' | 'nutricion' | null>(null)

  const sheetRef = useRef<HTMLDivElement>(null)

  // Cerrar mobile al navegar
  useEffect(() => { setMobileOpen(false); setMenuAbierto(null) }, [pathname])

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

  // Cerrar sheet al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node) && menuAbierto) {
        setMenuAbierto(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuAbierto])

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

  // Para evitar hydration mismatch
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <>
      {/* ════════════════════════════════════ */}
      {/* DESKTOP: Botón hamburguesa + sidebar */}
      {/* ════════════════════════════════════ */}

      {/* Botón menú — visible solo en mobile, a la derecha para no solapar botón volver */}
      {mounted && (
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="fixed top-4 right-4 z-50 lg:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            background: mobileOpen ? 'var(--surface)' : 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {mobileOpen ? <X size={18} style={{ color: 'var(--text)' }} /> : <Menu size={18} style={{ color: 'var(--text)' }} />}
        </button>
      )}

      {/* Overlay para mobile drawer */}
      {mounted && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar desktop (siempre visible) + mobile drawer */}
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

      {/* ════════════════════════════════════ */}
      {/* MOBILE: Bottom Tab Bar (iOS-style)  */}
      {/* ════════════════════════════════════ */}

      {mounted && (
        <nav className="bottom-nav lg:hidden">
          <div className="flex items-stretch">
            {BOTTOM_TAB_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              const showNotifBadge = href === '/respuestas' && noLeidas > 0
              return (
                <Link
                  key={href}
                  href={href}
                  className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                >
                  <div className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                    {showNotifBadge && (
                      <span
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                        style={{ background: 'var(--error)', color: 'white' }}
                      >
                        {noLeidas > 9 ? '9+' : noLeidas}
                      </span>
                    )}
                  </div>
                  <span>{label}</span>
                </Link>
              )
            })}

            {/* Botón "Más" — abre bottom sheet con resto de navegación */}
            <button
              onClick={() => setMenuAbierto(menuAbierto === 'nutricion' ? null : 'nutricion')}
              className={`bottom-nav-item ${menuAbierto ? 'active' : ''}`}
            >
              <UtensilsCrossed size={20} strokeWidth={menuAbierto ? 2.5 : 1.8} />
              <span>Más</span>
            </button>
          </div>
        </nav>
      )}

      {/* ════════════════════════════════════ */}
      {/* MOBILE: Bottom Sheet (iOS-style)    */}
      {/* ════════════════════════════════════ */}

      {/* Overlay del sheet */}
      {mounted && menuAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuAbierto(null)}
        />
      )}

      {/* Sheet */}
      {mounted && menuAbierto && (
        <div
          ref={sheetRef}
          className="sheet-mobile lg:hidden animate-slide-up"
          style={{ background: 'var(--surface)' }}
        >
          {/* Handle visual */}
          <div className="flex justify-center pt-2 pb-1">
            <div
              className="w-9 h-1 rounded-full"
              style={{ background: 'var(--text-muted)', opacity: 0.3 }}
            />
          </div>

          <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[70vh]">
            {/* Sección Nutrición */}
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider px-3 py-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Nutrición
              </p>
              <div className="space-y-0.5">
                {NUTRICION_SUBITEMS.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname.startsWith(href + '/')
                  const showBadge = href === '/recetas/cola' && recetasPendientes > 0
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={() => setMenuAbierto(null)}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                      <span className="flex-1">{label}</span>
                      {showBadge && (
                        <span
                          className="text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                          style={{ background: 'var(--error)' }}
                        >
                          {recetasPendientes > 99 ? '99+' : recetasPendientes}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Sección Entrenos */}
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider px-3 py-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Entrenos
              </p>
              <div className="space-y-0.5">
                {ENTRENOS_SUBITEMS.concat({ href: '/entrenos/plantillas', label: 'Planificación', icon: Calendar }).map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={() => setMenuAbierto(null)}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Cuestionarios, Conocimiento, IA Test */}
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider px-3 py-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Herramientas
              </p>
              <div className="space-y-0.5">
                {[
                  { href: '/cuestionarios', label: 'Cuestionarios', icon: ClipboardList },
                  { href: '/conocimiento', label: 'Conocimiento', icon: BrainCircuit },
                  { href: '/ia-test', label: 'Probador IA', icon: FlaskConical },
                ].map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={() => setMenuAbierto(null)}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Acciones: Tema + Cerrar sesión */}
            <div className="pt-2 space-y-1 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <button
                onClick={() => { toggleTheme(); setMenuAbierto(null) }}
                className="sidebar-link w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
              </button>
              <button
                onClick={() => { handleLogout(); setMenuAbierto(null) }}
                className="sidebar-link w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                <LogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
