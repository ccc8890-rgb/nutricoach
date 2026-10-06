import assert from 'node:assert/strict'
import { limpiarCambios } from '../lib/contenido/validacion'

const ok = (b: unknown) => { const r = limpiarCambios(b); assert.equal(r.ok, true, JSON.stringify(r)); return (r as { ok: true; cambios: Record<string, unknown> }).cambios }
const mal = (b: unknown) => assert.equal(limpiarCambios(b).ok, false, JSON.stringify(b))

assert.deepEqual(ok({}), {})
assert.deepEqual(ok({ titulo: '  Bowl  ', estado: 'para_grabar' }), { titulo: 'Bowl', estado: 'para_grabar' })
assert.deepEqual(ok({ notas: '', enlace_referencia: null }), { notas: null, enlace_referencia: null })
assert.deepEqual(ok({ fecha_grabacion: '2026-10-17', fecha_publicacion: null }), { fecha_grabacion: '2026-10-17', fecha_publicacion: null })
assert.deepEqual(ok({ planos_hechos: ['plato', 'plato', 'macros'] }), { planos_hechos: ['plato', 'macros'] })
assert.deepEqual(ok({ receta_id: '123e4567-e89b-12d3-a456-426614174000' }), { receta_id: '123e4567-e89b-12d3-a456-426614174000' })

// Entradas inválidas: nunca se guardan
mal(null)
mal('texto')
mal({ estado: 'inventado' })
mal({ titulo: '' })
mal({ titulo: 'x'.repeat(201) })
mal({ fecha_grabacion: '17-10-2026' })
mal({ fecha_grabacion: '2026-13-45' })
mal({ planos_hechos: ['plato', 'desconocido'] })
mal({ planos_hechos: 'plato' })
mal({ receta_id: 'no-uuid' })
mal({ notas: 5 })

// El enlace se pinta como <a href>: solo http(s), nunca javascript: ni texto suelto
assert.deepEqual(ok({ enlace_referencia: 'https://www.instagram.com/reel/ABC/' }), { enlace_referencia: 'https://www.instagram.com/reel/ABC/' })
mal({ enlace_referencia: 'javascript:alert(1)' })
mal({ enlace_referencia: 'data:text/html,<script>alert(1)</script>' })
mal({ enlace_referencia: 'una nota cualquiera' })

// Campos no permitidos se ignoran
assert.deepEqual(ok({ titulo: 'A', coach_id: 'otro', id: 'x' }), { titulo: 'A' })

console.log('contenido-validacion: OK')
