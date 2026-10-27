// Orquestación del revisor de recetas (servidor): cargar ficha → ¿ha cambiado? → IA → validar → guardar → aplicar lo seguro → 2ª revisión.
import type { SupabaseClient } from '@supabase/supabase-js'
import { llamarIA, ErrorIA, type Adaptador } from '@/lib/ia/enrutador'
import { extraerJsonPlan } from '@/lib/entrenos/evidencia-plan'
import { inicioFinDiaMadridUtc } from '@/lib/recetas/revision'
import { construirPrompt } from './prompt'
import { correccionesAplicables, hashFicha, validarRevision, type FichaParaRevisar, type RevisionAgente, type Veredicto } from './esquema'

export const ETIQUETA_REVISADA = 'Revisada por el agente'
export const LIMITE_POR_EJECUCION = 10
export const TOKENS_POR_DIA = 150_000

type Db = SupabaseClient
type Opciones = { adaptador?: Adaptador; env?: Record<string, string | undefined>; forzar?: boolean; presupuestoMs?: number }

export type ResultadoRevision = {
  estado: 'revisada' | 'omitida_sin_cambios' | 'invalida' | 'sin_resolver' | 'cambiada' | 'no_en_agente'
  veredicto?: Veredicto; aplicadas?: Record<string, unknown>; tokens?: number
}

const textoFuente = (raw: unknown): string | null => {
  const t = (raw as { texto?: unknown } | null)?.texto
  return typeof t === 'string' && t.trim().length >= 40 ? t.slice(0, 8000) : null
}

const issuesATexto = (q: unknown): string[] => {
  const o = (q ?? {}) as { bloqueantes?: unknown; avisos?: unknown }
  return [...(Array.isArray(o.bloqueantes) ? o.bloqueantes : []), ...(Array.isArray(o.avisos) ? o.avisos : [])].filter((x): x is string => typeof x === 'string')
}

export async function cargarFicha(db: Db, recetaId: string): Promise<FichaParaRevisar | null> {
  const { data: r } = await db.from('recetas')
    .select('id, nombre, estado, tipo_contenido, familia, categoria, tipo_plato, tipo_receta, descripcion, instrucciones, consejos, porciones, kcal, proteinas, carbohidratos, grasas, tags, url_origen, raw_scrape, quality_issues, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, cantidad_gramos, cantidad_original, unidad_display, orden, alimento:alimentos(nombre, calorias))')
    .eq('id', recetaId).maybeSingle()
  if (!r) return null
  const { count } = await db.from('receta_ingredientes').select('id', { count: 'exact', head: true }).eq('elaboracion_id', recetaId)
  const lineas = ((r.receta_ingredientes ?? []) as unknown as { nombre_libre: string | null; cantidad_gramos: number | null; cantidad_original: number | null; unidad_display: string | null; orden: number | null; alimento: { nombre: string | null; calorias: number | null } | { nombre: string | null; calorias: number | null }[] | null }[])
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  return {
    id: r.id, nombre: r.nombre, estado: r.estado, tipo_contenido: r.tipo_contenido ?? 'plato', familia: r.familia, categoria: r.categoria, tipo_plato: r.tipo_plato,
    tipo_receta: r.tipo_receta, descripcion: r.descripcion, instrucciones: r.instrucciones, consejos: r.consejos, porciones: r.porciones, kcal: r.kcal,
    proteinas: r.proteinas, carbohidratos: r.carbohidratos, grasas: r.grasas, tags: r.tags, url_origen: r.url_origen,
    ingredientes: lineas.map(l => {
      const a = Array.isArray(l.alimento) ? l.alimento[0] : l.alimento
      return { nombre: l.nombre_libre ?? a?.nombre ?? '', alimento: a?.nombre ?? null, gramos: Number(l.cantidad_gramos) || 0, kcal100: a?.calorias ?? null,
        // Solo hay cantidad dicha si la dijo el vídeo; si no, los gramos son una estimación del sistema
        cantidad_dicha: l.cantidad_original ? `${l.cantidad_original} ${l.unidad_display ?? ''}`.trim() : null }
    }),
    hallazgos_deterministas: issuesATexto(r.quality_issues),
    usada_en_recetas: count ?? 0,
    fuente_texto: textoFuente(r.raw_scrape),
  }
}

export async function tokensGastadosHoy(db: Db): Promise<number> {
  const { inicio, fin } = inicioFinDiaMadridUtc()
  const { data } = await db.from('recetas_revision_eventos').select('tokens_entrada, tokens_salida').gte('created_at', inicio).lt('created_at', fin).not('tokens_entrada', 'is', null)
  return (data ?? []).reduce((s, e) => s + (e.tokens_entrada ?? 0) + (e.tokens_salida ?? 0), 0)
}

const ERRORES_MAXIMOS = 2           // tras 2 intentos fallidos con el mismo contenido, la ficha pasa a 2ª revisión con aviso (y deja de gastar)
const MARGEN_MINIMO_MS = 20_000     // con menos tiempo del que cabe una revisión no se empieza (se perdería lo pagado)

