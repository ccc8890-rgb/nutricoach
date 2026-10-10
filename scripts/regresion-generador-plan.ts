// Ejecuta generarPlanEntrenoIA con los datos REALES de un cliente (solo lectura) y DeepSeek simulado, y comprueba que el prompt conserva lo imprescindible.
// Uso: npx tsx scripts/regresion-generador-plan.ts <prefijo-id-cliente>
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
import { generarPlanEntrenoIA } from '../lib/entrenos/generar-plan-ia'

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: cli } = await db.from('clientes').select('id')
  const id = (cli ?? []).find(c => String(c.id).startsWith(process.argv[2] ?? '04cc53b3'))?.id
  assert.ok(id, 'cliente no encontrado')

  let prompt = ''
  const fetchReal = globalThis.fetch
  globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
    // Solo se simula DeepSeek; Supabase y el resto usan el fetch real.
    if (!String(url).includes('deepseek.com')) return fetchReal(url as RequestInfo, init as RequestInit)
    prompt = String(init?.body ?? '')
    const plan = { nombre_plan: 'Plan simulado', duracion_semanas: 4, fundamentacion: 'simulado', sesiones: [
      { nombre: 'Carrera: Rodaje fácil', dia_semana: 'martes', ejercicios: [{ nombre: 'Rodaje continuo' }] },
      { nombre: 'Carrera: Tempo', dia_semana: 'jueves', ritmo_objetivo: '4:38/km', duracion_min: 35, ejercicios: [] },
      { nombre: 'Carrera: Tirada larga', dia_semana: 'sabado', duracion_min: 40, ejercicios: [] },
    ] }
    return { ok: true, text: async () => '', json: async () => ({ choices: [{ message: { content: JSON.stringify(plan) } }] }) } as unknown as Response
  }) as typeof fetch

  try {
    const r = await generarPlanEntrenoIA(db, { clienteId: id! })
    // El prompt conserva el esqueleto del motor, los datos reales y el protocolo del deporte.
    assert.ok(prompt.includes('ESQUELETO CALCULADO DEL MACROCICLO'), 'falta el esqueleto')
    assert.ok(prompt.includes('DATOS REALES DEL RELOJ'), 'faltan los datos del reloj')
    if (r.esHibrido) assert.ok(prompt.includes('EXACTAMENTE 6 SESIONES'), 'falta el protocolo híbrido')
    assert.ok(r.macrociclo && r.macrociclo.semanas.length > 0, 'sin macrociclo')
    assert.ok(r.macrociclo!.fundamentos.length > 0, 'sin fundamentos')
    assert.ok(r.validacion, 'sin validación del plan simulado')
    console.log('regresion-generador-plan OK ·', r.modalidad, '· fase', r.faseBloque ?? '-', '· semana 1:', JSON.stringify(r.macrociclo!.semanas[0].sesiones))
  } finally { globalThis.fetch = fetchReal }
}
main()
