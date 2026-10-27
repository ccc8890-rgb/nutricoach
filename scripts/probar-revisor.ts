// Prueba de extremo a extremo del revisor con datos temporales (ZZ-PRUEBA-*) y una IA SIMULADA (no gasta). Uso: npx tsx scripts/probar-revisor.ts
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import assert from 'node:assert/strict'
import { revisarFicha, revisarPendientes, acuerdoConCarlos, tokensGastadosHoy } from '../lib/recetas/revisor/revisar'
import type { Adaptador } from '../lib/ia/enrutador'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) as any
const ENV = { ANTHROPIC_API_KEY: 'simulada' } // solo Sonnet tiene «clave»: una llamada por intento

let llamadas = 0
const respuestas: string[] = []
const adaptador: Adaptador = async () => { llamadas++; return { texto: respuestas.shift() ?? 'no soy json', uso: { entrada: 1000, salida: 200 } } }
const ok = (extra: Record<string, unknown> = {}) => JSON.stringify({ tipo_contenido: 'plato', familia: 'Pastas', confianza: 0.9, veredicto: 'lista', resumen: 'Coherente', hallazgos: [], correcciones: [{ campo: 'familia', valor: 'Pastas', segura: true }], ...extra })

async function main() {
  const ids: string[] = []
  try {
    const { data: base } = await db.from('recetas').select('coach_id').limit(1).single()
    const { data: als } = await db.from('alimentos').select('id, nombre').gt('calorias', 50).lt('calorias', 600).limit(2)
    const nueva = async (nombre: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await db.from('recetas').insert({
        nombre, coach_id: base.coach_id, estado: 'en_revision', fase_revision: 'en_agente', tipo_contenido: 'plato', categoria: 'Comida', tipo_plato: 'Comida', tipo_receta: 'completa',
        porciones: 2, instrucciones: 'Cuece la pasta en agua con sal. Saltea la verdura. Mezcla todo y sirve caliente con un poco de aceite.', ...extra,
      }).select('id').single()
      if (error) throw error; ids.push(data.id)
      for (const [i, a] of als.entries()) await db.from('receta_ingredientes').insert({ receta_id: data.id, alimento_id: a.id, nombre_libre: a.nombre, cantidad_gramos: 100 + i * 50, orden: i })
      await db.from('recetas_revision_eventos').insert({ receta_id: data.id, tipo: 'al_agente', actor: 'carlos' })
      return data.id as string
    }
    const leer = async (id: string) => (await db.from('recetas').select('estado, fase_revision, familia, tipo_contenido, tags, categoria').eq('id', id).single()).data
    const eventos = async (id: string) => (await db.from('recetas_revision_eventos').select('tipo, tokens_entrada, tokens_salida, nota').eq('receta_id', id).order('created_at')).data as { tipo: string; tokens_entrada: number | null; tokens_salida: number | null; nota: string | null }[]

    // (a) respuesta válida: guarda el veredicto, aplica la familia segura y pasa a 2ª revisión sin tocar el estado
    const A = await nueva('ZZ-PRUEBA-A pasta con verduras')
    respuestas.push(ok())
    const rA = await revisarFicha(db, A, { adaptador, env: ENV })
    assert.equal(rA.estado, 'revisada'); assert.equal(rA.veredicto, 'lista'); assert.equal(llamadas, 1)
    const fa = await leer(A)
    assert.equal(fa.fase_revision, 'segunda'); assert.equal(fa.estado, 'en_revision'); assert.equal(fa.familia, 'Pastas'); assert.ok(fa.tags.includes('Revisada por el agente'))
    const ea = (await eventos(A)).find(e => e.tipo === 'agente'); assert.ok(ea && ea.tokens_entrada === 1000 && ea.tokens_salida === 200)
    console.log('(a) revisión válida OK')

    // (b) sin cambios: no vuelve a llamar al modelo (pasa a 2ª revisión igualmente)
    await db.from('recetas').update({ fase_revision: 'en_agente' }).eq('id', A)
    const rB = await revisarFicha(db, A, { adaptador, env: ENV })
    assert.equal(rB.estado, 'omitida_sin_cambios'); assert.equal(llamadas, 1); assert.equal((await leer(A)).fase_revision, 'segunda')
    console.log('(b) sin cambios no gasta OK')

    // (c) devuelta con nota: vuelve a revisar aunque el contenido sea el mismo
    await db.from('recetas_revision_eventos').insert({ receta_id: A, tipo: 'devuelta', actor: 'carlos', nota: 'Mira las cantidades' })
    await db.from('recetas').update({ fase_revision: 'en_agente' }).eq('id', A)
    respuestas.push(ok())
    assert.equal((await revisarFicha(db, A, { adaptador, env: ENV })).estado, 'revisada'); assert.equal(llamadas, 2)
    console.log('(c) devuelta con nota revisa de nuevo OK')

    // (d) basura o familia inventada: no cambia nada y la ficha sigue con el agente
    const D1 = await nueva('ZZ-PRUEBA-D1 basura'); respuestas.push('no soy json')
    assert.equal((await revisarFicha(db, D1, { adaptador, env: ENV })).estado, 'invalida')
    const d1 = await leer(D1); assert.equal(d1.fase_revision, 'en_agente'); assert.equal(d1.familia, null); assert.ok((await eventos(D1)).some(e => e.tipo === 'error'))
    const antes = llamadas
    const D2 = await nueva('ZZ-PRUEBA-D2 inventada'); respuestas.push(ok({ familia: 'Inventada' }), ok({ familia: 'Inventada' }))
    assert.equal((await revisarFicha(db, D2, { adaptador, env: ENV })).estado, 'invalida'); assert.equal(llamadas - antes, 2) // intento + 1 reintento
    assert.equal((await leer(D2)).fase_revision, 'en_agente')
    console.log('(d) respuestas inválidas no cambian nada OK')

    // (e) tope diario: no llama
    const E = await nueva('ZZ-PRUEBA-E tope'); const antesE = llamadas
    const rE = await revisarPendientes(db, { soloIds: [E], tokensDia: 0, adaptador, env: ENV })
    assert.equal(rE.paradoPorPresupuesto, true); assert.equal(llamadas, antesE); assert.equal((await leer(E)).fase_revision, 'en_agente')
    console.log('(e) tope diario OK')

    // (f) una elaboración usada por otra receta nunca pasa a plato por el agente
    const F = await nueva('ZZ-PRUEBA-F salsa', { tipo_contenido: 'elaboracion', familia: 'Salsas', categoria: 'Elaboración', tipo_receta: 'salsa_base' })
    const R = await nueva('ZZ-PRUEBA-R usa la salsa', { fase_revision: null })
    await db.from('receta_ingredientes').insert({ receta_id: R, elaboracion_id: F, nombre_libre: 'ZZ-PRUEBA-F salsa', cantidad_gramos: 50, orden: 9 })
    respuestas.push(ok({ tipo_contenido: 'plato', familia: 'Carnes', confianza: 0.95, correcciones: [{ campo: 'tipo_contenido', valor: 'plato', segura: true }, { campo: 'familia', valor: 'Carnes', segura: true }] }))
    assert.equal((await revisarFicha(db, F, { adaptador, env: ENV })).estado, 'revisada')
    const ff = await leer(F); assert.equal(ff.tipo_contenido, 'elaboracion'); assert.equal(ff.familia, 'Salsas'); assert.equal(ff.fase_revision, 'segunda')
    console.log('(f) elaboración en uso se mantiene OK')

    // (g) límite por ejecución y orden
    const G = [await nueva('ZZ-PRUEBA-G1'), await nueva('ZZ-PRUEBA-G2'), await nueva('ZZ-PRUEBA-G3')]
    respuestas.push(ok(), ok(), ok())
    const rG = await revisarPendientes(db, { soloIds: G, limite: 2, adaptador, env: ENV })
    assert.equal(rG.revisadas, 2); assert.equal((await Promise.all(G.map(leer))).filter(x => x.fase_revision === 'segunda').length, 2)
    console.log('(g) límite por ejecución OK')

    // (h) acuerdo con Carlos
    const a0 = await acuerdoConCarlos(db)
    await db.from('recetas_revision_eventos').insert({ receta_id: A, tipo: 'aprobada', actor: 'carlos' })
    const a1 = await acuerdoConCarlos(db); assert.equal(a1.total, a0.total + 1); assert.equal(a1.acuerdo, a0.acuerdo + 1)
    await db.from('recetas_revision_eventos').insert({ receta_id: F, tipo: 'descartada', actor: 'carlos' })
    const a2 = await acuerdoConCarlos(db); assert.equal(a2.total, a1.total + 1); assert.equal(a2.acuerdo, a1.acuerdo)
    assert.ok((await tokensGastadosHoy(db)) >= 2400)
    console.log('(h) acuerdo y tokens OK')

    console.log('\nTODO OK')
  } finally {
    for (const id of ids) await db.from('receta_ingredientes').delete().eq('receta_id', id)
    for (const id of ids.slice().reverse()) await db.from('recetas').delete().eq('id', id)
    const { count } = await db.from('recetas').select('id', { count: 'exact', head: true }).like('nombre', 'ZZ-PRUEBA-%')
    console.log('restos ZZ-PRUEBA:', count)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
