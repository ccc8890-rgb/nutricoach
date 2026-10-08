'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

// Estado de pantalla (pestaña, filtros, página) guardado en la URL sin añadir
// entradas al historial: al abrir algo y volver atrás, la pantalla reaparece tal cual.
const EVENTO = 'nc:estado-url'

function suscribir(avisar: () => void) {
  window.addEventListener('popstate', avisar)
  window.addEventListener(EVENTO, avisar)
  return () => {
    window.removeEventListener('popstate', avisar)
    window.removeEventListener(EVENTO, avisar)
  }
}

export function useEstadoUrl<T extends string | null>(
  clave: string,
  defecto: T,
  validos?: readonly string[],
): [T, (nuevo: T) => void] {
  const valor = useSyncExternalStore(
    suscribir,
    () => {
      const v = new URLSearchParams(window.location.search).get(clave)
      return v === null || (validos && !validos.includes(v)) ? defecto : v
    },
    () => defecto,
  ) as T

  const cambiar = useCallback((nuevo: T) => {
    const url = new URL(window.location.href)
    if (nuevo === null || nuevo === defecto) url.searchParams.delete(clave)
    else url.searchParams.set(clave, nuevo)
    window.history.replaceState(window.history.state, '', url)
    window.dispatchEvent(new Event(EVENTO))
  }, [clave, defecto])

  return [valor, cambiar]
}

const PREFIJO_LISTA = 'nc:lista:'

/** Recuerda la URL (con filtros) de un listado para que «Volver» desde el detalle regrese a ella. */
export function useRecordarLista(clave: string) {
  useEffect(() => {
    try { sessionStorage.setItem(PREFIJO_LISTA + clave, window.location.pathname + window.location.search) } catch { /* sin almacenamiento */ }
  })
}

export function listaRecordada(clave: string, porDefecto: string): string {
  try { return sessionStorage.getItem(PREFIJO_LISTA + clave) || porDefecto } catch { return porDefecto }
}

// Posición de scroll: se guarda por URL y solo se recupera al volver con «atrás»,
// no al entrar de nuevo desde el menú.
let ultimoAtras = 0
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { ultimoAtras = Date.now() })

function contenedores(): (HTMLElement | Window)[] {
  const main = document.querySelector<HTMLElement>('main.coach-atelier-main')
  return main ? [main, window] : [window]
}
const posicion = (el: HTMLElement | Window) => (el instanceof Window ? el.scrollY : el.scrollTop)
const claveScroll = () => `nc:scroll:${window.location.pathname}${window.location.search}`

export function useRestaurarScroll(listo: boolean) {
  // Mientras la página carga, el navegador mueve el scroll solo; no se guarda hasta que haya contenido
  const listoRef = useRef(listo)
  useEffect(() => { listoRef.current = listo }, [listo])

  useEffect(() => {
    const anterior = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = anterior }
  }, [])

  useEffect(() => {
    let frame = 0
    // scroll no burbujea: se escucha en captura para cubrir tanto la ventana como el <main> con scroll propio
    const guardar = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!listoRef.current) return
        try { sessionStorage.setItem(claveScroll(), JSON.stringify(contenedores().map(posicion))) } catch { /* sin almacenamiento */ }
      })
    }
    document.addEventListener('scroll', guardar, { capture: true, passive: true })
    return () => { cancelAnimationFrame(frame); document.removeEventListener('scroll', guardar, true) }
  }, [])

  useEffect(() => {
    if (!listo || Date.now() - ultimoAtras > 3000) return
    ultimoAtras = 0
    let guardado: number[] = []
    try { guardado = JSON.parse(sessionStorage.getItem(claveScroll()) || '[]') } catch { /* ignorar */ }
    const destinos = contenedores()
    // El contenido puede seguir pintándose: se reintenta hasta alcanzar la posición (máx. ~2 s)
    let intentos = 0
    const aplicar = () => {
      let pendiente = false
      destinos.forEach((d, i) => {
        const y = guardado[i] ?? 0
        if (y <= 0) return
        // `instant`: el CSS global usa scroll-behavior: smooth y la animación se pisaría con los reintentos
        d.scrollTo({ top: y, behavior: 'instant' })
        if (Math.abs(posicion(d) - y) > 2) pendiente = true
      })
      if (pendiente && ++intentos < 120) requestAnimationFrame(aplicar)
    }
    requestAnimationFrame(aplicar)
  }, [listo])
}
