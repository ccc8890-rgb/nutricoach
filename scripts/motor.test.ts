import assert from 'node:assert/strict'
import { componerDecisiones, resumenDelMotor, textoEvidencia } from '../lib/rendimiento/motor'
import type { PropuestaRegla } from '../lib/rendimiento/reglas'
import type { EstudioRef } from '../lib/rendimiento/evidencia'
import type { EstadoAtleta } from '../lib/rendimiento/estado'

const estado = { carreras6sem: 12, carga: { ctl: 16, atl: 17, tsb: -1.3, textoEstado: 'Equilibrado' }, intensidad: { valoracion: 'zona_gris', minutos: 339, pctSuave: 36, pctMedia: 52, pctDura: 12 } } as unknown as EstadoAtleta
const seiler: EstudioRef = { titulo: 'What is best practice for training intensity and duration distribution in endurance athletes?', anio: '2010', doi: '10.1123/ijspp.5.3.276', nivel: 'revision_sistematica' }
const regla = (o: Partial<PropuestaRegla> = {}): PropuestaRegla => ({ regla: 'reparto_suave', sesion: 'general', cambio: 'Rodajes con el pulso por debajo de 159 ppm.', razon: 'El 36 % del tiempo fue suave.', riesgo: 'bajo', metrica_objetivo: 'pct_suave', dois: [seiler.doi!], datos: 1, persistencia: 1, prioridad: 3, ...o })

const d = componerDecisiones({
  reglas: [regla(), regla({ regla: 'fuerza', riesgo: 'medio', dois: ['10.0/no-existe'] })],
  estudiosPorDoi: new Map([[seiler.doi!, seiler]]),
  ia: [{ sesion: 'Tempo', cambio: 'Mantener 20 min en 4:55-5:05/km', razon: 'Evitar pasarse', evidencia: 'x', confianza: 0.95, riesgo: 'bajo', avisos: ['aviso'], estudios: [] }],
  estado,
})
assert.equal(d.length, 3)
// Regla con estudio: origen, evidencia legible y segura.
assert.equal(d[0].origen, 'regla')
assert.ok(d[0].evidencia.includes('(2010)') && d[0].evidencia.startsWith('«What is best practice'))
assert.equal(d[0].segura, true)
assert.equal(d[0].fiabilidad.nivel, 'alta')
assert.equal(d[0].confianza, d[0].fiabilidad.valor)
// DOI que no está en la base: se ignora y la propuesta queda «sin cita», nunca «segura» por ser de riesgo medio.
assert.deepEqual(d[1].estudios, [])
assert.equal(d[1].evidencia, 'criterio de entrenador (sin cita)')
assert.equal(d[1].segura, false)
// La IA: nunca segura, su confianza declarada (0,95) se ignora y su fiabilidad es menor.
assert.equal(d[2].origen, 'ia')
assert.equal(d[2].segura, false)
assert.ok(d[2].confianza <= 0.8 && d[2].confianza !== 0.95)
assert.deepEqual(d[2].avisos, ['aviso'])

assert.equal(textoEvidencia([]), 'criterio de entrenador (sin cita)')
assert.equal(textoEvidencia([seiler, { ...seiler, anio: null, titulo: 'Otro' }]), `«${seiler.titulo.slice(0, 89)}…» (2010); «Otro»`)

const res = resumenDelMotor(estado, [regla()])
assert.ok(res.includes('Forma 16') && res.includes('36 % suave') && res.includes('propone 1 cambio'))
assert.ok(resumenDelMotor(estado, []).includes('no encuentra motivos'))
console.log('motor.test OK')
