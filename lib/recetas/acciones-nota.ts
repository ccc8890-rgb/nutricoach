// Notas de «Reportar problema» como órdenes: la IA las convierte en acciones y aquí se validan antes de tocar nada.
// Función pura (sin BD ni red): el motor (scripts/corregir-marcadas-motor.ts) aplica lo que sale validado.

export type AccionNota =
  | { tipo: 'renombrar'; n: number; nombre: string; termino_anterior?: string }
  | { tipo: 'reenlazar'; n: number; alimento: string }
  | { tipo: 'gramos'; n: number; gramos: number; evidencia: string }
  | { tipo: 'no_computa'; n: number }
  | { tipo: 'quitar'; n: number }
  | { tipo: 'unir'; n: [number, number]; gramos: number }
  | { tipo: 'raciones'; valor: number }
  | { tipo: 'titulo'; valor: string }
  | { tipo: 'responder'; n: number | null; texto: string }
  | { tipo: 'pregunta'; texto: string }

export type FilaInfo = { nombre: string; gramos: number; estimada: boolean }
export type ContextoNota = { filas: number; filasInfo?: FilaInfo[]; textoOriginal: string; notaCoach: string; porciones: number; palabrasProhibidas: RegExp }

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 %.,]/g, ' ').replace(/\s+/g, ' ').trim()
const fila = (n: unknown, filas: number) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= filas

