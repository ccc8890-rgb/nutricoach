'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

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
