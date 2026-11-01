import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { validarEntradaDieta, validarRevision } from '../lib/platos/dieta'

// Entrada de «Añadir a la dieta»
assert.equal(validarEntradaDieta({}).ok, false)
assert.equal(validarEntradaDieta({ dia: 'funday', franja: 'Comida', raciones: 1 }).ok, false)
assert.equal(validarEntradaDieta({ dia: 'Lunes', franja: 'Brunch', raciones: 1 }).ok, false)
assert.equal(validarEntradaDieta({ dia: 'Lunes', franja: 'Comida', raciones: 0 }).ok, false)
assert.equal(validarEntradaDieta({ dia: 'Lunes', franja: 'Comida', raciones: 50 }).ok, false)
assert.ok(validarEntradaDieta({ dia: 'Lunes', franja: 'Comida', raciones: 1.5 }).ok)

// Revisión: devolver exige nota
assert.equal(validarRevision({ accion: 'devolver' }).ok, false)
assert.equal(validarRevision({ accion: 'devolver', nota: '   ' }).ok, false)
assert.equal(validarRevision({ accion: 'borrar' }).ok, false)
assert.ok(validarRevision({ accion: 'devolver', nota: 'Pon menos aceite' }).ok)
assert.ok(validarRevision({ accion: 'aprobar' }).ok)

// Reglas que se garantizan en el código (Review Focus 2 y 6)
for (const f of ['app/api/platos/route.ts', 'app/api/platos/[id]/route.ts', 'app/api/platos/[id]/revisar/route.ts', 'app/api/platos/[id]/dieta/route.ts', 'lib/platos/anadir-a-dieta.ts', 'lib/platos/autorizar-coach.ts']) assert.ok(existsSync(f), `falta ${f}`)
const revisar = readFileSync('app/api/platos/[id]/revisar/route.ts', 'utf8')
assert.ok(/puedeAprobar\(/.test(revisar), 'aprobar debe pasar por puedeAprobar')
assert.ok(/aprobado_snapshot/.test(revisar), 'aprobar guarda el snapshot')
const dieta = readFileSync('lib/platos/anadir-a-dieta.ts', 'utf8')
assert.ok(/estado\s*!==\s*'aprobado'/.test(dieta), 'solo se añade a la dieta un plato aprobado')
assert.ok(dieta.indexOf("estado !== 'aprobado'") < dieta.indexOf("from('comidas')"), 'la comprobación de estado va antes de tocar comidas')
const auth = readFileSync('lib/platos/autorizar-coach.ts', 'utf8')
assert.ok(/borrador/.test(auth), 'el coach no ve borradores')
console.log('platos-coach OK')
