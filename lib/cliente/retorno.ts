'use client'

import { useEffect } from 'react'

// «Volver» desde una receta o sesión: al tocar un enlace a esas pantallas se guarda dónde estaba la
// persona (URL con sus filtros y pestañas + scroll). La pantalla de origen recupera el scroll al
// montarse y la de destino usa la URL como destino de su botón «Volver».
const CLAVE = 'nc:retorno'
const CADUCA_MS = 30 * 60_000

interface Retorno { url: string; y: number; t: number }

export function marcarSalida() {
  try {
    const datos: Retorno = { url: window.location.pathname + window.location.search, y: window.scrollY, t: Date.now() }
    sessionStorage.setItem(CLAVE, JSON.stringify(datos))
  } catch { /* sin almacenamiento */ }
}

function leer(): Retorno | null {
  try {
    const raw = sessionStorage.getItem(CLAVE)
    if (!raw) return null
    const d = JSON.parse(raw) as Retorno
    return Date.now() - d.t > CADUCA_MS ? null : d
  } catch { return null }
}

/** Destino del botón «Volver» de una pantalla de detalle (solo rutas del portal cliente que no sean otro detalle). */
export function destinoVolver(porDefecto: string): string {
  const d = leer()
  if (!d || !d.url.startsWith('/cliente') || /^\/cliente\/(receta|sesion)\//.test(d.url)) return porDefecto
  return d.url
}

/** Captura el clic en cualquier enlace a receta o sesión (sea del portal o de las pantallas de semana/mes). */
export function useMarcarSalidaAlAbrirDetalle() {
  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="/cliente/receta/"], a[href^="/cliente/sesion/"]')
      if (a) marcarSalida()
    }
    document.addEventListener('click', alClic, true)
    return () => document.removeEventListener('click', alClic, true)
  }, [])
}

/** Recupera el scroll guardado al salir, si se vuelve a la misma URL. Se consume una sola vez. */
export function useRestaurarRetorno(listo: boolean) {
  useEffect(() => {
    if (!listo) return
    const d = leer()
    if (!d || d.url !== window.location.pathname + window.location.search || !(d.y > 0)) return
    try { sessionStorage.removeItem(CLAVE) } catch { /* ignorar */ }
    let intentos = 0
    const aplicar = () => {
      window.scrollTo({ top: d.y, behavior: 'instant' })
      if (Math.abs(window.scrollY - d.y) > 2 && ++intentos < 60) requestAnimationFrame(aplicar)
    }
    requestAnimationFrame(aplicar)
  }, [listo])
}
