import assert from 'node:assert/strict'
import { validarHito } from '../lib/rendimiento/intervenciones'

const hoy = '2026-10-10'
const ok = validarHito({ fecha: '2026-09-20', titulo: '  Rodajes en zona 2  ', descripcion: 'Bajo el ritmo de los rodajes', metrica_objetivo: 'pct_suave' }, hoy)
assert.ok(ok.ok)
if (ok.ok) {
  assert.equal(ok.hito.titulo, 'Rodajes en zona 2')
  assert.equal(ok.hito.metrica_objetivo, 'pct_suave')
  assert.equal(ok.hito.direccion, undefined)
}
// Carga y km exigen dirección; el resto la ignora.
assert.equal(validarHito({ fecha: hoy, titulo: 'x', metrica_objetivo: 'km_semana' }, hoy).ok, false)
const km = validarHito({ fecha: hoy, titulo: 'Subo volumen', metrica_objetivo: 'km_semana', direccion: 'sube' }, hoy)
assert.ok(km.ok && km.hito.direccion === 'sube')
const suave = validarHito({ fecha: hoy, titulo: 'x', metrica_objetivo: 'deriva', direccion: 'baja' }, hoy)
assert.ok(suave.ok && suave.hito.direccion === undefined)
// Métrica inventada se descarta; fecha futura, mala o sin título se rechazan.
const inv = validarHito({ fecha: hoy, titulo: 'x', metrica_objetivo: 'inventada' }, hoy)
assert.ok(inv.ok && inv.hito.metrica_objetivo === undefined)
assert.equal(validarHito({ fecha: '2026-10-11', titulo: 'x' }, hoy).ok, false)
assert.equal(validarHito({ fecha: '10/10/2026', titulo: 'x' }, hoy).ok, false)
assert.equal(validarHito({ fecha: '2026-13-45', titulo: 'x' }, hoy).ok, false)
assert.equal(validarHito({ fecha: '2019-01-01', titulo: 'x' }, hoy).ok, false)
assert.equal(validarHito({ fecha: hoy, titulo: '   ' }, hoy).ok, false)
assert.equal(validarHito(null, hoy).ok, false)
// Longitudes acotadas.
const largo = validarHito({ fecha: hoy, titulo: 'a'.repeat(300), descripcion: 'b'.repeat(900) }, hoy)
assert.ok(largo.ok && largo.hito.titulo.length === 100 && largo.hito.descripcion.length === 400)
console.log('hitos.test OK')
