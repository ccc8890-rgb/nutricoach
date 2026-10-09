import assert from 'node:assert/strict'
import { etiquetaTipoSesion } from '../lib/training/session-type-presentation'

assert.equal(etiquetaTipoSesion('carrera'), 'CARRERA')
assert.equal(etiquetaTipoSesion('hibrido'), 'HÍBRIDA')
assert.equal(etiquetaTipoSesion('mixto'), 'MIXTA')

console.log('✓ etiquetas de modalidad de entrenamiento')