export async function revisarFicha(db: Db, recetaId: string, o: Opciones = {}): Promise<ResultadoRevision> {
  const { data: actual } = await db.from('recetas').select('estado, fase_revision').eq('id', recetaId).maybeSingle()
  const faseOrigen: string | null = actual?.fase_revision ?? null
  // Solo fichas en revisión, y «con el agente» salvo que se fuerce (nunca una aprobada o descartada)
  if (!actual || actual.estado !== 'en_revision' || (faseOrigen !== 'en_agente' && !o.forzar)) return { estado: 'no_en_agente' }
  const ficha = await cargarFicha(db, recetaId)
  if (!ficha) return { estado: 'no_en_agente' }

  // Toda escritura sobre la ficha exige que SIGA en revisión y en la misma fase: si Carlos la aprobó, la devolvió o la movió
  // mientras el agente esperaba a la IA, el resultado se descarta en vez de pisar lo que hizo.
  const guardar = async (parche: Record<string, unknown>): Promise<boolean> => {
    let q = db.from('recetas').update(parche).eq('id', recetaId).eq('estado', 'en_revision')
    q = faseOrigen ? q.eq('fase_revision', faseOrigen) : q.is('fase_revision', null)
    const { data } = await q.select('id')
    return (data?.length ?? 0) > 0
  }

  const { data: ev } = await db.from('recetas_revision_eventos').select('tipo, nota, hash_ficha, created_at').eq('receta_id', recetaId).in('tipo', ['agente', 'devuelta', 'error']).order('created_at', { ascending: false }).limit(20)
  const ultimoAgente = (ev ?? []).find(e => e.tipo === 'agente')
  const ultimaDevuelta = (ev ?? []).find(e => e.tipo === 'devuelta')
  const nota: string | null = ultimaDevuelta?.nota ?? null
  const hash = hashFicha(ficha, nota)
  const devolucionNueva = Boolean(ultimaDevuelta && (!ultimoAgente || ultimaDevuelta.created_at > ultimoAgente.created_at))
  if (!devolucionNueva && ultimoAgente?.hash_ficha === hash) {
    await guardar({ fase_revision: 'segunda' })
    return { estado: 'omitida_sin_cambios' }
  }
  let erroresSeguidos = 0
  for (const e of ev ?? []) { if (e.tipo === 'error' && e.hash_ficha === hash) erroresSeguidos++; else break }

  const { sistema, usuario } = construirPrompt(ficha, nota)
  const hasta = Date.now() + (o.presupuestoMs ?? 120_000)
  let tEntrada = 0, tSalida = 0, modelo = '', revision: RevisionAgente | null = null, motivo = ''
  const fallos: string[] = []
  for (let intento = 0; intento < 2 && !revision; intento++) {
    const restante = hasta - Date.now()
    if (restante < MARGEN_MINIMO_MS) { motivo = motivo || 'sin tiempo para revisarla'; break }
    try {
      const r = await llamarIA('revision_receta', { sistema, usuario, json: true, maxTokens: 3000, presupuestoMs: restante, esfuerzo: 'low' }, { adaptador: o.adaptador, env: o.env })
      tEntrada += r.usoTotal.entrada
      tSalida += r.usoTotal.salida
      modelo = `${r.proveedor}:${r.modelo}`
      for (const i of r.intentos) if (!i.ok) fallos.push(`${i.modelo}: ${i.error ?? 'fallo'}`)
      const v = validarRevision(extraerJsonPlan(r.texto))
      if (v.ok) revision = v.revision; else motivo = v.motivo
    } catch (e) {
      // Lo que respondió y no sirvió también se pagó: se apunta aunque falle
      if (e instanceof ErrorIA) for (const i of e.intentos) { tEntrada += i.uso?.entrada ?? 0; tSalida += i.uso?.salida ?? 0 }
      motivo = e instanceof Error ? e.message.slice(0, 200) : 'fallo al llamar a la IA'
      break // llamarIA ya probó todos los modelos
    }
  }
  const tokens = tEntrada + tSalida

  if (!revision) {
    await db.from('recetas_revision_eventos').insert({ receta_id: recetaId, tipo: 'error', actor: 'agente', nota: motivo, modelo: modelo || null, tokens_entrada: tEntrada, tokens_salida: tSalida, hash_ficha: hash })
    if (erroresSeguidos + 1 >= ERRORES_MAXIMOS) {
      // No se puede seguir pagando por lo mismo: a 2ª revisión con un aviso claro para Carlos
      await db.from('recetas_revision_eventos').insert({
        receta_id: recetaId, tipo: 'agente', actor: 'agente', veredicto: 'revisar', confianza: 0, hallazgos: [], correcciones: [], aplicadas: {},
        resumen: 'El agente no pudo revisar esta ficha (respuestas inválidas repetidas). Revísala a mano.', hash_ficha: hash, tokens_entrada: 0, tokens_salida: 0,
      })
      await guardar({ fase_revision: 'segunda' })
      return { estado: 'sin_resolver', tokens }
    }
    // Se queda con el agente, pero al final de la cola (updated_at es una columna normal: la actualizamos a mano)
    await guardar({ updated_at: new Date().toISOString() })
    return { estado: 'invalida', tokens }
  }

  const aplicables = correccionesAplicables(revision, ficha)
  const { data: frescas } = await db.from('recetas').select('tags').eq('id', recetaId).maybeSingle()
  const tags = [...new Set([...(frescas?.tags ?? ficha.tags ?? []), ETIQUETA_REVISADA])]
  const guardado = await guardar({ ...aplicables, tags, fase_revision: 'segunda' })
  if (!guardado) {
    await db.from('recetas_revision_eventos').insert({ receta_id: recetaId, tipo: 'error', actor: 'agente', nota: 'La ficha cambió mientras se revisaba; resultado descartado', modelo, tokens_entrada: tEntrada, tokens_salida: tSalida, hash_ficha: hash })
    return { estado: 'cambiada', tokens }
  }
  // Lo anterior de cada campo que se cambió, por si Carlos quiere deshacerlo
  const antes = Object.fromEntries(Object.keys(aplicables).map(k => [k, (ficha as unknown as Record<string, unknown>)[k] ?? null]))
  const aplicadas = Object.keys(aplicables).length ? { ...aplicables, _antes: antes } : {}
  // La huella guardada es la del estado FINAL (con lo que el propio agente ha aplicado): si Carlos no toca nada, no se vuelve a revisar
  const despues = await cargarFicha(db, recetaId)
  const hashFinal = despues ? hashFicha(despues, nota) : hash
  await db.from('recetas_revision_eventos').insert({
    receta_id: recetaId, tipo: 'agente', actor: 'agente', nota: fallos.length ? `Intentos fallidos: ${fallos.join(' | ')}`.slice(0, 400) : null,
    veredicto: revision.veredicto, confianza: revision.confianza, resumen: revision.resumen, hallazgos: revision.hallazgos, correcciones: revision.correcciones,
    aplicadas, modelo, tokens_entrada: tEntrada, tokens_salida: tSalida, hash_ficha: hashFinal,
  })
  return { estado: 'revisada', veredicto: revision.veredicto, aplicadas: aplicables, tokens }
}