/** Valida una a una las acciones propuestas; devuelve las válidas y el motivo de las descartadas. */
export function validarAcciones(raw: unknown, ctx: ContextoNota): { validas: AccionNota[]; descartadas: string[] } {
  const validas: AccionNota[] = [], descartadas: string[] = []
  const lista = Array.isArray(raw) ? raw : []
  const tocadas = new Set<number>()
  for (const x of lista as any[]) {
    const rechazar = (m: string) => descartadas.push(`${x?.tipo ?? '?'}: ${m}`)
    switch (x?.tipo) {
      case 'renombrar': {
        const nombre = String(x.nombre ?? '').trim()
        if (!fila(x.n, ctx.filas)) { rechazar('fila inexistente'); break }
        if (nombre.length < 2 || nombre.length > 80 || ctx.palabrasProhibidas.test(norm(nombre))) { rechazar('nombre no válido'); break }
        validas.push({ tipo: 'renombrar', n: x.n, nombre, termino_anterior: typeof x.termino_anterior === 'string' ? x.termino_anterior.trim() : undefined }); tocadas.add(x.n); break
      }
      case 'reenlazar': {
        const alimento = String(x.alimento ?? '').trim()
        if (!fila(x.n, ctx.filas) || alimento.length < 3 || alimento.length > 60 || alimento.split(/\s+/).length > 6) { rechazar('fila o alimento no válido'); break }
        validas.push({ tipo: 'reenlazar', n: x.n, alimento }); tocadas.add(x.n); break
      }
      case 'gramos': {
        const g = Number(x.gramos)
        if (!fila(x.n, ctx.filas) || !(g > 0) || g > 1500) { rechazar('fila o gramos no válidos'); break }
        const ev = String(x.evidencia ?? '').trim()
        // la orden de la nota vale tal cual si la cifra está en la nota; si no, la cita tiene que existir en el texto original;
        // o, si el coach duda de una cantidad ESTIMADA por el sistema (no dicha por el vídeo) y la nombra, vale un ajuste de criterio (de ¼ a ×4)
        const enNota = norm(ctx.notaCoach).includes(String(g).replace('.', ',')) || norm(ctx.notaCoach).includes(String(g))
        const enTexto = ev.length >= 6 && norm(ctx.textoOriginal).includes(norm(ev))
        const info = ctx.filasInfo?.[x.n - 1]
        const nombrada = !!info && norm(info.nombre).split(' ').filter(w => w.length > 3).some(w => norm(ctx.notaCoach).includes(w.replace(/(es|s)$/, '')))
        const porCriterio = ev === 'criterio' && !!info && info.estimada && nombrada && info.gramos > 0 && g / info.gramos >= 0.25 && g / info.gramos <= 4
        if (!enNota && !enTexto && !porCriterio) { rechazar(`la cifra ${g} g no sale de la nota, del texto original ni es un ajuste de una cantidad estimada que nombres`); break }
        validas.push({ tipo: 'gramos', n: x.n, gramos: g, evidencia: ev }); tocadas.add(x.n); break
      }
      case 'no_computa':
        if (!fila(x.n, ctx.filas)) { rechazar('fila inexistente'); break }
        validas.push({ tipo: 'no_computa', n: x.n }); tocadas.add(x.n); break
      case 'quitar':
        if (!fila(x.n, ctx.filas)) { rechazar('fila inexistente'); break }
        validas.push({ tipo: 'quitar', n: x.n }); tocadas.add(x.n); break
      case 'unir': {
        const [a, b] = Array.isArray(x.n) ? x.n : []
        const g = Number(x.gramos)
        if (!fila(a, ctx.filas) || !fila(b, ctx.filas) || a === b || !(g > 0) || g > 1500) { rechazar('filas o gramos no válidos'); break }
        validas.push({ tipo: 'unir', n: [a, b], gramos: g }); tocadas.add(a); tocadas.add(b); break
      }
      case 'raciones':
        if (!Number.isInteger(x.valor) || x.valor < 1 || x.valor > 24) { rechazar('raciones fuera de 1-24'); break }
        validas.push({ tipo: 'raciones', valor: x.valor }); break
      case 'titulo': {
        const v = String(x.valor ?? '').trim()
        if (v.length < 3 || v.length > 80 || ctx.palabrasProhibidas.test(norm(v))) { rechazar('título no válido'); break }
        validas.push({ tipo: 'titulo', valor: v }); break
      }
      case 'responder': {
        const t = String(x.texto ?? '').trim()
        if (t.length < 5) { rechazar('respuesta vacía'); break }
        validas.push({ tipo: 'responder', n: fila(x.n, ctx.filas) ? x.n : null, texto: t.slice(0, 400) }); break
      }
      case 'pregunta': {
        const t = String(x.texto ?? '').trim()
        if (t.length < 5) { rechazar('pregunta vacía'); break }
        validas.push({ tipo: 'pregunta', texto: t.slice(0, 300) }); break
      }
      default: rechazar('tipo desconocido')
    }
  }
  // una misma fila no puede recibir órdenes contradictorias (quitar + gramos, no_computa + gramos…)
  const porFila = new Map<number, string[]>()
  for (const a of validas) for (const n of ('n' in a ? (Array.isArray(a.n) ? a.n : a.n != null ? [a.n] : []) : [])) if (a.tipo !== 'responder') porFila.set(n, [...(porFila.get(n) ?? []), a.tipo])
  for (const [n, tipos] of porFila) {
    if (tipos.includes('quitar') && tipos.length > 1) {
      for (let i = validas.length - 1; i >= 0; i--) { const a = validas[i]; if (a.tipo !== 'quitar' && a.tipo !== 'responder' && 'n' in a && (a.n === n || (Array.isArray(a.n) && a.n.includes(n)))) { validas.splice(i, 1); descartadas.push(`${a.tipo}: la fila ${n} se quita`) } }
    }
  }
  return { validas, descartadas }
}

/** Sustituye un término entero (sin tocar palabras que lo contienen) conservando la mayúscula inicial: «batata» → «boniato», «Batata» → «Boniato». */
export function reemplazarTermino(texto: string | null | undefined, de: string, a: string): { texto: string; cambios: number } {
  const origen = texto ?? ''
  const d = de.trim()
  if (d.length < 3 || !origen) return { texto: origen, cambios: 0 }
  const esc = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let cambios = 0
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'giu')
  const nuevo = origen.replace(re, m => { cambios++; return m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? a[0].toUpperCase() + a.slice(1) : a })
  return { texto: nuevo, cambios }
}
