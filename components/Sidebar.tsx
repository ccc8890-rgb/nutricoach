'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Users, UtensilsCrossed, Dumbbell, LogOut, ChevronRight, BookOpen } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/dietas', label: 'Dietas', icon: UtensilsCrossed },
  { href: '/entrenos', label: 'Entrenos', icon: Dumbbell },
  { href: '/recetas', label: 'Recetas', icon: BookOpen },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 min-h-screen flex flex-col border-r" style={{ background: 'white', borderColor: '#e5e7eb' }}>
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor: '#e5e7eb' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: '#16a34a' }}>
            🥗
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-tight">Casanova Nutrition</p>
            <p className="text-xs text-gray-400">Panel de coach</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t" style={{ borderColor: '#e5e7eb' }}>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-red-500 hover:!bg-red-50 hover:!text-red-600"
        >
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
