'use client'

import Link from 'next/link'
import FichaMetodo from '@/components/metodos/FichaMetodo'
import { listaRecordada } from '@/lib/useEstadoUrl'

export default function NuevaFichaMetodoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <Link href={listaRecordada('metodos', '/entrenos/metodos')} className="text-sm" style={{ color: 'var(--text-muted)' }}>← Biblioteca de métodos</Link>
      <h1 className="text-2xl font-light">Añadir ficha</h1>
      <FichaMetodo />
    </div>
  )
}
