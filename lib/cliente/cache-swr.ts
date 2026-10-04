// Caché SWR del portal cliente persistida en localStorage: al reabrir la app se pinta al instante
// lo último que se sabía y se revalida en segundo plano. Solo guarda `data`, nunca estados transitorios.
const CLAVE = 'nc:swr-cache:v1'

let mapaActual: Map<string, { data: unknown }> | null = null
let descartada = false

// Marcas de arranque (performance.mark) para medir dónde se va el tiempo; se leen con performance.getEntriesByType('mark').
export const marca = (n: string) => { try { performance.mark(n) } catch { /* sin Performance API */ } }

export function proveedorCachePersistente(): Map<string, { data: unknown }> {
  if (typeof window === 'undefined') return new Map()
  marca('nc:cache-leer-ini')
  let mapa = new Map<string, { data: unknown }>()
  try {
    mapa = new Map(JSON.parse(localStorage.getItem(CLAVE) || '[]'))
  } catch { /* caché corrupta o storage bloqueado: se arranca vacía */ }
  marca('nc:cache-leer-fin')
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

/* ── Detalle de receta: la clave es la misma URL que pide la página, para compartir caché ── */
export const claveReceta = (codigo: string, id: string, comida?: string | null) =>
  `/api/cliente/${codigo}/recetas/${id}${comida ? `?comida=${encodeURIComponent(comida)}` : ''}`

// Calienta el detalle (y la foto) de una receta antes de abrirla. No repite si ya está en caché.
export async function precalentarReceta(
  mutate: (clave: string, datos: unknown, opts: { revalidate: boolean }) => Promise<unknown>,
  cache: { get: (k: string) => unknown },
  clave: string,
) {
  // Datos ya en caché (p. ej. persistida de otra sesión): la foto del navegador no lo está, se precarga igualmente.
  const previo = (cache.get(clave) as { data?: { receta?: { imagen_url?: string | null } } } | undefined)?.data
  if (previo) {
    const { precargarImagenReceta } = await import('./imagen-receta')
    precargarImagenReceta(previo.receta?.imagen_url)
    return
  }
  try {
    const datos = await fetchJson<{ receta?: { imagen_url?: string | null } }>(clave)
    await mutate(clave, datos, { revalidate: false })
    const { precargarImagenReceta } = await import('./imagen-receta')
    precargarImagenReceta(datos.receta?.imagen_url)
  } catch { /* se cargará al abrirla */ }
}
