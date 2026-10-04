/**
 * Importa un lote de recetas cuyos ingredientes ya apuntan a alimentos verificados.
 * Las macros se calculan con los alimentos reales (no se confía en el JSON) y cada
 * receta debe cumplir los criterios del lote. Simula por defecto; inserta con --apply.
 *
 *   npx tsx scripts/importar-lote-verificado.ts scripts/lotes/<lote>.json [--apply] [--coach-email x]
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { autoTagReceta } from '../lib/auto-tag'
import { auditarLoteRecetas } from '../lib/recetas/post-import-audit'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

type Origen = 'vegetal' | 'huevo' | 'lacteo' | 'miel' | 'carne' | 'cerdo' | 'pescado' | 'marisco'
type AlimentoLote = { nombre: string; prefijo: string; rol: string; alergenos: string[]; origen: Origen }
type Perfil = 'pre' | 'post'
type Criterios = {
  kcal_min: number; kcal_max: number; proteina_pct_min?: number; proteina_pct_min_vegano?: number
  hc_pct_min?: number; grasa_pct_max?: number
}
type RecetaLote = {
  nombre: string; descripcion: string; tiempo_prep_min: number; porciones?: number
  tipo_plato?: string; perfil?: Perfil
  ingredientes: [string, number][]; instrucciones: string; consejos?: string
}
type Lote = {
  lote: string; tipo_plato: string; fuente: string
  apto_rendimiento?: boolean
  criterios?: Criterios
  criterios_por_perfil?: Partial<Record<Perfil, Criterios>>
  alimentos: Record<string, AlimentoLote>; recetas: RecetaLote[]
}
type AlimentoBD = { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number | null }

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const archivo = args.find(a => a.endsWith('.json'))
if (!archivo) throw new Error('Indica el JSON del lote')
const lote = JSON.parse(readFileSync(resolve(archivo), 'utf8')) as Lote

function intoleranciasDe(claves: string[]): string[] {
  const alims = claves.map(k => lote.alimentos[k])
  const positivos = new Set(alims.flatMap(a => a.alergenos))
  const origenes = new Set(alims.map(a => a.origen))
  const tags = [...positivos]
  if (!positivos.has('Gluten')) tags.push('Sin Gluten')
  if (!positivos.has('Lácteos')) tags.push('Sin Lactosa')
  if (!positivos.has('Huevos')) tags.push('Sin Huevo')
  if (!positivos.has('Frutos Secos') && !positivos.has('Cacahuetes')) tags.push('Sin Frutos Secos')
  if (!positivos.has('Soja')) tags.push('Sin Soja')
  if (!origenes.has('pescado')) tags.push('Sin Pescado')
  if (!origenes.has('marisco')) tags.push('Sin Mariscos')
  if (!origenes.has('cerdo')) tags.push('Sin Cerdo')
  const conCarneOPescado = ['carne', 'cerdo', 'pescado', 'marisco'].some(o => origenes.has(o as Origen))
  if (!conCarneOPescado) tags.push('Vegetariano')
  if (!conCarneOPescado && !['huevo', 'lacteo', 'miel'].some(o => origenes.has(o as Origen))) tags.push('Vegano')
  return tags
}

async function resolverCoachId(): Promise<string> {
  const email = args[args.indexOf('--coach-email') + 1]
  if (args.includes('--coach-email') && email) {
    const { data } = await db.from('profiles').select('id').eq('email', email).eq('role', 'coach').single()
    if (!data) throw new Error(`Coach ${email} no encontrado`)
    return data.id
  }
  if (process.env.NUTRICOACH_COACH_ID) return process.env.NUTRICOACH_COACH_ID
  throw new Error('Indica --coach-email o define NUTRICOACH_COACH_ID')
}

async function main() {
  const alimentos = new Map<string, AlimentoBD>()
  for (const [clave, a] of Object.entries(lote.alimentos)) {
    const { data, error } = await db.from('alimentos')
      .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
      .eq('nombre', a.nombre).eq('es_comestible', true)
    if (error) throw error
    const candidatos = (data ?? []).filter(x => x.id.startsWith(a.prefijo))
    if (candidatos.length !== 1) throw new Error(`Alimento "${clave}" (${a.nombre} / ${a.prefijo}) no resuelto: ${candidatos.length} coincidencias`)
    alimentos.set(clave, candidatos[0] as AlimentoBD)
  }
  console.log(`✓ ${alimentos.size} alimentos verificados en BD\n`)

  const aceptadas: Array<{ receta: RecetaLote; macros: Record<string, number>; intolerancias: string[] }> = []
  let rechazadas = 0

  for (const receta of lote.recetas) {
    const porciones = receta.porciones ?? 1
    const total = { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 }
    for (const [clave, gramos] of receta.ingredientes) {
      const a = alimentos.get(clave)
      if (!a) throw new Error(`"${receta.nombre}": ingrediente desconocido "${clave}"`)
      const f = gramos / 100
      total.kcal += a.calorias * f; total.p += a.proteinas * f; total.c += a.carbohidratos * f
      total.g += a.grasas * f; total.fibra += (a.fibra ?? 0) * f
    }
    const r = (v: number) => Math.round((v / porciones) * 10) / 10
    const macros = { kcal: Math.round(total.kcal / porciones), proteinas: r(total.p), carbohidratos: r(total.c), grasas: r(total.g), fibra: r(total.fibra) }
    const intolerancias = intoleranciasDe(receta.ingredientes.map(([k]) => k))
    const criterios = (receta.perfil && lote.criterios_por_perfil?.[receta.perfil]) || lote.criterios
    if (!criterios) throw new Error(`"${receta.nombre}": sin criterios para validar`)
    const pctP = (macros.proteinas * 4) / macros.kcal
    const pctC = (macros.carbohidratos * 4) / macros.kcal
    const pctG = (macros.grasas * 9) / macros.kcal
    const minP = (intolerancias.includes('Vegano') ? criterios.proteina_pct_min_vegano : undefined) ?? criterios.proteina_pct_min ?? 0

    const { count: duplicada } = await db.from('recetas').select('id', { count: 'exact', head: true }).ilike('nombre', receta.nombre)
    const motivos: string[] = []
    if (macros.kcal < criterios.kcal_min || macros.kcal > criterios.kcal_max) motivos.push(`kcal ${macros.kcal} fuera de ${criterios.kcal_min}-${criterios.kcal_max}`)
    if (pctP < minP) motivos.push(`proteína ${Math.round(pctP * 100)}% < ${Math.round(minP * 100)}%`)
    if (criterios.hc_pct_min && pctC < criterios.hc_pct_min) motivos.push(`hidratos ${Math.round(pctC * 100)}% < ${Math.round(criterios.hc_pct_min * 100)}%`)
    if (criterios.grasa_pct_max && pctG > criterios.grasa_pct_max) motivos.push(`grasa ${Math.round(pctG * 100)}% > ${Math.round(criterios.grasa_pct_max * 100)}%`)
    if (duplicada) motivos.push('ya existe una receta con ese nombre')

    const linea = `${receta.perfil ? `[${receta.perfil}] ` : ''}${String(macros.kcal).padStart(4)} kcal · P ${String(macros.proteinas).padStart(5)} (${Math.round(pctP * 100)}%) · C ${String(macros.carbohidratos).padStart(5)} (${Math.round(pctC * 100)}%) · G ${String(macros.grasas).padStart(4)} (${Math.round(pctG * 100)}%) · fibra ${macros.fibra}`
    if (motivos.length) {
      rechazadas++
      console.log(`✗ ${receta.nombre}\n    ${linea}\n    → ${motivos.join('; ')}`)
    } else {
      aceptadas.push({ receta, macros, intolerancias })
      console.log(`✓ ${receta.nombre}\n    ${linea} · ${intolerancias.filter(t => ['Vegano', 'Vegetariano', 'Sin Gluten', 'Sin Lactosa'].includes(t)).join(', ')}`)
    }
  }

  console.log(`\n${aceptadas.length} aceptadas · ${rechazadas} rechazadas`)
  if (!APPLY) { console.log('Simulación: nada insertado. Usa --apply para importar.'); return }
  if (rechazadas) throw new Error('Hay recetas rechazadas: corrige el lote antes de importar')

  const coachId = await resolverCoachId()
  const idsCreadas: string[] = []
  for (const { receta, macros, intolerancias } of aceptadas) {
    const ingredientesTag = receta.ingredientes.map(([k]) => ({ nombre_libre: alimentos.get(k)!.nombre }))
    const { data, error } = await db.from('recetas').insert({
      nombre: receta.nombre,
      descripcion: receta.descripcion,
      categoria: receta.tipo_plato ?? lote.tipo_plato,
      tipo_plato: receta.tipo_plato ?? lote.tipo_plato,
      ...(receta.perfil ? { es_pre_entreno: receta.perfil === 'pre', es_post_entreno: receta.perfil === 'post', apto_rendimiento: true } : lote.apto_rendimiento ? { apto_rendimiento: true } : {}),
      porciones: receta.porciones ?? 1,
      tiempo_prep_min: receta.tiempo_prep_min,
      ...macros,
      instrucciones: receta.instrucciones,
      consejos: receta.consejos ?? null,
      intolerancias,
      tags: autoTagReceta({ nombre: receta.nombre, receta_ingredientes: ingredientesTag }),
      estado: 'en_revision',
      coach_id: coachId,
      fuente: `${lote.fuente}:${lote.lote}`,
      fuente_tipo: 'ia_generada',
      taxonomia_version: 2,
      imagen_estado: 'sin_imagen',
      imagen_origen: 'missing',
      imagen_needs_review: true,
    }).select('id').single()
    if (error || !data) throw new Error(`Insert "${receta.nombre}": ${error?.message}`)

    const { error: ingError } = await db.from('receta_ingredientes').insert(receta.ingredientes.map(([k, gramos], orden) => ({
      receta_id: data.id,
      alimento_id: alimentos.get(k)!.id,
      nombre_libre: alimentos.get(k)!.nombre,
      cantidad_gramos: gramos,
      rol_ingrediente: lote.alimentos[k].rol,
      es_cantidad_fija: false,
      orden,
    })))
    if (ingError) {
      await db.from('recetas').delete().eq('id', data.id)
      throw new Error(`Ingredientes "${receta.nombre}": ${ingError.message} (receta revertida)`)
    }
    console.log(`  + ${receta.nombre} → ${data.id}`)
    idsCreadas.push(data.id)
  }
  console.log(`\n✅ ${aceptadas.length} recetas importadas en estado en_revision`)
  const auditoria = await auditarLoteRecetas(db as never, idsCreadas, 'script_importar_lote_verificado')
  console.log(`   Auditadas ${auditoria.length} (score medio ${(auditoria.reduce((t, a) => t + a.score, 0) / (auditoria.length || 1)).toFixed(1)}, aprobables ${auditoria.filter(a => a.aprobable).length})`)
}

main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })
