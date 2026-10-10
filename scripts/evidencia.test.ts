import assert from 'node:assert/strict'
import { elegirEstudios, resolverCitas, textoEstudios, type FilaEstudio } from '../lib/rendimiento/evidencia'

let n = 0
const f = (titulo: string, extra: Partial<FilaEstudio> = {}): FilaEstudio => ({ titulo, fuente: 'Autor. Revista. 2020', doi: `10.0/${++n}`, nivel_evidencia: 'rct', puntos_clave: [], resumen: 'Resumen del estudio.', tags: [], verificado: true, ...extra })

const filas = [
  f('Estudio observacional antiguo', { nivel_evidencia: 'estudio_observacional', fuente: 'A. Rev. 2006' }),
  f('Metaanálisis reciente', { nivel_evidencia: 'meta_analisis', fuente: 'B. Rev. 2024', puntos_clave: ['Uso en NutriCoach: sirve para X.'] }),
  f('Metaanálisis reciente', { nivel_evidencia: 'meta_analisis' }), // duplicado por título
  f('Otro con DOI', { doi: '10.1/ABC' }),
  f('Mismo DOI distinto título', { doi: '10.1/abc' }), // duplicado por DOI (sin distinguir mayúsculas)
  f('Revisión sin verificar', { nivel_evidencia: 'revision_sistematica', verificado: false }),
]
// Sin DOI no se puede citar (entradas antiguas sin verificar).
assert.equal(elegirEstudios([f('Sin doi', { doi: null })], 5).length, 0)
const e = elegirEstudios(filas, 10)
assert.equal(e.length, 4)
assert.equal(e[0].titulo, 'Metaanálisis reciente') // curado y mayor nivel de evidencia
assert.equal(e[0].clave, 'K1')
assert.equal(e[0].anio, '2024')
assert.equal(e[0].aporta, 'sirve para X.')
assert.equal(e[e.length - 1].titulo, 'Revisión sin verificar') // los no verificados al final
// Los no curados no muestran «aporta» (afirmación manual sin verificar).
assert.equal(e.find(x => x.titulo === 'Otro con DOI')!.aporta, '')
// Un curado de menor nivel va antes que un no curado de mayor nivel.
const mezcla = elegirEstudios([f('No curado meta', { nivel_evidencia: 'meta_analisis' }), f('Curado observacional', { nivel_evidencia: 'estudio_observacional', puntos_clave: ['Uso en NutriCoach: algo.'] })], 5)
assert.equal(mezcla[0].titulo, 'Curado observacional')
assert.equal(elegirEstudios(filas, 2).length, 2)

const txt = textoEstudios(e)
assert.ok(txt.startsWith('ESTUDIOS DISPONIBLES'))
assert.ok(txt.includes('[K1] Metaanálisis reciente (2024) · metaanálisis'))
assert.equal(textoEstudios([]), '')

// Las claves se sustituyen por el título; las inexistentes se eliminan.
assert.equal(resolverCitas('Seiler [K1] y [K9] sobre reparto', e), 'Seiler «Metaanálisis reciente» (2024) y sobre reparto')
assert.equal(resolverCitas('K2', e).startsWith('«'), true)
assert.equal(resolverCitas('Banister (1975), sin cita', e), 'Banister (1975), sin cita')
assert.equal(resolverCitas('Ver [K77].', e), 'Ver.')
// Una «K» dentro de otra palabra no es una cita.
assert.equal(resolverCitas('KB de datos y 5K', e), 'KB de datos y 5K')
console.log('evidencia.test OK')
