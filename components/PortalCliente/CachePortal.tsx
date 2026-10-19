'use client'
import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
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

// La PWA de iOS sigue con el JavaScript con el que se abrió aunque haya una versión nueva (faltaban pestañas, estilos viejos…).
// Al volver a primer plano o cambiar de pantalla se pregunta la versión desplegada y, si es otra, se recarga.
// Nunca durante una sesión de entreno ni con un campo de texto enfocado (no se pierde lo que se está escribiendo).
function ActualizarSiHayVersionNueva() {
  const pathname = usePathname()
  useEffect(() => {
    const propia = process.env.NEXT_PUBLIC_BUILD_ID
    if (!propia || propia === 'dev') return
    let ultima = 0
    const comprobar = async () => {
      if (Date.now() - ultima < 60_000) return
      ultima = Date.now()
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        if (!r.ok) return
        const { v } = await r.json() as { v?: string }
        if (!v || v === 'dev' || v === propia) return
        const el = document.activeElement
        const escribiendo = el instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
        if (escribiendo || window.location.pathname.startsWith('/cliente/sesion')) return
        window.location.reload()
      } catch { /* sin red: se vuelve a intentar más tarde */ }
    }
    const alVolver = () => { if (document.visibilityState === 'visible') void comprobar() }
    document.addEventListener('visibilitychange', alVolver)
    void comprobar()
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [pathname])
  return null
}

// Caché compartida por todo /cliente (portal + detalle de receta) y persistida en el dispositivo.
export default function CachePortal({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: proveedorCachePersistente, shouldRetryOnError: false, focusThrottleInterval: 30000 }}>
      <PrecalentarAlTocar />
      <ActualizarSiHayVersionNueva />
      {children}
    </SWRConfig>
  )
}
