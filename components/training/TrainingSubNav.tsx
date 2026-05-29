'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Brain, Library, Dumbbell, Sparkles } from 'lucide-react'

const SECTIONS = [
  {
    label: 'Coach',
    items: [
      { href: '/entrenos', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/entrenos/planes', label: 'Planes', icon: ClipboardList },
      { href: '/entrenos/brain-ia', label: 'Brain IA', icon: Brain },
    ],
  },
  {
    label: 'Biblioteca',
    items: [
      { href: '/entrenos/plantillas', label: 'Plantillas', icon: Library },
      { href: '/entrenos/ejercicios', label: 'Ejercicios', icon: Dumbbell },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { href: '/entrenos/generar-ia', label: 'Generar plan IA', icon: Sparkles },
    ],
  },
]

export default function TrainingSubNav() {
  const pathname = usePathname()

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    if (href === '/entrenos/planes') {
      const parts = pathname.split('/').filter(Boolean)
      return parts.length === 2 && parts[0] === 'entrenos' && parts[1] !== 'plantillas' && parts[1] !== 'ejercicios' && parts[1] !== 'generar-ia' && parts[1] !== 'nueva' && parts[1] !== 'brain-ia' && parts[1] !== 'planes'
    }
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="hidden lg:flex flex-col flex-shrink-0"
      style={{
        width: 148,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <div style={{ padding: '0 10px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
        Training OS
      </div>
      {SECTIONS.map(section => (
        <div key={section.label} style={{ marginBottom: 4 }}>
          <div style={{ padding: '8px 12px 3px', fontSize: 9, fontWeight: 600, color: 'var(--border-strong)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {section.label}
          </div>
          {section.items.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'rgb(168,85,247)' : 'var(--text-secondary)',
                  borderLeft: `2px solid ${active ? 'rgb(168,85,247)' : 'transparent'}`,
                  background: active ? 'rgba(168,85,247,0.06)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
