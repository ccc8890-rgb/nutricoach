// Corrige ingredientes inventados/mal etiquetados detectados en la auditoría del 01-10-2026:
//  1. "Caseína micelar" (16 recetas, 2-10 g): añadido por la IA al refinar; el original no la lleva.
//  2. "Pato (pechuga sin piel)" (8 recetas que son de pollo/pavo): etiqueta (y en 3 casos el alimento) erróneos.
//  3. Tortitas de plátano y chocolate sin azúcar: el original (TikTok) lleva zumo de LIMÓN, levadura y nada de caseína.
// Simula por defecto; --apply escribe y guarda copia en salidas/. Uso: npx tsx scripts/fix-ingredientes-inventados-2026-10-01.ts [--apply]
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

type Al = { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number | null }
type Fila = { id: string; receta_id: string; nombre_libre: string | null; cantidad_gramos: number; alimento_id: string | null; alimento: Al | null }
const copia: unknown[] = []

async function alimento(prefijo: string, nombre: string): Promise<Al> {
  const { data } = await db.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra').eq('nombre', nombre).eq('es_comestible', true)
  const a = (data ?? []).find(x => x.id.startsWith(prefijo))
  if (!a) throw new Error(`Alimento no encontrado: ${nombre} ${prefijo}`)
  return a as Al
}

function macros(filas: { cantidad_gramos: number; alimento: Al | null }[], porciones: number) {
  const t = filas.reduce((a, f) => {
    if (!f.alimento) return a
    const g = f.cantidad_gramos / 100
    return { kcal: a.kcal + f.alimento.calorias * g, p: a.p + f.alimento.proteinas * g, c: a.c + f.alimento.carbohidratos * g, g: a.g + f.alimento.grasas * g, f: a.f + (f.alimento.fibra ?? 0) * g }
  }, { kcal: 0, p: 0, c: 0, g: 0, f: 0 })
  const por = Math.max(1, porciones), rd = (v: number) => Math.round((v / por) * 10) / 10
  return { kcal: Math.round(t.kcal / por), proteinas: rd(t.p), carbohidratos: rd(t.c), grasas: rd(t.g), fibra: rd(t.f) }
}

async function cargar(recetaId: string) {
  const { data: r } = await db.from('recetas').select('id, nombre, porciones, kcal, proteinas, carbohidratos, grasas, fibra, instrucciones').eq('id', recetaId).single()
  const { data: filas } = await db.from('receta_ingredientes').select('id, receta_id, nombre_libre, cantidad_gramos, alimento_id, alimento:alimentos(id, nombre, calorias, proteinas, carbohidratos, grasas, fibra)').eq('receta_id', recetaId)
  return { r: r!, filas: (filas ?? []) as unknown as Fila[] }
}

async function guardarMacros(r: { id: string; nombre: string; porciones: number | null; kcal: number }, filas: { cantidad_gramos: number; alimento: Al | null }[], extra: Record<string, unknown> = {}) {
  const nuevo = macros(filas, Number(r.porciones ?? 1))
  console.log(`   ${r.nombre.slice(0, 46).padEnd(47)} ${String(Math.round(r.kcal)).padStart(4)} → ${String(nuevo.kcal).padStart(4)} kcal`)
  if (APPLY) { const { error } = await db.from('recetas').update({ ...nuevo, ...extra }).eq('id', r.id); if (error) throw error }
}

