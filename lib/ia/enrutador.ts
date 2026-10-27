// lib/ia/enrutador.ts
// Elige qué modelo hace cada tarea y encadena respaldos: si un proveedor no tiene clave, falla, se pasa de tiempo o devuelve un JSON
// inválido, se prueba el siguiente de la lista. Los modelos fuertes van primero en las tareas que importan; DeepSeek queda de respaldo
// y para tareas baratas.
import { llamarClaude } from './anthropic'
import { extraerJsonPlan } from '@/lib/entrenos/evidencia-plan'

export type Proveedor = 'anthropic' | 'openai' | 'deepseek'
export type TareaIA = 'plan_entreno' | 'plan_dieta' | 'auditoria' | 'analisis_rendimiento' | 'revision_receta' | 'texto_barato'

/** `minMs`: tiempo que suele necesitar este modelo para una tarea larga; si queda menos, se salta (no tiene sentido empezar algo que no termina). */
export interface RutaModelo { proveedor: Proveedor; modelo: string; minMs?: number }

const CLAUDE_OPUS: RutaModelo = { proveedor: 'anthropic', modelo: 'claude-opus-5-5', minMs: 150_000 }
const CLAUDE_SONNET: RutaModelo = { proveedor: 'anthropic', modelo: 'claude-sonnet-5-5', minMs: 90_000 }
const GPT: RutaModelo = { proveedor: 'openai', modelo: 'gpt-5.5-2026-04-23', minMs: 100_000 }
// Tareas cortas (revisar una ficha: ~15 s): no exigen los mínimos de tiempo de los planes largos
const CLAUDE_SONNET_RAPIDO: RutaModelo = { ...CLAUDE_SONNET, minMs: 20_000 }
const GPT_RAPIDO: RutaModelo = { ...GPT, minMs: 20_000 }
const DEEPSEEK_PRO: RutaModelo = { proveedor: 'deepseek', modelo: 'deepseek-v4-pro' }
const DEEPSEEK: RutaModelo = { proveedor: 'deepseek', modelo: 'deepseek-chat' }

/**
 * Orden de preferencia por tarea. Generar y auditar usan familias distintas a propósito (errores independientes).
 * Se puede cambiar sin tocar código con `IA_RUTA_<TAREA>=proveedor:modelo,proveedor:modelo` (p. ej. IA_RUTA_PLAN_ENTRENO).
 */
export const RUTAS_POR_DEFECTO: Record<TareaIA, RutaModelo[]> = {
  plan_entreno: [CLAUDE_OPUS, GPT, DEEPSEEK],
  plan_dieta: [CLAUDE_OPUS, GPT, DEEPSEEK],
  auditoria: [GPT, CLAUDE_SONNET, DEEPSEEK],
  analisis_rendimiento: [CLAUDE_OPUS, GPT, DEEPSEEK],
  // Revisor del recetario: calidad/coste (Opus solo bajo petición con IA_RUTA_REVISION_RECETA)
  revision_receta: [CLAUDE_SONNET_RAPIDO, GPT_RAPIDO, DEEPSEEK],
  texto_barato: [DEEPSEEK, DEEPSEEK_PRO],
}

const CLAVE_ENV: Record<Proveedor, string> = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', deepseek: 'DEEPSEEK_API_KEY' }
const URL_COMPAT: Record<Exclude<Proveedor, 'anthropic'>, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
}

/** Rutas de una tarea: las de `IA_RUTA_<TAREA>` si existen y son válidas; si no, las de por defecto. */
export function rutasDe(tarea: TareaIA, env: Record<string, string | undefined> = process.env): RutaModelo[] {
  const crudo = env[`IA_RUTA_${tarea.toUpperCase()}`]
  if (crudo) {
    const rutas = crudo.split(',').map(x => x.trim().split(':')).filter(([p, m]) => (p === 'anthropic' || p === 'openai' || p === 'deepseek') && m)
      .map(([p, m]) => ({ proveedor: p as Proveedor, modelo: m }))
    if (rutas.length) return rutas
  }
  return RUTAS_POR_DEFECTO[tarea]
}

export interface IntentoIA { proveedor: Proveedor; modelo: string; ok: boolean; ms: number; error?: string; /** Lo que se pagó en este intento aunque su respuesta no sirviera (p. ej. JSON roto) */ uso?: { entrada: number | null; salida: number | null } }
export interface RespuestaIA {
  texto: string
  proveedor: Proveedor
  modelo: string
  intentos: IntentoIA[]
  uso: { entrada: number | null; salida: number | null }
  /** Gasto de TODOS los intentos que respondieron (el que acertó y los fallidos), para topes de gasto */
  usoTotal: { entrada: number; salida: number }
}
export interface ParamsIA {
  sistema: string
  usuario: string
  /** Exige que la respuesta sea un objeto JSON válido; si no, se pasa al siguiente modelo. */
  json?: boolean
  /** Tiempo máximo de TODA la tarea (ms). Cada intento recibe lo que quede. */
  presupuestoMs?: number
  maxTokens?: number
  /** Esfuerzo de razonamiento de Claude: más alto = mejor y más lento y caro. */
  esfuerzo?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}
