// Prueba de extremo a extremo con datos temporales (ZZ-PRUEBA-*) que se borran al terminar.
// Uso: npx tsx scripts/probar-enlace-elaboraciones.ts
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import assert from 'node:assert/strict'
import { expandirIngredientes, expandirRecetas, recalcularMacrosReceta, propagarCambioElaboracion, enlaceCreaCiclo, nivelesAlEnlazar, ETIQUETA_REVISAR_ALERGENOS } from '../lib/recetas/elaboraciones-db'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) as any
const cerca = (a: number, b: number, tol = 0.15) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`)

async function main() {
  const ids: { recetas: string[] } = { recetas: [] }
  try {
    const { data: base } = await db.from('recetas').select('coach_id').limit(1).single()
    const { data: als } = await db.from('alimentos').select('id, nombre, calorias').gt('calorias', 50).lt('calorias', 600).limit(2)
    const [A, B] = als!
    const nueva = async (nombre: string, extra: object) => {
      const { data, error } = await db.from('recetas').insert({ nombre, coach_id: base!.coach_id, porciones: 1, ...extra }).select('id').single()
      if (error) throw error; ids.recetas.push(data.id); return data.id as string
    }
    const E = await nueva('ZZ-PRUEBA-ELAB', { estado: 'aprobada', tipo_receta: 'salsa_base', categoria: 'Salsa', tipo_plato: 'Comida' })
    const R = await nueva('ZZ-PRUEBA-REC', { estado: 'descartada', tipo_receta: 'completa', categoria: 'Comida', tipo_plato: 'Comida', porciones: 2 })
    const lin = async (receta_id: string, extra: object) => { const { error } = await db.from('receta_ingredientes').insert({ receta_id, ...extra }); if (error) throw error }
    await lin(E, { alimento_id: A.id, nombre_libre: A.nombre, cantidad_gramos: 200, orden: 0 })
    await lin(E, { alimento_id: B.id, nombre_libre: B.nombre, cantidad_gramos: 100, orden: 1 })
    await lin(R, { alimento_id: A.id, nombre_libre: A.nombre, cantidad_gramos: 100, orden: 0 })
    await lin(R, { elaboracion_id: E, nombre_libre: 'ZZ-PRUEBA-ELAB', cantidad_gramos: 150, orden: 1 })

    // (a) macros = fórmula manual: E pesa 300 g, se usan 150 → A 100 g + B 50 g; R = A 200 g + B 50 g en 2 raciones
    const esperado = (a: number, b: number) => (A.calorias * a + B.calorias * b) / 100 / 2
    const r1 = await recalcularMacrosReceta(db, R); cerca(r1!.kcal, esperado(200, 50)); console.log('(a) kcal', r1!.kcal, 'esperado', esperado(200, 50).toFixed(1))

    // (b) peso final 200 g → factor 0,75 → A 150 + B 75 en la elaboración usada; R = A 250 g + B 75 g
    await db.from('recetas').update({ peso_final_g: 200 }).eq('id', E)
    const n = await propagarCambioElaboracion(db, E); assert.ok(n >= 2, `propagadas ${n}`)
    const { data: rr } = await db.from('recetas').select('kcal, tags').eq('id', R).single()
    cerca(Number(rr.kcal), esperado(250, 75)); console.log('(b) kcal tras peso final', rr.kcal, 'esperado', esperado(250, 75).toFixed(1), '· propagadas', n)

    // (c) ciclos
    assert.equal(await enlaceCreaCiclo(db, E, [R]), true)
    assert.equal(await enlaceCreaCiclo(db, R, [E]), false)
    assert.equal(await enlaceCreaCiclo(db, E, [E]), true); console.log('(c) ciclos OK')

    // (d) expandir
    const { data: filas } = await db.from('receta_ingredientes').select('id, alimento_id, elaboracion_id, nombre_libre, cantidad_gramos, orden, alimento:alimentos(id, nombre, calorias, proteinas, carbohidratos, grasas, fibra)').eq('receta_id', R)
    const planas = await expandirIngredientes(db, filas, R)
    assert.ok(planas.every((f: any) => !f.elaboracion_id) && planas.length === 3, `líneas ${planas.length}`)
    const g = (id: string) => planas.filter((f: any) => f.alimento_id === id).reduce((s: number, f: any) => s + f.cantidad_gramos, 0)
    cerca(g(A.id), 250, 0.01); cerca(g(B.id), 75, 0.01); console.log('(d) expandir OK')

    // (f) bloque: expandirRecetas (compra, detalle del día, planificador…) deja una sola línea por alimento base tras agrupar
    const { data: recs } = await db.from('recetas').select('id, receta_ingredientes!receta_ingredientes_receta_id_fkey(alimento_id, elaboracion_id, cantidad_gramos, alimento:alimentos(id, nombre))').in('id', [R])
    const [rx] = await expandirRecetas(db, recs)
    const gx = (id: string) => rx.receta_ingredientes.filter((f: any) => f.alimento_id === id).reduce((t: number, f: any) => t + f.cantidad_gramos, 0)
    assert.ok(rx.receta_ingredientes.every((f: any) => !f.elaboracion_id)); cerca(gx(A.id), 250, 0.01); cerca(gx(B.id), 75, 0.01); console.log('(f) expandirRecetas OK')

    // (g) revisión independiente: una elaboración EN REVISIÓN sigue contando en las recetas que ya la llevan
    await db.from('recetas').update({ estado: 'en_revision' }).eq('id', E)
    const antes = Number((await db.from('recetas').select('kcal').eq('id', R).single()).data.kcal)
    await recalcularMacrosReceta(db, R)
    const despues = Number((await db.from('recetas').select('kcal').eq('id', R).single()).data.kcal)
    cerca(despues, antes, 0.01); console.log('(g) elaboración en revisión sigue contando OK')

    // (h) niveles: 1 con la elaboración suelta; 2 si lleva otra dentro; 3 si lleva otra dentro de esa
    assert.equal(await nivelesAlEnlazar(db, [E]), 1)
    const E2 = await nueva('ZZ-PRUEBA-ELAB2', { estado: 'aprobada', tipo_receta: 'salsa_base', categoria: 'Elaboración', tipo_plato: 'Comida' })
    await lin(E, { elaboracion_id: E2, nombre_libre: 'ZZ-PRUEBA-ELAB2', cantidad_gramos: 10, orden: 5 })
    assert.equal(await nivelesAlEnlazar(db, [E]), 2)
    const E3 = await nueva('ZZ-PRUEBA-ELAB3', { estado: 'aprobada', tipo_receta: 'salsa_base', categoria: 'Elaboración', tipo_plato: 'Comida' })
    await lin(E2, { elaboracion_id: E3, nombre_libre: 'ZZ-PRUEBA-ELAB3', cantidad_gramos: 10, orden: 0 })
    assert.equal(await nivelesAlEnlazar(db, [E]), 3); console.log('(h) niveles OK')

    // (e) etiqueta
    assert.ok((rr.tags ?? []).includes(ETIQUETA_REVISAR_ALERGENOS)); console.log('(e) etiqueta OK')
    console.log('\nTODO OK')
  } finally {
    for (const id of ids.recetas) await db.from('receta_ingredientes').delete().eq('receta_id', id)
    for (const id of ids.recetas.slice().reverse()) await db.from('recetas').delete().eq('id', id)
    const { count } = await db.from('recetas').select('id', { count: 'exact', head: true }).like('nombre', 'ZZ-PRUEBA-%')
    console.log('restos ZZ-PRUEBA:', count)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
