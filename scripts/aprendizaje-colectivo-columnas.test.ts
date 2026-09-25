import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const env = readFileSync(envPath, 'utf8')
for (const line of env.split('\n')) {
  const [k, ...rest] = line.split('=')
  if (k && rest.length) process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
}

// Regresión: `obtenerPatronesRelevantes` leía columnas (`patron`,
// `condicion_contexto`, `recomendacion_accion`) que no existen en la tabla
// real `conocimiento_colectivo` (`observacion`, `condicion`, `accion_sugerida`).
// La select fallaba en silencio y la función devolvía siempre '' — este test
// confirma contra Supabase real que ahora encuentra patrones activos.
async function main() {
  const { obtenerPatronesRelevantes } = await import('../lib/agentes/aprendizaje-colectivo')
  const resultado = await obtenerPatronesRelevantes('perder_grasa')
  assert.ok(
    resultado.includes('CONOCIMIENTO COLECTIVO VALIDADO'),
    'obtenerPatronesRelevantes debe devolver patrones reales para un objetivo con datos seed, no string vacío'
  )
  console.log('OK — aprendizaje-colectivo-columnas')
}
main()
