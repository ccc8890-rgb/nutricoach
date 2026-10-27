import assert from 'node:assert/strict'
import { validarEstudio, estudioVacio, rendimientoEscalado, resumenConservacion, estudioDeFormulario, formularioDeEstudio, type Estudio } from '../lib/recetas/estudio'

// ── validarEstudio: se queda con lo válido y descarta el resto ──
{
  const e = validarEstudio({
    rendimiento: { cantidad: 900, unidad: 'g' }, tiempo_activo_min: 40, tiempo_total_min: 840, mise_en_place: '  Mantequilla a 16 °C  ',
    porcionado: '12 piezas de 75 g', conservacion: { ambiente_h: 24, nevera_dias: 2, congelador_meses: 3, notas: 'En bolsa' },
    equipo: 'Amasadora', variantes: 'Sin lactosa', origen: 'Francia', otra_cosa: 'x',
  })
  assert.deepEqual(e, {
    rendimiento: { cantidad: 900, unidad: 'g' }, tiempo_activo_min: 40, tiempo_total_min: 840, mise_en_place: 'Mantequilla a 16 °C',
    porcionado: '12 piezas de 75 g', conservacion: { ambiente_h: 24, nevera_dias: 2, congelador_meses: 3, notas: 'En bolsa' },
    equipo: 'Amasadora', variantes: 'Sin lactosa', origen: 'Francia',
  })
  assert.deepEqual(validarEstudio({ rendimiento: { cantidad: -5, unidad: 'g' }, tiempo_activo_min: -1, tiempo_total_min: 'x', conservacion: { nevera_dias: NaN } }), {})
  assert.deepEqual(validarEstudio({ rendimiento: { cantidad: 100, unidad: 'toneladas' } }), {})        // unidad no válida
  assert.deepEqual(validarEstudio(null), {}); assert.deepEqual(validarEstudio('x'), {}); assert.deepEqual(validarEstudio([1]), {})
  assert.equal(validarEstudio({ mise_en_place: 'x'.repeat(5000) }).mise_en_place?.length, 1000)       // tope de longitud
  assert.deepEqual(validarEstudio({ mise_en_place: '   ' }), {})                                       // texto vacío no cuenta
}

// ── estudioVacio ──
assert.equal(estudioVacio(null), true); assert.equal(estudioVacio({}), true); assert.equal(estudioVacio(undefined), true)
assert.equal(estudioVacio({ equipo: 'Horno' }), false)

// ── rendimiento escalado por el selector de raciones ──
assert.equal(rendimientoEscalado({ rendimiento: { cantidad: 900, unidad: 'g' } }, 2), '1800 g')
assert.equal(rendimientoEscalado({ rendimiento: { cantidad: 900, unidad: 'g' } }, 0.5), '450 g')
assert.equal(rendimientoEscalado({ rendimiento: { cantidad: 12, unidad: 'unidades' } }, 0.5), '6 unidades')
assert.equal(rendimientoEscalado({ rendimiento: { cantidad: 3, unidad: 'ml' } }, 0.5), '1,5 ml')
assert.equal(rendimientoEscalado({}, 2), null)

// ── conservación ──
assert.equal(resumenConservacion({ ambiente_h: 24, nevera_dias: 2, congelador_meses: 3 }), 'Ambiente 24 h · nevera 2 días · congelador 3 meses')
assert.equal(resumenConservacion({ nevera_dias: 1 }), 'Nevera 1 día')
assert.equal(resumenConservacion({ congelador_meses: 1, notas: 'Sin descongelar' }), 'Congelador 1 mes · Sin descongelar')
assert.equal(resumenConservacion(undefined), null)

// ── formulario (todo texto) ↔ estudio ──
{
  const e: Estudio = { rendimiento: { cantidad: 900, unidad: 'g' }, tiempo_activo_min: 40, conservacion: { nevera_dias: 2 }, equipo: 'Amasadora' }
  const f = formularioDeEstudio(e)
  assert.equal(f.rendimiento_cantidad, '900'); assert.equal(f.rendimiento_unidad, 'g'); assert.equal(f.nevera_dias, '2'); assert.equal(f.mise_en_place, '')
  assert.deepEqual(estudioDeFormulario(f), e)
  assert.deepEqual(estudioDeFormulario(formularioDeEstudio(null)), {})
  assert.deepEqual(estudioDeFormulario({ ...formularioDeEstudio(null), rendimiento_cantidad: '1,5', rendimiento_unidad: 'ml' }), { rendimiento: { cantidad: 1.5, unidad: 'ml' } })  // coma decimal española
  assert.deepEqual(estudioDeFormulario({ ...formularioDeEstudio(null), rendimiento_cantidad: '900', rendimiento_unidad: '' }), {})                                                      // sin unidad no hay rendimiento
}

console.log('estudio.test OK')
