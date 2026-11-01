// lib/platos/analizar.ts
// «Mis platos»: la IA lee la foto de un plato y propone nombre, ingredientes con gramos y pasos.
// Las macros NO las inventa el modelo: salen de enlazar cada ingrediente a la base de alimentos (ver enlazar.ts / macros.ts).
import { llamarIA, type Adaptador } from '@/lib/ia/enrutador'
import { extraerJsonPlan } from '@/lib/entrenos/evidencia-plan'

export type AnalisisPlato = {
  nombre: string
  porciones: number
  ingredientes: { nombre: string; gramos: number }[]
  pasos: string[]
}

const PROHIBIDO = /https?:\/\/|www\.|v[ií]spera|carrera/i

export function validarAnalisisPlato(crudo: unknown): { ok: true; valor: AnalisisPlato } | { ok: false; motivo: string } {
  if (!crudo || typeof crudo !== 'object') return { ok: false, motivo: 'La respuesta no es un objeto' }
  const o = crudo as Record<string, unknown>
  const nombre = typeof o.nombre === 'string' ? o.nombre.trim() : ''
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, motivo: 'Nombre no válido' }
  if (PROHIBIDO.test(nombre)) return { ok: false, motivo: 'Nombre con texto no permitido' }

  const porcionesCruda = o.porciones === undefined ? 1 : Number(o.porciones)
  if (!Number.isFinite(porcionesCruda) || porcionesCruda < 1 || porcionesCruda > 12) return { ok: false, motivo: 'Raciones no válidas' }

  if (!Array.isArray(o.ingredientes) || o.ingredientes.length < 1 || o.ingredientes.length > 25) return { ok: false, motivo: 'Número de ingredientes no válido' }
  const ingredientes: AnalisisPlato['ingredientes'] = []
  for (const i of o.ingredientes) {
    const n = typeof (i as { nombre?: unknown })?.nombre === 'string' ? (i as { nombre: string }).nombre.trim() : ''
    const g = Number((i as { gramos?: unknown })?.gramos)
    if (n.length < 2 || n.length > 80 || PROHIBIDO.test(n)) return { ok: false, motivo: 'Ingrediente no válido' }
    if (!Number.isFinite(g) || g <= 0 || g > 2000) return { ok: false, motivo: `Gramos no válidos para «${n}»` }
    ingredientes.push({ nombre: n, gramos: Math.round(g * 10) / 10 })
  }

  const pasosCrudos = o.pasos === undefined ? [] : o.pasos
  if (!Array.isArray(pasosCrudos) || pasosCrudos.length > 12) return { ok: false, motivo: 'Pasos no válidos' }
  const pasos: string[] = []
  for (const p of pasosCrudos) {
    const t = typeof p === 'string' ? p.trim() : ''
    if (!t || t.length > 300 || PROHIBIDO.test(t)) return { ok: false, motivo: 'Paso no válido' }
    pasos.push(t)
  }
  return { ok: true, valor: { nombre, porciones: porcionesCruda, ingredientes, pasos } }
}

export function construirPromptPlato(nota: string | null): { sistema: string; usuario: string } {
  const sistema = [
    'Eres un dietista que identifica platos caseros a partir de una foto. Responde SOLO con un objeto JSON con esta forma:',
    '{"nombre": string, "porciones": number, "ingredientes": [{"nombre": string, "gramos": number}], "pasos": [string]}',
    'Reglas: español de España; nombres de ingredientes genéricos y sin marcas (por ejemplo «Huevo», «Patata», «Aceite de oliva»);',
    'gramos de lo que se ve en el plato servido, en crudo salvo que sea evidente que va cocinado; máximo 12 pasos cortos.',
    'No inventes elementos que no se ven en la foto ni cantidades exageradas; si dudas de un ingrediente, déjalo fuera.',
  ].join('\n')
  const usuario = nota?.trim() ? `Analiza el plato de la foto. Nota del cliente: ${nota.trim()}` : 'Analiza el plato de la foto.'
  return { sistema, usuario }
}

export async function analizarFotoPlato(
  p: { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; nota: string | null },
  opciones: { adaptador?: Adaptador; env?: Record<string, string | undefined> } = {},
): Promise<{ ok: true; valor: AnalisisPlato; modelo: string } | { ok: false; motivo: string }> {
  try {
    const { sistema, usuario } = construirPromptPlato(p.nota)
    const r = await llamarIA('plato_foto', {
      sistema, usuario, json: true, presupuestoMs: 45_000, maxTokens: 4000, esfuerzo: 'low',
      imagenes: [{ mediaType: p.mediaType, base64: p.base64 }],
    }, opciones)
    const v = validarAnalisisPlato(extraerJsonPlan(r.texto))
    return v.ok ? { ok: true, valor: v.valor, modelo: `${r.proveedor}:${r.modelo}` } : { ok: false, motivo: v.motivo }
  } catch {
    return { ok: false, motivo: 'No se pudo analizar la foto' }
  }
}
