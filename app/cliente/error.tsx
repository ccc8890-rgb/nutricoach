'use client'

import { useEffect } from 'react'

export default function ErrorPortalCliente({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[portal cliente]', error) }, [error])
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: 'var(--bg)' }}>
      <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Algo ha fallado en tu portal</h1>
      <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
        {error.message || 'Error inesperado.'}{error.digest ? ` (ref. ${error.digest})` : ''}
      </p>
      <div className="flex gap-2">
        <button onClick={reset} className="btn btn-primary btn-sm">Reintentar</button>
        <button onClick={() => window.location.replace('/cliente?tab=hoy')} className="btn btn-sm">Volver al inicio</button>
      </div>
    </div>
  )
}
