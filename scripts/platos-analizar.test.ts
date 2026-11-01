import assert from 'node:assert/strict'
import { validarAnalisisPlato, construirPromptPlato, analizarFotoPlato } from '../lib/platos/analizar'
import { rutasDe, type Adaptador, type ParamsIA } from '../lib/ia/enrutador'

const valido = { nombre: 'Tortilla de patata con ensalada', porciones: 1, ingredientes: [{ nombre: 'Huevo', gramos: 150 }, { nombre: 'Patata', gramos: 200 }], pasos: ['Fríe la patata.', 'Cuaja con el huevo.'] }

// Validación estricta
assert.equal(validarAnalisisPlato({}).ok, false)
assert.equal(validarAnalisisPlato({ ...valido, ingredientes: [] }).ok, false)
assert.equal(validarAnalisisPlato({ ...valido, ingredientes: [{ nombre: 'Huevo', gramos: 0 }] }).ok, false)
assert.equal(validarAnalisisPlato({ ...valido, ingredientes: [{ nombre: 'Huevo', gramos: 5000 }] }).ok, false)
assert.equal(validarAnalisisPlato({ ...valido, nombre: '' }).ok, false)
assert.equal(validarAnalisisPlato({ ...valido, pasos: ['Mira https://spam.example'] }).ok, false, 'enlaces fuera')
const v = validarAnalisisPlato({ ...valido, porciones: undefined })
assert.ok(v.ok && v.valor.porciones === 1, 'porciones por defecto 1')
assert.ok(validarAnalisisPlato(valido).ok)

// Prompt: JSON, español, sin inventar
const pr = construirPromptPlato('lo como casi a diario')
assert.match(pr.sistema, /JSON/)
assert.match(pr.sistema, /no inventes/i)
assert.match(pr.usuario, /casi a diario/)

// Visión: nunca DeepSeek (no ve imágenes)
assert.ok(rutasDe('plato_foto', {}).every(r => r.proveedor !== 'deepseek'))

// analizarFotoPlato con adaptador falso
let recibidas: ParamsIA['imagenes']
const bueno: Adaptador = async (_r, p) => { recibidas = p.imagenes; return { texto: JSON.stringify(valido), uso: { entrada: 1, salida: 1 } } }
const env = { ANTHROPIC_API_KEY: 'x' }
;(async () => {
  const foto = { base64: 'AAAA', mediaType: 'image/jpeg' as const, nota: null }
  const r = await analizarFotoPlato(foto, { adaptador: bueno, env })
  assert.ok(r.ok)
  assert.equal(recibidas?.length, 1, 'la imagen llega al adaptador')

  const basura: Adaptador = async () => ({ texto: 'no soy json', uso: { entrada: 1, salida: 1 } })
  assert.equal((await analizarFotoPlato(foto, { adaptador: basura, env })).ok, false, 'basura → ok:false, sin lanzar')

  const lanza: Adaptador = async () => { throw new Error('boom') }
  assert.equal((await analizarFotoPlato(foto, { adaptador: lanza, env })).ok, false, 'excepción → ok:false')

  const absurdo: Adaptador = async () => ({ texto: JSON.stringify({ ...valido, ingredientes: [{ nombre: 'Huevo', gramos: 99999 }] }), uso: { entrada: 1, salida: 1 } })
  assert.equal((await analizarFotoPlato(foto, { adaptador: absurdo, env })).ok, false, 'gramos absurdos → ok:false')
  console.log('platos-analizar OK')
})()
