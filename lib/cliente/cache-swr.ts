// Caché SWR del portal cliente persistida en localStorage: al reabrir la app se pinta al instante
// lo último que se sabía y se revalida en segundo plano. Solo guarda `data`, nunca estados transitorios.
const CLAVE = 'nc:swr-cache:v1'

let mapaActual: Map<string, { data: unknown }> | null = null
let descartada = false

export function proveedorCachePersistente(): Map<string, { data: unknown }> {
  if (typeof window === 'undefined') return new Map()
  let mapa = new Map<string, { data: unknown }>()
  try {
    mapa = new Map(JSON.parse(localStorage.getItem(CLAVE) || '[]'))
  } catch { /* caché corrupta o storage bloqueado: se arranca vacía */ }
  mapaActual = mapa
  descartada = false

  const guardar = () => {
    if (descartada) return
    try {
      const entradas = Array.from(mapa.entries())
        .filter(([, v]) => v && (v as { data?: unknown }).data !== undefined)
        .map(([k, v]) => [k, { data: (v as { data: unknown }).data }])
      localStorage.setItem(CLAVE, JSON.stringify(entradas))
    } catch { /* cuota llena o storage bloqueado */ }
  }
  window.addEventListener('beforeunload', guardar)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') guardar()
  })
  return mapa
}

// Al cerrar sesión (o expirar) no puede quedar nada de un cliente en el dispositivo.
export function borrarCachePortal() {
  descartada = true
  mapaActual?.clear()
  try { localStorage.removeItem(CLAVE) } catch { /* ignorar */ }
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}
