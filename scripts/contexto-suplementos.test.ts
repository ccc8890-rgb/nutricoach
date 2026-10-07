import assert from 'node:assert/strict'
import { analiticaDe, condicionesDe, intensidadDeSesion } from '../lib/nutricion/contexto-suplementos'

// Condiciones: el texto libre «Ninguna» y similares no son condiciones
for (const t of ['Ninguna', 'ninguno', 'No', 'n/a', '-', ' Ninguna. ', '']) assert.equal(condicionesDe(t), undefined, t)
assert.deepEqual(condicionesDe('Hipotiroidismo'), ['Hipotiroidismo'])
assert.equal(condicionesDe(null), undefined)

// Intensidad de la sesión de hoy
assert.equal(intensidadDeSesion('Híbrida A: SkiErg + Fuerza de Espalda', 'entreno_hibrido'), 'alta')
assert.equal(intensidadDeSesion('Carrera: Series Cortas en Descarga', 'entreno_cardio'), 'alta')
assert.equal(intensidadDeSesion('Carrera: Tirada Larga Aeróbica Z2', 'entreno_cardio'), 'baja')
assert.equal(intensidadDeSesion('Carrera: Tempo Run en Descarga', 'entreno_cardio'), 'media')
assert.equal(intensidadDeSesion('Fuerza pierna', 'entreno_fuerza'), 'media')
assert.equal(intensidadDeSesion(undefined, null), undefined)

// Analítica del onboarding
assert.deepEqual(analiticaDe({ vitamina_d: 22, ferritina: '25,5' }), { vitamina_d_ngml: 22, ferritina_ngml: 25.5 })
assert.equal(analiticaDe({}), undefined)
assert.equal(analiticaDe({ vitamina_d: -3, ferritina: 'abc' }), undefined)
assert.equal(analiticaDe(null), undefined)
console.log('contexto-suplementos: OK')
