import assert from 'node:assert/strict'
import { resolverActualizacionBloque } from '../lib/training/session-block-update'

assert.deepEqual(resolverActualizacionBloque({ solicitado: 'movilidad', coachId: 'a', propietarioId: 'a' }), {
  ok: true,
  bloque: 'movilidad',
})
assert.deepEqual(resolverActualizacionBloque({ solicitado: 'otro', coachId: 'a', propietarioId: 'a' }), {
  ok: false,
  status: 400,
  error: 'Bloque no válido',
})
assert.deepEqual(resolverActualizacionBloque({ solicitado: 'principal', coachId: 'a', propietarioId: 'b' }), {
  ok: false,
  status: 403,
  error: 'Sin acceso',
})

console.log('✓ autorización de bloques de sesión')
