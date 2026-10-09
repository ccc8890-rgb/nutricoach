import assert from 'node:assert/strict'
import { etiquetaTipoSesion, tituloSesionSinModalidad } from '../lib/training/session-type-presentation'

assert.equal(etiquetaTipoSesion('carrera'), 'CARRERA')
assert.equal(etiquetaTipoSesion('hibrido'), 'HÍBRIDA')
assert.equal(etiquetaTipoSesion('mixto'), 'MIXTA')

assert.equal(tituloSesionSinModalidad('Híbrida: SkiErg + fuerza', 'hibrido'), 'SkiErg + fuerza')
assert.equal(tituloSesionSinModalidad('Carrera — Series cortas', 'carrera'), 'Series cortas')
assert.equal(tituloSesionSinModalidad('Mixta: Fuerza + carrera', 'mixto'), 'Fuerza + carrera')
assert.equal(tituloSesionSinModalidad('Carrera + SkiErg combinado', 'hibrido'), 'Carrera + SkiErg combinado')

console.log('✓ etiquetas de modalidad de entrenamiento')
