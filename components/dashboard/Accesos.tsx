'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Barbell, FilmSlate, ForkKnife, ListChecks, UserPlus, Users } from '@phosphor-icons/react'
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
    { label: 'Entrenos', href: '/entrenos', icon: Barbell, badge: 0 },
  ]

  return (
    <section className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map(({ label, href, icon: Icon, badge }) => (
        <Link key={label} href={href} className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-4 text-center active:scale-[0.97]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <Icon size={24} weight="duotone" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>{label}</span>
          {badge > 0 && (
            <span className="font-data absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>{badge}</span>
          )}
        </Link>
      ))}
    </section>
  )
}
