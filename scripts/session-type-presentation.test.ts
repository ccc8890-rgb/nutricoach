import assert from 'node:assert/strict'
import { etiquetaTipoSesion, limpiarPrefijoModalidad, tituloSesionSinModalidad } from '../lib/training/session-type-presentation'

assert.equal(etiquetaTipoSesion('carrera'), 'CARRERA')
assert.equal(etiquetaTipoSesion('hibrido'), 'HÍBRIDA')
assert.equal(etiquetaTipoSesion('mixto'), 'MIXTA')

assert.equal(tituloSesionSinModalidad('Híbrida: SkiErg + fuerza', 'hibrido'), 'SkiErg + fuerza')
assert.equal(tituloSesionSinModalidad('Carrera — Series cortas', 'carrera'), 'Series cortas')
assert.equal(tituloSesionSinModalidad('Mixta: Fuerza + carrera', 'mixto'), 'Fuerza + carrera')
assert.equal(tituloSesionSinModalidad('Híbrida C: Wall balls + remo', 'hibrido'), 'Wall balls + remo')
assert.equal(tituloSesionSinModalidad('Hibrida B - Sled push', 'hibrido'), 'Sled push')
assert.equal(tituloSesionSinModalidad('Carrera + SkiErg combinado', 'hibrido'), 'Carrera + SkiErg combinado')
assert.equal(limpiarPrefijoModalidad('Híbrida C: Wall balls'), 'Wall balls')
assert.equal(limpiarPrefijoModalidad('Carrera — Tempo'), 'Tempo')
assert.equal(limpiarPrefijoModalidad('Fuerza'), 'Fuerza')

console.log('✓ etiquetas de modalidad de entrenamiento')
