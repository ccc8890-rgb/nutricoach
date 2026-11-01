import assert from 'node:assert/strict'
import { promptFotoLimpia, limpiarFotoPlato } from '../lib/platos/foto-limpia'

const buf = Buffer.alloc(100, 1)
const foto = { buffer: buf, mediaType: 'image/jpeg' }

;(async () => {
  // Prompt: conserva el plato, no añade nada
  const p = promptFotoLimpia()
  assert.match(p, /do not add/i)
  assert.match(p, /same dish/i)

  // Sin clave de OpenAI → null, sin llamar a nada
  let llamadas = 0
  const fetchContado = (async () => { llamadas++; return new Response('{}') }) as typeof fetch
  assert.equal(await limpiarFotoPlato(foto, { env: {}, fetchFn: fetchContado }), null)
  assert.equal(llamadas, 0)

  // Sin saldo (402/429) o error de red → null, nunca lanza
  const sinSaldo = (async () => new Response('billing', { status: 402 })) as typeof fetch
  assert.equal(await limpiarFotoPlato(foto, { env: { OPENAI_API_KEY: 'x' }, fetchFn: sinSaldo }), null)
  const red = (async () => { throw new Error('boom') }) as typeof fetch
  assert.equal(await limpiarFotoPlato(foto, { env: { OPENAI_API_KEY: 'x' }, fetchFn: red }), null)

  // Respuesta vacía → null
  const vacia = (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as typeof fetch
  assert.equal(await limpiarFotoPlato(foto, { env: { OPENAI_API_KEY: 'x' }, fetchFn: vacia }), null)

  // Respuesta buena → Buffer decodificado
  const bien = (async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('imagen').toString('base64') }] }), { status: 200 })) as typeof fetch
  const r = await limpiarFotoPlato(foto, { env: { OPENAI_API_KEY: 'x' }, fetchFn: bien })
  assert.equal(r?.toString(), 'imagen')

  console.log('platos-foto-limpia OK')
})()
