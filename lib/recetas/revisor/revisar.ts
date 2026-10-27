// Orquestación del revisor de recetas (servidor): cargar ficha → ¿ha cambiado? → IA → validar → guardar → aplicar lo seguro → 2ª revisión.
import type { SupabaseClient } from '@supabase/supabase-js'
import { llamarIA, type Adaptador } from '@/lib/ia/enrutador'
import { extraerJsonPlan } from '@/lib/entrenos/evidencia-plan'
import { inicioFinDiaMadridUtc } from '@/lib/recetas/revision'
import { construirPrompt } from './prompt'
import { correccionesAplicables, hashFicha, validarRevision, type FichaParaRevisar, type RevisionAgente, type Veredicto } from './esquema'

export const ETIQUETA_REVISADA = 'Revisada por el agente'
export const LIMITE_POR_EJECUCION = 10
export const TOKENS_POR_DIA = 600_000

type Db = SupabaseClient
type Opciones = { adaptador?: Adaptador; env?: Record<string, string | undefined>; forzar?: boolean }

export type ResultadoRevision = {
  estado: 'revisada' | 'omitida_sin_cambios' | 'invalida' | 'no_en_agente'
  veredicto?: Veredicto; aplicadas?: Record<string, unknown>; tokens?: number
}

const issuesATexto = (q: unknown): string[] => {
  const o = (q ?? {}) as { bloqueantes?: unknown; avisos?: unknown }
  return [...(Array.isArray(o.bloqueantes) ? o.bloqueantes : []), ...(Array.isArray(o.avisos) ? o.avisos : [])].filter((x): x is string => typeof x === 'string')
}

export async function cargarFicha(db: Db, recetaId: string): Promise<FichaParaRevisar | null> {
  const { data: r } = await db.from('recetas')
    .select('id, nombre, estado, tipo_contenido, familia, categoria, tipo_plato, tipo_receta, descripcion, instrucciones, consejos, porciones, kcal, proteinas, carbohidratos, grasas, tags, url_origen, quality_issues, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, cantidad_gramos, orden, alimento:alimentos(nombre, calorias))')
    .eq('id', recetaId).maybeSingle()
  if (!r) return null
  const { count } = await db.from('receta_ingredientes').select('id', { count: 'exact', head: true }).eq('elaboracion_id', recetaId)
  const lineas = ((r.receta_ingredientes ?? []) as unknown as { nombre_libre: string | null; cantidad_gramos: number | null; orden: number | null; alimento: { nombre: string | null; calorias: number | null } | { nombre: string | null; calorias: number | null }[] | null }[])
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  return {
    id: r.id, nombre: r.nombre, estado: r.estado, tipo_contenido: r.tipo_contenido ?? 'plato', familia: r.familia, categoria: r.categoria, tipo_plato: r.tipo_plato,
    tipo_receta: r.tipo_receta, descripcion: r.descripcion, instrucciones: r.instrucciones, consejos: r.consejos, porciones: r.porciones, kcal: r.kcal,
    proteinas: r.proteinas, carbohidratos: r.carbohidratos, grasas: r.grasas, tags: r.tags, url_origen: r.url_origen,
    ingredientes: lineas.map(l => {
      const a = Array.isArray(l.alimento) ? l.alimento[0] : l.alimento
      return { nombre: l.nombre_libre ?? a?.nombre ?? '', alimento: a?.nombre ?? null, gramos: Number(l.cantidad_gramos) || 0, kcal100: a?.calorias ?? null }
    }),
    hallazgos_deterministas: issuesATexto(r.quality_issues),
    usada_en_recetas: count ?? 0,
  }
}

export async function tokensGastadosHoy(db: Db): Promise<number> {
  const { inicio, fin } = inicioFinDiaMadridUtc()
  const { data } = await db.from('recetas_revision_eventos').select('tokens_entrada, tokens_salida').gte('created_at', inicio).lt('created_at', fin).not('tokens_entrada', 'is', null)
  return (data ?? []).reduce((s, e) => s + (e.tokens_entrada ?? 0) + (e.tokens_salida ?? 0), 0)
}

