'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
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
  Inbox,
} from 'lucide-react'
import { useNotificaciones } from '@/lib/useNotificaciones'
import { useTheme } from '@/components/ThemeProvider'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/respuestas', label: 'Consulta', icon: MessageSquareReply },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/cuestionarios', label: 'Cuestionarios', icon: ClipboardList },
]

const ENTRENOS_SUBITEMS = [
  { href: '/entrenos', label: 'Planes', icon: Dumbbell },
  { href: '/entrenos/plantillas', label: 'Planificación', icon: Calendar },
]

const NUTRICION_SUBITEMS = [
  { href: '/dietas/plantillas', label: 'Planes nutricionales', icon: LayoutTemplate },
  { href: '/dietas', label: 'Dietas activas', icon: Apple },
  { href: '/dietas/alimentos', label: 'Alimentos', icon: Sandwich },
  { href: '/recetas', label: 'Recetario', icon: BookOpen },
  { href: '/recetas/cola', label: 'Cola revisión', icon: Inbox },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { noLeidas } = useNotificaciones()
  const { theme, toggleTheme } = useTheme()

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

  return (
    <aside className="w-60 min-h-screen flex flex-col border-r bg-white border-gray-200">
      {/* Logo — diseño teal */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)' }}
          >
            CN
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-tight text-[15px]">Casanova Nutrition</p>
            <p className="text-[11px] font-medium text-gray-400">Panel de coach</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{label}</span>
              {href === '/respuestas' && noLeidas > 0 && (
                <span className="ml-auto text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center bg-red-500">
                  {noLeidas > 99 ? '99+' : noLeidas}
                </span>
              )}
              {isActive && href !== '/respuestas' && (
                <ChevronRight size={14} className="ml-auto text-[var(--primary)]" />
              )}
            </Link>
          )
        })}

        {/* Entrenos — sección colapsable */}
        <div className="mt-1">
          <button
            onClick={() => setEntrenosExpandido(!entrenosExpandido)}
            className={`sidebar-link w-full ${entrenosActiva ? 'active' : ''}`}
          >
            <Dumbbell size={18} strokeWidth={entrenosActiva ? 2.5 : 1.8} />
            <span>Entrenos</span>
            {entrenosExpandido ? (
              <ChevronDown size={14} className="ml-auto text-[var(--primary)]" />
            ) : (
              <ChevronRight size={14} className="ml-auto text-gray-300" />
            )}
          </button>

          {entrenosExpandido && (
            <div className="ml-2 mt-0.5 border-l-2 pl-2 space-y-0.5 border-gray-200">
              {ENTRENOS_SUBITEMS.map(({ href, label, icon: Icon }) => {
                const isSubActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-link ${isSubActive ? 'active' : ''}`}
                  >
                    <Icon size={16} strokeWidth={isSubActive ? 2.5 : 1.8} />
                    <span>{label}</span>
                    {isSubActive && (
                      <ChevronRight size={14} className="ml-auto text-[var(--primary)]" />
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
          >
            <UtensilsCrossed size={18} strokeWidth={nutricionActiva ? 2.5 : 1.8} />
            <span>Nutrición</span>
            {nutricionExpandido ? (
              <ChevronDown size={14} className="ml-auto text-[var(--primary)]" />
            ) : (
              <ChevronRight size={14} className="ml-auto text-gray-300" />
            )}
          </button>

          {nutricionExpandido && (
            <div className="ml-2 mt-0.5 border-l-2 pl-2 space-y-0.5 border-gray-200">
              {NUTRICION_SUBITEMS.map(({ href, label, icon: Icon }) => {
                const isSubActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-link ${isSubActive ? 'active' : ''}`}
                  >
                    <Icon size={16} strokeWidth={isSubActive ? 2.5 : 1.8} />
                    <span>{label}</span>
                    {isSubActive && (
                      <ChevronRight size={14} className="ml-auto text-[var(--primary)]" />
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Theme toggle + Logout */}
      <div className="p-3 border-t space-y-1 border-gray-200">
        <button
          onClick={toggleTheme}
          className="sidebar-link w-full text-gray-400"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full hover:bg-red-50 hover:text-red-600 text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        >
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
