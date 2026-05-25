import assert from 'node:assert/strict'
import {
  COSTE_MAXIMO_ESTIMADO_USD,
  construirPromptLoteRecetas,
  estimarCosteLoteUSD,
  extraerJsonLoteRecetas,
  MAX_RECETAS_LOTE,
  normalizarRequestLoteRecetas,
} from '../lib/recetas/generacion-lote'

const input = normalizarRequestLoteRecetas({
  bloque: 'post-entreno running',
  tipo: 'slot',
  cantidad: 99,
  objetivo: 'rendimiento',
  deporte: 'running',
  momento: 'post_entreno',
  confirmar: false,
})

assert.equal(input.cantidad, MAX_RECETAS_LOTE)
assert.equal(input.proveedor, 'deepseek')
assert.equal(input.confirmar, false)

const prompt = construirPromptLoteRecetas(input)
assert.match(prompt, /estado "en_revision"/)
assert.match(prompt, /RESPONDE SOLO JSON VALIDO/)
assert.doesNotMatch(prompt.toLowerCase(), /openai|gpt-4|gpt-5/)

const coste = estimarCosteLoteUSD(prompt)
assert.ok(coste > 0)
assert.ok(coste < COSTE_MAXIMO_ESTIMADO_USD)

const parsed = extraerJsonLoteRecetas('```json\n{"recetas":[{"nombre":"Bowl test"}]}\n```')
assert.equal(parsed.recetas.length, 1)

console.log('generacion-lote-recetas.test.ts OK')