export async function revisarFicha(db: Db, recetaId: string, o: Opciones = {}): Promise<ResultadoRevision> {
  const { data: fase } = await db.from('recetas').select('fase_revision').eq('id', recetaId).maybeSingle()
  const ficha = await cargarFicha(db, recetaId)
  if (!ficha || (fase?.fase_revision !== 'en_agente' && !o.forzar)) return { estado: 'no_en_agente' }

  const { data: ev } = await db.from('recetas_revision_eventos').select('tipo, nota, hash_ficha, created_at').eq('receta_id', recetaId).in('tipo', ['agente', 'devuelta']).order('created_at', { ascending: false }).limit(10)
  const ultimoAgente = (ev ?? []).find(e => e.tipo === 'agente')
  const ultimaDevuelta = (ev ?? []).find(e => e.tipo === 'devuelta')
  const nota: string | null = ultimaDevuelta?.nota ?? null
  const hash = hashFicha(ficha, nota)
  const devolucionNueva = Boolean(ultimaDevuelta && (!ultimoAgente || ultimaDevuelta.created_at > ultimoAgente.created_at))
  if (!devolucionNueva && ultimoAgente?.hash_ficha === hash) {
    await db.from('recetas').update({ fase_revision: 'segunda' }).eq('id', recetaId)
    return { estado: 'omitida_sin_cambios' }
  }

  const { sistema, usuario } = construirPrompt(ficha, nota)
  let tEntrada = 0, tSalida = 0, modelo = '', revision: RevisionAgente | null = null, motivo = ''
  for (let intento = 0; intento < 2 && !revision; intento++) {
    try {
      const r = await llamarIA('revision_receta', { sistema, usuario, json: true, maxTokens: 2500, presupuestoMs: 120_000 }, { adaptador: o.adaptador, env: o.env })
      tEntrada += r.uso.entrada ?? 0
      tSalida += r.uso.salida ?? 0
      modelo = `${r.proveedor}:${r.modelo}`
      const v = validarRevision(extraerJsonPlan(r.texto))
      if (v.ok) revision = v.revision; else motivo = v.motivo
    } catch (e) {
      motivo = e instanceof Error ? e.message.slice(0, 200) : 'fallo al llamar a la IA'
      break // llamarIA ya probó todos los modelos
    }
  }
  if (!revision) {
    await db.from('recetas_revision_eventos').insert({ receta_id: recetaId, tipo: 'error', actor: 'agente', nota: motivo, modelo: modelo || null, tokens_entrada: tEntrada, tokens_salida: tSalida, hash_ficha: hash })
    return { estado: 'invalida', tokens: tEntrada + tSalida }
  }

  const aplicadas = correccionesAplicables(revision, ficha)
  const tags = [...new Set([...(ficha.tags ?? []), ETIQUETA_REVISADA])]
  const { error } = await db.from('recetas').update({ ...aplicadas, tags, fase_revision: 'segunda' }).eq('id', recetaId)
  if (error) throw new Error('No se pudo guardar la revisión')
  // La huella guardada es la del estado FINAL (con lo que el propio agente ha aplicado): si Carlos no toca nada, no se vuelve a revisar
  const despues = await cargarFicha(db, recetaId)
  const hashFinal = despues ? hashFicha(despues, nota) : hash
  await db.from('recetas_revision_eventos').insert({
    receta_id: recetaId, tipo: 'agente', actor: 'agente', veredicto: revision.veredicto, confianza: revision.confianza, resumen: revision.resumen,
    hallazgos: revision.hallazgos, correcciones: revision.correcciones, aplicadas, modelo, tokens_entrada: tEntrada, tokens_salida: tSalida, hash_ficha: hashFinal,
  })
  return { estado: 'revisada', veredicto: revision.veredicto, aplicadas, tokens: tEntrada + tSalida }
}

export type ResumenEjecucion = { revisadas: number; omitidas: number; invalidas: number; paradoPorPresupuesto: boolean; tokens: number }

export async function revisarPendientes(db: Db, o: Opciones & { limite?: number; tokensDia?: number; soloIds?: string[]; hastaMs?: number } = {}): Promise<ResumenEjecucion> {
  let consulta = db.from('recetas').select('id').eq('estado', 'en_revision').eq('fase_revision', 'en_agente').order('updated_at', { ascending: true }).limit(200)
  if (o.soloIds) consulta = consulta.in('id', o.soloIds)
  const { data } = await consulta
  const resumen: ResumenEjecucion = { revisadas: 0, omitidas: 0, invalidas: 0, paradoPorPresupuesto: false, tokens: 0 }
  const limite = o.limite ?? LIMITE_POR_EJECUCION
  const tope = o.tokensDia ?? TOKENS_POR_DIA
  for (const { id } of data ?? []) {
    if (resumen.revisadas + resumen.omitidas + resumen.invalidas >= limite) break
    if (o.hastaMs && Date.now() > o.hastaMs) break
    if (await tokensGastadosHoy(db) >= tope) { resumen.paradoPorPresupuesto = true; break }
    const r = await revisarFicha(db, id, o)
    resumen.tokens += r.tokens ?? 0
    if (r.estado === 'revisada') resumen.revisadas++
    else if (r.estado === 'omitida_sin_cambios') resumen.omitidas++
    else if (r.estado === 'invalida') resumen.invalidas++
  }
  return resumen
}

/** Cuántas veces Carlos coincide con el veredicto del agente: lista↔aprobada es acuerdo; lista↔descartada/devuelta, desacuerdo; el resto no cuenta. */
export async function acuerdoConCarlos(db: Db): Promise<{ total: number; acuerdo: number }> {
  const { data } = await db.from('recetas_revision_eventos').select('receta_id, tipo, veredicto, created_at').in('tipo', ['agente', 'aprobada', 'descartada', 'devuelta']).order('created_at', { ascending: true }).limit(20000)
  const ultimoVeredicto = new Map<string, string | null>()
  let total = 0, acuerdo = 0
  for (const e of data ?? []) {
    if (e.tipo === 'agente') { ultimoVeredicto.set(e.receta_id, e.veredicto); continue }
    const v = ultimoVeredicto.get(e.receta_id)
    if (v !== 'lista') { ultimoVeredicto.delete(e.receta_id); continue }
    total++
    if (e.tipo === 'aprobada') acuerdo++
    ultimoVeredicto.delete(e.receta_id)
  }
  return { total, acuerdo }
}
