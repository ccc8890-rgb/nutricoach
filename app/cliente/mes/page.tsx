'use client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CalendarioMesEntreno from '@/components/training/CalendarioMesEntreno'

export default function VistaMensualClientePage() {
  return (
    <div className="min-h-screen px-4 pb-8 pt-safe" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/cliente?tab=entreno"
            replace
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Training OS</p>
            <h1 className="truncate text-xl font-bold" style={{ color: 'var(--text)' }}>Calendario de entreno</h1>
          </div>
        </div>

        <CalendarioMesEntreno />
      </div>
    </div>
  )
}