export type Adaptador = (ruta: RutaModelo, p: ParamsIA, signal: AbortSignal) => Promise<{ texto: string; uso: { entrada: number | null; salida: number | null } }>

/** Adaptador real: Claude por el SDK; OpenAI y DeepSeek por su API compatible con chat/completions. */
export const adaptadorReal: Adaptador = async (ruta, p, signal) => {
  if (ruta.proveedor === 'anthropic') {
    const r = await llamarClaude({ modelo: ruta.modelo, sistema: p.sistema, usuario: p.usuario, maxTokens: p.maxTokens, esfuerzo: p.esfuerzo, signal })
    return { texto: r.texto, uso: r.uso }
  }
  const razonamiento = ruta.proveedor === 'openai'
  const res = await fetch(URL_COMPAT[ruta.proveedor], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[CLAVE_ENV[ruta.proveedor]]}` },
    signal,
    body: JSON.stringify({
      model: ruta.modelo,
      messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: p.usuario }],
      ...(p.json ? { response_format: { type: 'json_object' } } : {}),
      ...(razonamiento ? { max_completion_tokens: p.maxTokens ?? 20000 } : { temperature: 0.35, max_tokens: p.maxTokens ?? 8000 }),
    }),
  })
  if (!res.ok) throw new Error(`${ruta.proveedor} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  const texto = j.choices?.[0]?.message?.content ?? ''
  if (!texto) throw new Error(`${ruta.proveedor} devolvió una respuesta vacía`)
  return { texto, uso: { entrada: j.usage?.prompt_tokens ?? null, salida: j.usage?.completion_tokens ?? null } }
}

export class ErrorIA extends Error {
  constructor(mensaje: string, public intentos: IntentoIA[]) { super(mensaje) }
}

/** Resumen legible de los intentos fallidos, sin datos sensibles. */
const resumenIntentos = (i: IntentoIA[]) => i.map(x => `${x.modelo}: ${x.ok ? 'ok' : x.error ?? 'fallo'}`).join(' | ')

export async function llamarIA(tarea: TareaIA, p: ParamsIA, opciones: { adaptador?: Adaptador; env?: Record<string, string | undefined>; ahora?: () => number } = {}): Promise<RespuestaIA> {
  const adaptador = opciones.adaptador ?? adaptadorReal
  const env = opciones.env ?? process.env
  const ahora = opciones.ahora ?? Date.now
  const inicio = ahora()
  const presupuesto = p.presupuestoMs ?? 280_000
  const intentos: IntentoIA[] = []

  const rutas = rutasDe(tarea, env)
  const conClave = rutas.filter(r => env[CLAVE_ENV[r.proveedor]])
  for (const ruta of rutas) {
    if (!env[CLAVE_ENV[ruta.proveedor]]) { intentos.push({ ...ruta, ok: false, ms: 0, error: 'sin clave' }); continue }
    const quedan = presupuesto - (ahora() - inicio)
    if (quedan < Math.max(15_000, ruta.minMs ?? 0)) { intentos.push({ ...ruta, ok: false, ms: 0, error: 'sin tiempo' }); continue }
    // Un modelo lento no puede gastar todo el tiempo: si falla, el siguiente necesita margen. El último con clave usa lo que quede.
    const esUltimo = ruta === conClave[conClave.length - 1]
    const limite = esUltimo ? quedan : Math.floor(quedan * 0.8)
    const t0 = ahora()
    let usoIntento: IntentoIA['uso']
    try {
      const r = await adaptador(ruta, p, AbortSignal.timeout(limite))
      usoIntento = r.uso
      if (p.json) extraerJsonPlan(r.texto) // lanza si no es un objeto JSON
      intentos.push({ ...ruta, ok: true, ms: ahora() - t0, uso: r.uso })
      const usoTotal = intentos.reduce((n, i) => ({ entrada: n.entrada + (i.uso?.entrada ?? 0), salida: n.salida + (i.uso?.salida ?? 0) }), { entrada: 0, salida: 0 })
      return { texto: r.texto, proveedor: ruta.proveedor, modelo: ruta.modelo, intentos, uso: r.uso, usoTotal }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      intentos.push({ ...ruta, ok: false, ms: ahora() - t0, error: p.json && msg === 'sin JSON' ? 'JSON inválido' : msg.slice(0, 160), ...(usoIntento ? { uso: usoIntento } : {}) })
    }
  }
  throw new ErrorIA(`Ningún modelo pudo completar la tarea «${tarea}» (${resumenIntentos(intentos)})`, intentos)
}
