// Prueba de humo de la biblioteca de métodos contra la BD real con datos temporales (PRUEBA-metodos-*). No gasta IA.
// Requiere la migración 20261027120000 aplicada. Uso: npx tsx scripts/probar-metodos.ts
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import assert from 'node:assert/strict'
import { cargarMetodo } from '../lib/metodos/db'
import { huellaMetodo } from '../lib/metodos/esquema'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const OTRO_COACH = '00000000-0000-4000-8000-000000000001'

async function main() {
  const { error: sinTabla } = await db.from('metodos').select('id').limit(1)
  if (sinTabla) { console.error('La tabla «metodos» no existe todavía: falta aplicar la migración 20261027120000_biblioteca_metodos.sql'); process.exit(2) }

  const { data: base } = await db.from('recetas').select('coach_id').limit(1).single()
  const coachId = base!.coach_id as string
  const titulo = `PRUEBA-metodos-${Date.now()}`
  const huella = huellaMetodo({ autor: 'Prueba', url_origen: null, titulo })
  try {
    const { data: ficha, error } = await db.from('metodos').insert({ coach_id: coachId, tipo: 'principio', titulo, modalidad: 'fuerza', autor: 'Prueba', huella }).select('*').single()
    assert.ok(!error && ficha, `no se pudo crear la ficha: ${error?.message}`)
    assert.equal(ficha.estado, 'en_revision'); assert.equal(ficha.disponible_ia, false)

    assert.equal(await cargarMetodo(db, ficha.id, OTRO_COACH), null, 'otro coach no debe ver la ficha')
    assert.ok(await cargarMetodo(db, ficha.id, coachId), 'el dueño sí debe verla')
    assert.equal(await cargarMetodo(db, 'no-es-uuid', coachId), null)

    const duplicada = await db.from('metodos').insert({ coach_id: coachId, tipo: 'principio', titulo: `${titulo}-b`, modalidad: 'fuerza', autor: 'Prueba', huella })
    assert.ok(duplicada.error, 'la misma huella debe rechazarse')

    const ia = await db.from('metodos').update({ disponible_ia: true }).eq('id', ficha.id)
    assert.ok(ia.error, 'disponible_ia en una ficha por revisar debe rechazarse')

    assert.ok(!(await db.from('metodos').update({ estado: 'aprobada' }).eq('id', ficha.id)).error)
    assert.ok(!(await db.from('metodos').update({ disponible_ia: true }).eq('id', ficha.id)).error, 'aprobada sí admite la marca de IA')
    const fuera = await db.from('metodos').update({ estado: 'en_revision' }).eq('id', ficha.id)
    assert.ok(fuera.error, 'salir de aprobada con la marca de IA activa debe rechazarse (la ruta la apaga antes)')
    console.log('OK: 7 comprobaciones de la biblioteca de métodos')
  } finally {
    await db.from('metodos').delete().like('titulo', 'PRUEBA-metodos-%')
  }
}
main().catch(e => { console.error(e); process.exit(1) })
