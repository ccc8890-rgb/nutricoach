import assert from 'node:assert/strict'
import { validarRevision, correccionesAplicables, hashFicha, transicionPermitida, type FichaParaRevisar, type RevisionAgente } from '../lib/recetas/revisor/esquema'
import { construirPrompt } from '../lib/recetas/revisor/prompt'
import { FAMILIAS_PLATO, FAMILIAS_ELABORACION } from '../lib/recetas-constants'

const ficha = (extra: Partial<FichaParaRevisar> = {}): FichaParaRevisar => ({
  id: 'f1', nombre: 'Pollo al curry con arroz', estado: 'en_revision', tipo_contenido: 'plato', familia: null, categoria: 'Comida', tipo_plato: 'Comida', tipo_receta: 'completa',
  descripcion: 'Un guiso sencillo', instrucciones: '1. Sofríe. 2. Añade el curry.', consejos: null, porciones: 2, kcal: 520, proteinas: 38, carbohidratos: 55, grasas: 14,
  tags: ['Pollo', 'Arroz'], url_origen: 'https://example.com/r', hallazgos_deterministas: [], usada_en_recetas: 0,
  ingredientes: [{ nombre: 'Pollo', alimento: 'Pechuga de pollo', gramos: 300, kcal100: 110 }, { nombre: 'Arroz', alimento: 'Arroz basmati', gramos: 150, kcal100: 350 }],
  ...extra,
})
const valida = (extra: Record<string, unknown> = {}) => ({
  tipo_contenido: 'plato', familia: 'Carnes', confianza: 0.9, veredicto: 'lista', resumen: 'Todo coherente',
  hallazgos: [{ campo: 'ingredientes', gravedad: 'baja', descripcion: 'Falta sal', sugerencia: 'Añadir sal' }], correcciones: [], ...extra,
})

// ── validarRevision ──
{
  const r = validarRevision(valida())
  assert.equal(r.ok, true)
  assert.equal(validarRevision(valida({ familia: 'Inventada' })).ok, false)
  assert.equal(validarRevision(valida({ tipo_contenido: 'elaboracion', familia: 'Carnes' })).ok, false)   // familia de plato en una elaboración
  assert.equal(validarRevision(valida({ tipo_contenido: 'elaboracion', familia: null })).ok, false)       // una elaboración exige familia
  assert.equal(validarRevision(valida({ familia: null })).ok, true)                                         // un plato puede quedar sin familia
  assert.equal(validarRevision(valida({ confianza: 1.5 })).ok, false)
  assert.equal(validarRevision(valida({ veredicto: 'ok' })).ok, false)
  assert.equal(validarRevision({ ...valida(), hallazgos: undefined }).ok, false)
  assert.equal(validarRevision('no soy json').ok, false)
  assert.equal(validarRevision(null).ok, false)
  const muchos = validarRevision(valida({ hallazgos: Array.from({ length: 25 }, (_, i) => ({ campo: 'x', gravedad: 'baja', descripcion: `h${i}`, sugerencia: '' })) }))
  assert.ok(muchos.ok && muchos.revision.hallazgos.length === 20)
  const extra = validarRevision(valida({ estado: 'aprobada', otro: 1 }))
  assert.ok(extra.ok && !('estado' in extra.revision))
  assert.equal(validarRevision(valida({ correcciones: [{ campo: 'estado', valor: 'aprobada', segura: true }] })).ok, false)
}

// ── correccionesAplicables ──
const rev = (extra: Partial<RevisionAgente> = {}): RevisionAgente => ({ tipo_contenido: 'plato', familia: 'Pastas', confianza: 0.9, veredicto: 'lista', resumen: '', hallazgos: [], correcciones: [{ campo: 'familia', valor: 'Pastas', segura: true }], ...extra })
{
  assert.deepEqual(correccionesAplicables(rev(), ficha()), { familia: 'Pastas' })
  assert.deepEqual(correccionesAplicables(rev({ confianza: 0.8 }), ficha()), {})
  assert.deepEqual(correccionesAplicables(rev({ correcciones: [{ campo: 'familia', valor: 'Pastas', segura: false }] }), ficha()), {})
  assert.deepEqual(correccionesAplicables(rev(), ficha({ estado: 'aprobada' })), {})
  assert.deepEqual(correccionesAplicables(rev({ familia: 'Carnes' }), ficha({ familia: 'Carnes' })), {})                          // ya la tiene
  // plato → elaboración
  const aElab = rev({ tipo_contenido: 'elaboracion', familia: 'Salsas', correcciones: [{ campo: 'tipo_contenido', valor: 'elaboracion', segura: true }, { campo: 'familia', valor: 'Salsas', segura: true }] })
  assert.deepEqual(correccionesAplicables(aElab, ficha({ nombre: 'Salsa de yogur' })), { tipo_contenido: 'elaboracion', familia: 'Salsas', categoria: 'Elaboración', tipo_receta: 'salsa_base' })
  // elaboración → plato: nunca automático, aunque no se use
  const aPlato = rev({ tipo_contenido: 'plato', familia: 'Carnes', correcciones: [{ campo: 'tipo_contenido', valor: 'plato', segura: true }, { campo: 'familia', valor: 'Carnes', segura: true }] })
  assert.deepEqual(correccionesAplicables(aPlato, ficha({ tipo_contenido: 'elaboracion', familia: 'Salsas', usada_en_recetas: 0 })), {})
  assert.deepEqual(correccionesAplicables(aPlato, ficha({ tipo_contenido: 'elaboracion', familia: 'Salsas', usada_en_recetas: 3 })), {})
}

// ── hashFicha ──
{
  const a = ficha()
  const invertida = ficha({ ingredientes: [...a.ingredientes].reverse() })
  assert.equal(hashFicha(a), hashFicha(invertida))
  assert.notEqual(hashFicha(a), hashFicha(ficha({ ingredientes: [{ ...a.ingredientes[0], gramos: 301 }, a.ingredientes[1]] })))
  assert.notEqual(hashFicha(a, null), hashFicha(a, 'Revisa las cantidades'))
  assert.match(hashFicha(a), /^[0-9a-f]{64}$/)
}

// ── construirPrompt ──
{
  const p = construirPrompt(ficha(), 'Mira el curry: parece mucho')
  for (const f of [...FAMILIAS_PLATO, ...FAMILIAS_ELABORACION]) assert.ok(p.sistema.includes(f), f)
  assert.ok(p.sistema.includes('JSON'))
  assert.ok(p.usuario.includes('Pollo al curry con arroz') && p.usuario.includes('Mira el curry: parece mucho'))
  assert.ok(!p.usuario.includes('notas_coach'))
}

// ── transiciones de fase (las que Carlos puede hacer desde la API) ──
assert.deepEqual(transicionPermitida('nueva', 'en_agente'), { ok: true, evento: 'al_agente' })
assert.deepEqual(transicionPermitida('segunda', 'en_agente'), { ok: true, evento: 'devuelta' })
assert.deepEqual(transicionPermitida('en_agente', 'nueva'), { ok: true, evento: 'volver_a_nueva' })
assert.deepEqual(transicionPermitida('segunda', 'nueva'), { ok: true, evento: 'volver_a_nueva' })
assert.equal(transicionPermitida('nueva', 'segunda').ok, false)       // solo el agente pasa a 2ª revisión
assert.equal(transicionPermitida('en_agente', 'segunda').ok, false)
assert.equal(transicionPermitida('en_agente', 'en_agente').ok, false)
assert.equal(transicionPermitida('nueva', 'nueva').ok, false)

console.log('revisor-recetario.test OK')
