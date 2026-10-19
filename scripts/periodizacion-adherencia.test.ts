import assert from 'node:assert/strict'
import { evaluarCheckin, normalizarAdherenciaPct, type InputCheckin } from '../lib/periodizacion/arbol-decision'

assert.equal(normalizarAdherenciaPct(8), 80)
assert.equal(normalizarAdherenciaPct(10), 100)
assert.equal(normalizarAdherenciaPct(80), 80)
assert.equal(normalizarAdherenciaPct(null), 80)

const base: InputCheckin = { energia: 7, calidad_sueno: 7, adherencia: 8, tls_semanal: 40, semanas_en_deficit: 1, umbral_carga_alta: 80 }
const ev = (p: Partial<InputCheckin>) => evaluarCheckin({ ...base, ...p }).accion

// Todo en rango (escalas 1-10 del formulario): sin acción
assert.equal(ev({}), 'sin_accion')
assert.notEqual(ev({ adherencia: normalizarAdherenciaPct(8) }), 'alerta_coach_solo')

// Fatiga = energía 1-4 de 10 (antes solo 1-2 de 5 → una energía 3/10 pasaba inadvertida)
assert.equal(ev({ energia: 3, calidad_sueno: 3 }), 'higiene_sueno')
assert.equal(ev({ energia: 4, calidad_sueno: 8, tls_semanal: 120 }), 'ajuste_calorico_10pct')
assert.equal(ev({ energia: 3, calidad_sueno: 8, adherencia: 9 }), 'mensaje_apoyo')
assert.equal(ev({ energia: 3, calidad_sueno: 8, adherencia: 9, semanas_en_deficit: 5 }), 'refeed_sugerir')

// Energía media-alta nunca es fatiga, aunque el sueño sea malo
assert.equal(ev({ energia: 6, calidad_sueno: 2 }), 'sin_accion')

console.log('periodizacion-adherencia.test.ts OK')

// El ajuste «de esta semana» se revierte antes del siguiente check-in y no se acumula
import { macrosARestaurar } from '../lib/periodizacion/revertir-ajuste'
import { calcularAjusteCaloricoSemanal } from '../lib/periodizacion/motor-macros'
const base0 = { kcal: 2000, proteinas: 150, carbohidratos: 200, grasas: 70 }
const aj = calcularAjusteCaloricoSemanal(base0)
const rest = macrosARestaurar(aj, { kcal: aj.kcal_ajustado, proteinas: aj.proteinas_ajustadas, carbohidratos: aj.carbohidratos_ajustados, grasas: aj.grasas_ajustadas })
assert.deepEqual(rest, base0)
assert.equal(macrosARestaurar({ ...aj, revertido_at: '2026-10-20' }, { ...base0, kcal: aj.kcal_ajustado }), null) // ya revertido
assert.equal(macrosARestaurar(aj, { ...base0, kcal: 2500 }), null) // el coach lo cambió a mano: no se toca
assert.equal(macrosARestaurar(null, base0), null)
console.log('revertir-ajuste OK')