/** Saca fichas del circuito de revisión (aprobar, descartar, volver a nuevas): sin fase, sin la etiqueta del agente y con el rastro si procede. */
export async function salirDelCircuito(db: Db, ids: string[], evento?: 'aprobada' | 'descartada'): Promise<void> {
  if (ids.length === 0) return
  await db.from('recetas').update({ fase_revision: null }).in('id', ids)
  const { data: conEtiqueta } = await db.from('recetas').select('id, tags').in('id', ids).contains('tags', [ETIQUETA_REVISADA])
  for (const r of conEtiqueta ?? []) await db.from('recetas').update({ tags: ((r.tags ?? []) as string[]).filter(t => t !== ETIQUETA_REVISADA) }).eq('id', r.id)
  if (evento) await db.from('recetas_revision_eventos').insert(ids.map(id => ({ receta_id: id, tipo: evento, actor: 'carlos' })))
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
    // Sin margen de tiempo no se empieza: una llamada cortada a medias se paga y no deja rastro
    const quedan = o.hastaMs ? o.hastaMs - Date.now() : undefined
    if (quedan !== undefined && quedan < MARGEN_MINIMO_MS + 5_000) break
    if (await tokensGastadosHoy(db) >= tope) { resumen.paradoPorPresupuesto = true; break }
    try {
      const r = await revisarFicha(db, id, { ...o, presupuestoMs: quedan !== undefined ? Math.min(120_000, quedan) : o.presupuestoMs })
      resumen.tokens += r.tokens ?? 0
      if (r.estado === 'revisada') resumen.revisadas++
      else if (r.estado === 'omitida_sin_cambios') resumen.omitidas++
      else if (r.estado === 'invalida' || r.estado === 'sin_resolver' || r.estado === 'cambiada') resumen.invalidas++
    } catch (e) {
      // Un fallo en una ficha no para la ejecución
      resumen.invalidas++
      console.error('[revisor]', id.slice(0, 8), e instanceof Error ? e.message : e)
    }
  }
  return resumen
}

/** Cuántas veces Carlos coincide con el veredicto del agente: lista↔aprobada es acuerdo; lista↔descartada/devuelta, desacuerdo; el resto no cuenta. */
export async function acuerdoConCarlos(db: Db): Promise<{ total: number; acuerdo: number }> {
  const desde = new Date(Date.now() - 365 * 86_400_000).toISOString()
  const { data } = await db.from('recetas_revision_eventos').select('receta_id, tipo, veredicto, created_at').in('tipo', ['agente', 'aprobada', 'descartada', 'devuelta']).gte('created_at', desde).order('created_at', { ascending: true }).limit(20000)
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
