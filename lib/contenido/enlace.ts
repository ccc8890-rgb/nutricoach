/** Clave comparable de un enlace: sin protocolo, `www`, parámetros ni barra final. YouTube conserva `v`. */
export function normalizarEnlace(raw: string): string | null {
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const path = u.pathname.replace(/\/+$/, '')
  if (host === 'youtube.com' && path === '/watch') {
    const v = u.searchParams.get('v')
    if (v) return `${host}${path}?v=${v}`
  }
  return `${host}${path}`
}

/** Entrada rápida de la bandeja: texto libre, enlace o ambos. */
export function interpretarEntrada(texto: string): { titulo: string; enlace: string | null } {
  const t = texto.trim()
  const m = t.match(/https?:\/\/\S+/)
  if (!m) return { titulo: t, enlace: null }
  const enlace = m[0]
  const resto = t.replace(enlace, '').replace(/\s+/g, ' ').trim()
  if (resto) return { titulo: resto, enlace }
  const clave = normalizarEnlace(enlace)
  return { titulo: clave ? `Enlace de ${clave.split('/')[0]}` : 'Idea sin título', enlace }
}
