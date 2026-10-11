// scripts/enrutador-ia.test.ts
import assert from 'node:assert/strict'
import { llamarIA, rutasDe, RUTAS_POR_DEFECTO, ErrorIA, type Adaptador } from '../lib/ia/enrutador'

const todas = { ANTHROPIC_API_KEY: 'x', OPENAI_API_KEY: 'x', DEEPSEEK_API_KEY: 'x' }
const ok = (texto: string): ReturnType<Adaptador> => Promise.resolve({ texto, uso: { entrada: 10, salida: 20 } })
const llamadas: string[] = []
const adaptadorCon = (resp: Record<string, string | Error>): Adaptador => async (ruta) => {
  llamadas.push(ruta.proveedor)
  const r = resp[ruta.proveedor]
  if (r instanceof Error) throw r
  return ok(r ?? '{}')
}

;(async () => {
  // Rutas por defecto y sobrescritura por entorno
  assert.equal(RUTAS_POR_DEFECTO.plan_entreno[0].modelo, 'claude-opus-5-5')
  assert.equal(RUTAS_POR_DEFECTO.auditoria[0].proveedor, 'openai') // audita otra familia que la que genera
  assert.deepEqual(rutasDe('plan_entreno', { IA_RUTA_PLAN_ENTRENO: 'openai:gpt-x, deepseek:deepseek-chat' }).map(r => r.modelo), ['gpt-x', 'deepseek-chat'])
  assert.equal(rutasDe('plan_entreno', { IA_RUTA_PLAN_ENTRENO: 'invalido' })[0].modelo, 'claude-opus-5-5') // valor roto → por defecto

  // El primero que responde gana y no se llama a los demás
  llamadas.length = 0
  let r = await llamarIA('plan_entreno', { sistema: 's', usuario: 'u', json: true }, { adaptador: adaptadorCon({ anthropic: '{"a":1}' }), env: todas })
  assert.equal(r.proveedor, 'anthropic')
  assert.deepEqual(llamadas, ['anthropic'])

  // Sin clave de Anthropic se salta sin llamar y se usa el siguiente
  llamadas.length = 0
  r = await llamarIA('plan_entreno', { sistema: 's', usuario: 'u', json: true }, { adaptador: adaptadorCon({ openai: '{"a":2}' }), env: { OPENAI_API_KEY: 'x', DEEPSEEK_API_KEY: 'x' } })
  assert.equal(r.proveedor, 'openai')
  assert.deepEqual(llamadas, ['openai'])
  assert.equal(r.intentos[0].error, 'sin clave')

  // Error del primero → respaldo; JSON inválido del segundo → tercero
  llamadas.length = 0
  r = await llamarIA('plan_entreno', { sistema: 's', usuario: 'u', json: true }, { adaptador: adaptadorCon({ anthropic: new Error('500'), openai: 'esto no es json', deepseek: '{"ok":true}' }), env: todas })
  assert.equal(r.proveedor, 'deepseek')
  assert.deepEqual(llamadas, ['anthropic', 'openai', 'deepseek'])
  assert.equal(r.intentos[1].error, 'JSON inválido')

  // Sin exigir JSON, cualquier texto vale
  r = await llamarIA('texto_barato', { sistema: 's', usuario: 'u' }, { adaptador: adaptadorCon({ deepseek: 'hola' }), env: todas })
  assert.equal(r.texto, 'hola')

  // Todos fallan → ErrorIA con el detalle de intentos
  await assert.rejects(
    llamarIA('plan_entreno', { sistema: 's', usuario: 'u', json: true }, { adaptador: adaptadorCon({ anthropic: new Error('a'), openai: new Error('b'), deepseek: new Error('c') }), env: todas }),
    (e: unknown) => e instanceof ErrorIA && e.intentos.length === 3,
  )

  // Presupuesto de tiempo: si ya no queda, no se llama a nadie
  let t = 0
  await assert.rejects(
    llamarIA('plan_entreno', { sistema: 's', usuario: 'u', presupuestoMs: 10_000 }, { adaptador: adaptadorCon({}), env: todas, ahora: () => (t += 5_000) }),
    (e: unknown) => e instanceof ErrorIA && e.intentos.every(i => i.error === 'sin tiempo'),
  )

  console.log('enrutador-ia.test.ts OK')
})().catch(e => { console.error(e); process.exit(1) })
