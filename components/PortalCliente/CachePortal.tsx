'use client'
import { useEffect, type ReactNode } from 'react'
import { SWRConfig, useSWRConfig } from 'swr'
import { proveedorCachePersistente, claveReceta, precalentarReceta } from '@/lib/cliente/cache-swr'

// Al tocar un enlace a una receta se pide su detalle ya (el clic llega ~100 ms después): cubre cualquier lista.
function PrecalentarAlTocar() {
  const { mutate, cache } = useSWRConfig()
  useEffect(() => {
    const alTocar = (e: PointerEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="/cliente/receta/"]') as HTMLAnchorElement | null
      if (!a) return
      const url = new URL(a.href)
      const id = url.pathname.split('/').pop()
      const codigo = url.searchParams.get('codigo')
      if (id && codigo) precalentarReceta(mutate as never, cache, claveReceta(codigo, id, url.searchParams.get('comida')))
    }
    document.addEventListener('pointerdown', alTocar, { passive: true })
    return () => document.removeEventListener('pointerdown', alTocar)
  }, [mutate, cache])
  return null
}

// Caché compartida por todo /cliente (portal + detalle de receta) y persistida en el dispositivo.
export default function CachePortal({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: proveedorCachePersistente, shouldRetryOnError: false, focusThrottleInterval: 30000 }}>
      <PrecalentarAlTocar />
      {children}
    </SWRConfig>
  )
}