async function main() {
  console.log(APPLY ? 'MODO: aplicar\n' : 'MODO: simulación\n')

  // ── 1. Caseína micelar ────────────────────────────────────────────────────────
  console.log('1. Caseína micelar')
  const { data: cas } = await db.from('receta_ingredientes').select('receta_id').ilike('nombre_libre', '%case_na%')
  const EDITOS: Record<string, [string, string][]> = {
    'Pastel de zanahoria y plátano saludable': [['proteína en polvo (Overnight Oats y caseína)', 'proteína en polvo de vainilla']],
    'Donuts choco Zanahoria': [['el cacao en polvo, la canela y la caseína micelar.', 'el cacao en polvo y la canela.']],
    'Bizcocho Humedo Chocolate': [['el cacao en polvo, la caseína y la sal.', 'el cacao en polvo y la sal.']],
    'Salsas de yogur altas en proteína': [[' y 2 g de caseína micelar en polvo (opcional para más proteína)', '']],
    'Tortitas de plátano y chocolate sin azúcar': [['la harina de avena, la caseína, el bicarbonato y la sal.', 'la harina de avena, la levadura, el bicarbonato y la sal.'], ['el zumo de naranja', 'el zumo de limón']],
  }
  for (const id of [...new Set((cas ?? []).map(c => c.receta_id))]) {
    const { r, filas } = await cargar(id)
    const quitar = filas.filter(f => /case[ií]na/i.test(f.nombre_libre ?? ''))
    let instrucciones = r.instrucciones ?? ''
    for (const [a, b] of EDITOS[r.nombre] ?? []) {
      if (!instrucciones.includes(a)) console.log(`   ⚠ texto no encontrado en "${r.nombre}": ${a}`)
      instrucciones = instrucciones.replace(a, b)
    }
    copia.push({ receta: { id: r.id, nombre: r.nombre, kcal: r.kcal, proteinas: r.proteinas, instrucciones: r.instrucciones }, filas_borradas: quitar })
    let resto = filas.filter(f => !quitar.includes(f))
    // Tortitas: el original lleva zumo de limón (no naranja) y 4 g de levadura
    const extra: Record<string, unknown> = instrucciones !== r.instrucciones ? { instrucciones } : {}
    if (r.nombre === 'Tortitas de plátano y chocolate sin azúcar') {
      const limon = await alimento('12a8ab46', 'Zumo de limón'), levadura = await alimento('ea0ddb41', 'levadura quimica')
      const naranja = resto.find(f => /naranja/i.test(f.nombre_libre ?? ''))
      if (naranja) {
        if (APPLY) await db.from('receta_ingredientes').update({ alimento_id: limon.id, nombre_libre: 'Zumo de limón' }).eq('id', naranja.id)
        resto = resto.map(f => (f === naranja ? { ...f, alimento: limon } : f))
      }
      if (APPLY) await db.from('receta_ingredientes').insert({ receta_id: r.id, alimento_id: levadura.id, nombre_libre: 'Levadura química', cantidad_gramos: 4, rol_ingrediente: 'especias_aromaticos', es_cantidad_fija: true, orden: 99 })
      resto = [...resto, { cantidad_gramos: 4, alimento: levadura } as Fila]
    }
    if (APPLY && quitar.length) await db.from('receta_ingredientes').delete().in('id', quitar.map(f => f.id))
    await guardarMacros(r, resto, extra)
  }

  // ── 2. "Pato (pechuga sin piel)" en recetas de pollo/pavo ─────────────────────
  console.log('\n2. Pato → pollo/pavo')
  const pollo = await alimento('4ad8714c', 'Pechuga de pollo'), pavo = await alimento('7312fdee', 'Pechuga de pavo')
  const { data: patos } = await db.from('receta_ingredientes').select('id, receta_id, nombre_libre, alimento:alimentos(nombre)').ilike('nombre_libre', 'pato%')
  for (const p of patos ?? []) {
    const { r, filas } = await cargar(p.receta_id)
    const esPavo = /pavo/i.test(r.nombre) && !/pollo/i.test(r.nombre)
    const destino = esPavo ? pavo : pollo
    const fila = filas.find(f => f.id === p.id)!
    const eraPato = /pato/i.test(fila.alimento?.nombre ?? '')
    copia.push({ receta: { id: r.id, nombre: r.nombre, kcal: r.kcal }, fila: { id: fila.id, nombre_libre: fila.nombre_libre, alimento_id: fila.alimento_id } })
    console.log(`   ${r.nombre.slice(0, 50).padEnd(51)} → ${destino.nombre}${eraPato ? ' (estaba vinculado a pato)' : ' (solo etiqueta)'}`)
    if (APPLY) await db.from('receta_ingredientes').update({ nombre_libre: destino.nombre, ...(eraPato ? { alimento_id: destino.id } : {}) }).eq('id', fila.id)
    if (eraPato) await guardarMacros(r, filas.map(f => (f.id === fila.id ? { ...f, alimento: destino } : f)))
  }

  if (APPLY) { writeFileSync(join(__dirname, '..', 'salidas', 'copia-fix-ingredientes-inventados-2026-10-01.json'), JSON.stringify(copia, null, 1)); console.log('\n✅ aplicado. Copia en salidas/') }
  else console.log('\nSimulación: nada escrito. Usa --apply.')
}
main().catch(e => { console.error(e.message ?? e); process.exit(1) })
