// Prueba contra la base de datos real con datos temporales (ZZ-PRUEBA-*), que se borran al terminar. Uso: npx tsx scripts/probar-tecnicas.ts
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import assert from 'node:assert/strict'
import { tecnicaDeFormulario, FORMULARIO_TECNICA_VACIO, validarTecnica } from '../lib/tecnicas'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any

async function main() {
  const { data: base } = await db.from('recetas').select('coach_id').limit(1).single()
  let tecnicaId = '', recetaId = ''
  try {
    const v = tecnicaDeFormulario({ ...FORMULARIO_TECNICA_VACIO, nombre: 'ZZ-PRUEBA-Nixtamalización', familia: 'Maíz y cereales', temperatura_c: '90', tiempo_total_min: '720', nivel: 'Medio', tags: 'maíz, cal', pasos: '1. Lava' })
    assert.ok(v.ok); if (!v.ok) return
    const { data: t, error } = await db.from('tecnicas').insert({ ...v.tecnica, coach_id: base.coach_id }).select('*').single()
    assert.ok(!error, error?.message); tecnicaId = t.id
    const releida = validarTecnica(t); assert.ok(releida.ok && releida.tecnica.nombre === 'ZZ-PRUEBA-Nixtamalización' && releida.tecnica.parametros.temperatura_c === 90)   // lo guardado vuelve a validar
    const { data: r } = await db.from('recetas').insert({ nombre: 'ZZ-PRUEBA-REC-TEC', coach_id: base.coach_id, estado: 'descartada', porciones: 1 }).select('id').single(); recetaId = r.id
    const { error: e2 } = await db.from('receta_tecnicas').insert({ receta_id: recetaId, tecnica_id: tecnicaId, orden: 0 }); assert.ok(!e2, e2?.message)
    const { data: usos } = await db.from('receta_tecnicas').select('receta_id').eq('tecnica_id', tecnicaId); assert.equal(usos.length, 1)
    await db.from('tecnicas').delete().eq('id', tecnicaId); tecnicaId = ''
    const { data: huerfanos } = await db.from('receta_tecnicas').select('receta_id').eq('receta_id', recetaId); assert.equal(huerfanos.length, 0)   // borrar la técnica borra sus enlaces
    console.log('alta, lectura, enlace y borrado en cascada OK')
  } finally {
    if (tecnicaId) await db.from('tecnicas').delete().eq('id', tecnicaId)
    if (recetaId) await db.from('recetas').delete().eq('id', recetaId)
    const { count } = await db.from('tecnicas').select('id', { count: 'exact', head: true }).like('nombre', 'ZZ-PRUEBA-%'); console.log('restos ZZ-PRUEBA:', count)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
