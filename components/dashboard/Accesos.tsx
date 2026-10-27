'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FilmSlate, ForkKnife, ListChecks, UserPlus, Users } from '@/components/icons/phosphor'
import { supabase } from '@/lib/supabase'

export default function Accesos() {
  const [recetasPendientes, setRecetasPendientes] = useState(0)

  useEffect(() => {
    supabase
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_revision')
      .then(({ count }) => setRecetasPendientes(count ?? 0))
  }, [])

  const items = [
    { label: 'Nuevo cliente', href: '/clientes/nuevo', icon: UserPlus, badge: 0 },
    { label: 'Clientes', href: '/clientes', icon: Users, badge: 0 },
    { label: 'Revisar recetas', href: '/recetas/revisar', icon: ListChecks, badge: recetasPendientes },
    { label: 'Contenido', href: '/contenido', icon: FilmSlate, badge: 0 },
    { label: 'Dietas', href: '/dietas', icon: ForkKnife, badge: 0 },
  ]

  return (
    <section className="coach-dashboard-access">
      {items.map(({ label, href, icon: Icon, badge }) => (
        <Link key={label} href={href} className="coach-dashboard-access-item relative flex items-center gap-3 px-3 py-3 text-left active:scale-[0.98]">
          <Icon size={19} weight="regular" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>{label}</span>
          {badge > 0 && (
            <span className="font-data absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>{badge}</span>
          )}
        </Link>
      ))}
    </section>
  )
}
