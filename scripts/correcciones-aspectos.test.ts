import assert from 'node:assert/strict'
import { ASPECTOS_CORRECCION, ASPECTOS_IDS, GRUPOS_CORRECCION } from '../lib/recetas/correcciones'
import { validarReporte } from '../lib/recetas/reportes'

// Cada aspecto pertenece a un grupo conocido y los ids no se repiten
for (const a of ASPECTOS_CORRECCION) assert.ok((GRUPOS_CORRECCION as readonly string[]).includes(a.grupo), `grupo desconocido: ${a.id}`)
assert.equal(new Set(ASPECTOS_CORRECCION.map(a => a.id)).size, ASPECTOS_CORRECCION.length)
// Los aspectos nuevos existen y las notas antiguas («ingredientes») siguen siendo válidas
for (const id of ['enlaces', 'alimento_falta', 'gramos', 'alergenos', 'etiquetas', 'foto']) assert.ok(ASPECTOS_IDS.includes(id), id)
assert.ok(ASPECTOS_IDS.includes('ingredientes'))
const r = validarReporte({ aspectos: ['alergenos', 'enlaces', 'inventado'], nota: '', origen: 'propio' })
assert.ok(r.ok && r.reporte.aspectos.join() === 'alergenos,enlaces')
console.log('correcciones-aspectos OK')
