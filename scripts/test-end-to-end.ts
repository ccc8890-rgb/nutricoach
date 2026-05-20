/**
 * 🧪 Test end-to-end: verifica que los 4 nuevos gaps funcionan en producción
 *
 * 1. Llama al endpoint real POST /api/generar-plan-inicial para cada cliente test
 * 2. Verifica que los campos nuevos aparecen en la respuesta:
 *    - recomendacion_entreno       (Gap #9)
 *    - nutricion_peri_entreno      (Gap #4)
 *    - validacion_micronutrientes  (Gap #7)
 *    - pildoras_educativas_inicio  (Gap #8)
 * 3. Genera un reporte detallado de cada cliente
 *
 * Uso: npx tsx scripts/test-end-to-end.ts
 * Requiere: .env.local con SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// ── Config ─────────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nutricoach-delta.vercel.app'
const ENDPOINT = `${API_URL}/api/generar-plan-inicial`

const COL = {
  verde: (s: string) => `\x1b[32m${s}\x1b[0m`,
  rojo: (s: string) => `\x1b[31m${s}\x1b[0m`,
  ama: (s: string) => `\x1b[33m${s}\x1b[0m`,
  azul: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cielo: (s: string) => `\x1b[36m${s}\x1b[0m`,
  reset: '\x1b[0m',
}

interface ResultadoCliente {
  nombre: string
  clienteId: string
  ok: boolean
  modo: string
  kcal: number | null
  gaps: {
    recomendacion_entreno: boolean
    nutricion_peri_entreno: boolean
    validacion_micronutrientes: boolean
    pildoras_educativas_inicio: boolean
  }
  tiempoMs: number
  error?: string
}

// ── Verificar campos en la respuesta ─────────────────────────────────────
function verificarCamposGap(plan: Record<string, unknown>): {
  recomendacion_entreno: boolean
  nutricion_peri_entreno: boolean
  validacion_micronutrientes: boolean
  pildoras_educativas_inicio: boolean
} {
  const re = plan.recomendacion_entreno as Record<string, unknown> | null
  const pe = plan.nutricion_peri_entreno as Record<string, unknown> | null
  const vm = plan.validacion_micronutrientes as Record<string, unknown> | null
  const pi = plan.pildoras_educativas_inicio as Array<unknown> | null

  // Gap #9: RecomendacionEntreno → { foco_principal, dias_semana, intensidad, volumen, tier }
  const gap9 = !!re && typeof re.foco_principal === 'string'

  // Gap #4: RecomendacionPeriEntreno → { pre_entreno: { recomendacion, timing, macros }, post_entreno, ... }
  const preEntreno = pe?.pre_entreno as Record<string, unknown> | null
  const gap4 = !!pe && !!preEntreno && typeof preEntreno.recomendacion === 'string'

  // Gap #7: ResultadoValidacionMicronutrientes → { cumple_sodio, cumple_azucares, cumple_fibra, alertas, totales, resumen }
  const gap7 = !!vm && typeof vm.cumple_sodio === 'boolean' && typeof vm.resumen === 'string'

  // Gap #8: PilloraEducativa[] → cada item tiene { titulo, categoria, contenido, momento, emoji }
  const gap8 = Array.isArray(pi) && pi.length > 0 && typeof (pi[0] as Record<string, unknown>)?.titulo === 'string'

  return {
    recomendacion_entreno: gap9,
    nutricion_peri_entreno: gap4,
    validacion_micronutrientes: gap7,
    pildoras_educativas_inicio: gap8,
  }
}

function iconoOk(val: boolean): string {
  return val ? COL.verde('✓') : COL.rojo('✗')
}

// ── Probar un cliente ────────────────────────────────────────────────────
async function probarCliente(clienteId: string, nombre: string): Promise<ResultadoCliente> {
  const resultado: ResultadoCliente = {
    nombre,
    clienteId,
    ok: false,
    modo: '',
    kcal: null,
    gaps: { recomendacion_entreno: false, nutricion_peri_entreno: false, validacion_micronutrientes: false, pildoras_educativas_inicio: false },
    tiempoMs: 0,
  }

  const inicio = Date.now()
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: clienteId }),
    })
    resultado.tiempoMs = Date.now() - inicio

    if (!res.ok) {
      const errBody = await res.text()
      resultado.error = `HTTP ${res.status}: ${errBody.slice(0, 200)}`
      return resultado
    }

    const body = await res.json()
    resultado.ok = body.ok === true
    resultado.modo = body.modo || '?'
    resultado.kcal = body.plan?.kcal_objetivo ?? null

    // Verificar los 4 gaps
    if (body.plan) {
      resultado.gaps = verificarCamposGap(body.plan)
    } else {
      resultado.error = 'Respuesta sin plan'
    }
  } catch (err: any) {
    resultado.tiempoMs = Date.now() - inicio
    resultado.error = `Fetch error: ${err.message}`
  }

  return resultado
}

// ── Reporte detallado de gaps ────────────────────────────────────────────
function imprimirReporteGaps(r: ResultadoCliente): void {
  const g = r.gaps
  console.log(`    ${iconoOk(g.recomendacion_entreno)} Gap #9 — Recomendación entreno`)
  console.log(`    ${iconoOk(g.nutricion_peri_entreno)} Gap #4 — Nutrición peri-entreno`)
  console.log(`    ${iconoOk(g.validacion_micronutrientes)} Gap #7 — Validación micronutrientes`)
  console.log(`    ${iconoOk(g.pildoras_educativas_inicio)} Gap #8 — Micro-learning (píldoras)`)
}

function imprimirDetalleGaps(plan: Record<string, unknown>): void {
  const re = plan.recomendacion_entreno as Record<string, unknown> | null
  if (re) {
    console.log(`      🏋️ Foco entreno: ${re.foco_principal}`)
    console.log(`      📅 Días: ${re.dias_semana} | Intensidad: ${re.intensidad} | Volumen: ${re.volumen}`)
  }

  const pe = plan.nutricion_peri_entreno as Record<string, unknown> | null
  if (pe) {
    const pre = pe.pre_entreno as Record<string, unknown> | null
    const intra = pe.intra_entreno as Record<string, unknown> | null
    const post = pe.post_entreno as Record<string, unknown> | null
    if (pre) console.log(`      🥤 Pre-entreno: ${(pre.recomendacion as string)?.slice(0, 80)}...`)
    if (intra) console.log(`      💧 Intra: ${(intra.hidratacion as string)?.slice(0, 80)}...`)
    if (post) console.log(`      🥩 Post-entreno: ventana ${post.ventana_anabolica}`)
  }

  const vm = plan.validacion_micronutrientes as Record<string, unknown> | null
  if (vm) {
    console.log(`      ✅ Cumple sodio: ${vm.cumple_sodio} | azúcares: ${vm.cumple_azucares} | fibra: ${vm.cumple_fibra}`)
    console.log(`      ⚠️ Alertas: ${(vm.alertas as Array<unknown>)?.length ?? 0}`)
    console.log(`      📝 Resumen: ${(vm.resumen as string)?.slice(0, 100)}`)
    const totales = vm.totales as Record<string, unknown> | null
    if (totales) {
      console.log(`      🧂 Sodio: ${totales.sodio_mg}mg | Azúcares: ${totales.azucares_g}g | Fibra: ${totales.fibra_g}g`)
    }
  }

  const pi = plan.pildoras_educativas_inicio as Array<Record<string, unknown>> | null
  if (pi && pi.length > 0) {
    console.log(`      📚 ${pi.length} píldoras educativas:`)
    pi.forEach((p, i) => {
      console.log(`        ${i + 1}. ${p.emoji || '📖'} ${p.titulo}`)
    })
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${COL.cielo('═══════════════════════════════════════════════════════════════')}`)
  console.log(`${COL.cielo('  🧪 TEST END-TO-END — Verificación de los 4 nuevos gaps')}`)
  console.log(`${COL.cielo('═══════════════════════════════════════════════════════════════')}`)
  console.log(`\n  Endpoint: ${COL.azul(ENDPOINT)}\n`)

  // Obtener clientes test
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, objetivo, edad, peso_inicial, sexo, onboarding_completado, notas')
    .eq('onboarding_completado', true)
    .not('edad', 'is', null)

  if (!clientes || clientes.length === 0) {
    console.log(`  ${COL.rojo('✗')} No se encontraron clientes con onboarding completado`)
    console.log(`\n  Ejecuta primero: npx tsx scripts/seed-clientes-test.ts`)
    return
  }

  const clientesFiltrados = clientes.filter(c => c.edad && c.edad > 18)

  console.log(`  ${COL.azul(`→`)} Clientes encontrados: ${clientesFiltrados.length}\n`)

  // Probar cada cliente
  const resultados: ResultadoCliente[] = []

  for (let i = 0; i < clientesFiltrados.length; i++) {
    const c = clientesFiltrados[i]
    const label = `${c.objetivo} / ${c.edad} años / ${c.sexo || '?'}`
    console.log(`${COL.azul(`[${i + 1}/${clientesFiltrados.length}]`)} ${COL.ama(`Cliente ${c.id.slice(0, 8)}...`)} — ${label}`)

    const r = await probarCliente(c.id, label)
    resultados.push(r)

    if (r.ok) {
      console.log(`  ${COL.verde('✓')} Plan generado | Modo: ${r.modo} | Kcal: ${r.kcal} | ${r.tiempoMs}ms`)
      imprimirReporteGaps(r)
    } else {
      console.log(`  ${COL.rojo('✗')} Falló: ${r.error}`)
    }
    console.log('')
  }

  // ═══ RESUMEN FINAL ═════════════════════════════════════════════════════
  console.log(`${COL.cielo('═══════════════════════════════════════════════════════════════')}`)
  console.log(`${COL.cielo('  📊 RESUMEN FINAL')}`)
  console.log(`${COL.cielo('═══════════════════════════════════════════════════════════════')}\n`)

  const totales = {
    ok: resultados.filter(r => r.ok).length,
    fail: resultados.filter(r => !r.ok).length,
    gap9: resultados.filter(r => r.gaps.recomendacion_entreno).length,
    gap4: resultados.filter(r => r.gaps.nutricion_peri_entreno).length,
    gap7: resultados.filter(r => r.gaps.validacion_micronutrientes).length,
    gap8: resultados.filter(r => r.gaps.pildoras_educativas_inicio).length,
  }

  for (const r of resultados) {
    const icono = r.ok ? COL.verde('✓') : COL.rojo('✗')
    const g = r.gaps
    const numGapsOk = [g.recomendacion_entreno, g.nutricion_peri_entreno, g.validacion_micronutrientes, g.pildoras_educativas_inicio].filter(Boolean).length
    console.log(`  ${icono} ${r.clienteId.slice(0, 8)}... | ${r.modo.padEnd(16)} | ${String(r.kcal ?? '?').padStart(5)} kcal | ${numGapsOk}/4 gaps | ${r.tiempoMs}ms`)
  }

  console.log('')
  console.log(`  ${COL.cielo('Gaps implementados:')}`)
  console.log(`    ${iconoOk(totales.gap9 === resultados.length)} Gap #9 — Motor entreno:    ${totales.gap9}/${resultados.length}`)
  console.log(`    ${iconoOk(totales.gap4 === resultados.length)} Gap #4 — Peri-entreno:     ${totales.gap4}/${resultados.length}`)
  console.log(`    ${iconoOk(totales.gap7 === resultados.length)} Gap #7 — Micronutrientes:  ${totales.gap7}/${resultados.length}`)
  console.log(`    ${iconoOk(totales.gap8 === resultados.length)} Gap #8 — Micro-learning:   ${totales.gap8}/${resultados.length}`)

  const todosOk = totales.gap9 === resultados.length && totales.gap4 === resultados.length && totales.gap7 === resultados.length && totales.gap8 === resultados.length && totales.fail === 0

  console.log('')
  if (todosOk) {
    console.log(`  ${COL.verde('✅ TODOS LOS GAPS VERIFICADOS — 0 errores')}`)
  } else {
    console.log(`  ${COL.rojo(`❌ ${totales.fail} fallos — revisar arriba`)}`)
  }
  console.log(`\n  ${COL.azul(`Tiempo total: ${resultados.reduce((s, r) => s + r.tiempoMs, 0)}ms (${(resultados.reduce((s, r) => s + r.tiempoMs, 0) / 1000).toFixed(1)}s)`)}`)
  console.log('')
}

main().catch(console.error)
