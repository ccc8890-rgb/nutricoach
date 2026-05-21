#!/usr/bin/env tsx
/**
 * Backfill: Regenera planes de nutrición para clientes de prueba,
 * ahora con TAG_BRIDGE activo para que DeepSeek reciba evidencia real de PubMed.
 *
 * Uso: npx tsx scripts/backfill-planes-evidencia.ts
 * Modo dry-run: npx tsx scripts/backfill-planes-evidencia.ts --dry-run
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceSupabase } from '../lib/supabase-server'
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '../lib/knowledge-base'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const supabase = createServiceSupabase()

  // 1. Obtener clientes con onboarding y sus nombres desde profiles
  const { data: onboardingList } = await supabase
    .from('onboarding_responses')
    .select('cliente_id')

  if (!onboardingList || onboardingList.length === 0) {
    console.log('No se encontraron clientes con onboarding.')
    return
  }

  const clienteIds = [...new Set(onboardingList.map(r => r.cliente_id))]

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, profile_id, objetivo, peso_inicial, altura, edad, sexo, restricciones_alimentarias')
    .in('id', clienteIds)

  if (!clientes || clientes.length === 0) {
    console.log('No se encontraron clientes en la tabla clientes.')
    return
  }

  // Obtener nombres desde profiles
  const profileIds = [...new Set(clientes.map(c => c.profile_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellidos')
    .in('id', profileIds)

  const mapNombre: Record<string, string> = {}
  if (profiles) {
    for (const p of profiles) {
      mapNombre[p.id] = `${p.nombre ?? ''} ${p.apellidos ?? ''}`.trim()
    }
  }

  console.log(`Clientes encontrados: ${clientes.length}`)

  let totalPapers = 0
  let conProtocolos = 0

  for (const c of clientes) {
    const nombreCliente = mapNombre[c.profile_id] ?? 'Cliente'

    // Obtener onboarding + perfil
    const { data: onboarding } = await supabase
      .from('onboarding_responses')
      .select('*')
      .eq('cliente_id', c.id)
      .single()

    const { data: perfil } = await supabase
      .from('onboarding_perfil_profundo')
      .select('*')
      .eq('cliente_id', c.id)
      .maybeSingle()

    if (!onboarding) continue

    // 2. Seleccionar protocolos con TAG_BRIDGE
    const protocolos = await seleccionarProtocolos(supabase, {
      objetivo: onboarding.objetivo,
      tipo_entreno: onboarding.tipo_entreno?.join(', '),
      condiciones_salud: perfil?.condiciones_salud,
      restricciones_alimentarias: c.restricciones_alimentarias,
      edad: c.edad,
      sexo: c.sexo,
    })

    totalPapers += protocolos.reduce((sum, p) => sum + p.referencias.length, 0)
    if (protocolos.length > 0) conProtocolos++

    console.log(`\n  ${nombreCliente.padEnd(20)} (${c.id.slice(0, 8)}...)`)
    console.log(`    Objetivo: ${onboarding.objetivo}`)
    console.log(`    Protocolos KB: ${protocolos.length}`)
    protocolos.slice(0, 3).forEach(p =>
      console.log(`      📄 ${p.titulo.slice(0, 60)} | refs: ${p.referencias.length}`)
    )

    if (dryRun) continue

    // 3. Actualizar plan existente o crear placeholder con evidencia
    const { data: planExistente } = await supabase
      .from('planes_nutricion')
      .select('id, plan_json')
      .eq('cliente_id', c.id)
      .maybeSingle()

    if (planExistente) {
      // Marcar plan existente con flag de evidencia actualizada
      const planJson = planExistente.plan_json
        ? (typeof planExistente.plan_json === 'string'
          ? JSON.parse(planExistente.plan_json)
          : planExistente.plan_json)
        : { estado: 'pendiente_generar' }

      planJson.evidencia_cientifica = {
        actualizada_con_bridge: true,
        fecha: new Date().toISOString(),
        protocolos: protocolos.map(p => ({
          id: p.id,
          titulo: p.titulo,
          tags: p.tags,
          referencias: p.referencias,
        })),
      }

      await supabase
        .from('planes_nutricion')
        .update({ plan_json: planJson, updated_at: new Date().toISOString() })
        .eq('id', planExistente.id)

      console.log(`    ✅ Plan ${planExistente.id.slice(0, 8)} actualizado con ${protocolos.length} protocolos`)
    } else {
      // Crear plan placeholder con evidencia
      const evidencia = formatearEvidenciaParaPrompt(protocolos)
      await supabase.from('planes_nutricion').insert({
        cliente_id: c.id,
        plan_json: {
          evidencia_cientifica: {
            actualizada_con_bridge: true,
            fecha: new Date().toISOString(),
            protocolos: protocolos.map(p => ({
              id: p.id,
              titulo: p.titulo,
              tags: p.tags,
              referencias: p.referencias,
            })),
          },
          contextoCompleto: evidencia,
          estado: 'pendiente_generar',
          creado_con_bridge: true,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      console.log(`    🆕 Plan placeholder creado con ${protocolos.length} protocolos`)
    }
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  RESUMEN BACKFILL')
  console.log('═══════════════════════════════════════')
  console.log(`  Clientes procesados: ${clientes.length}`)
  console.log(`  Clientes con protocolos KB: ${conProtocolos}/${clientes.length}`)
  console.log(`  Total referencias en evidencia: ${totalPapers}`)
  console.log(`  Modo: ${dryRun ? '🔍 DRY-RUN' : '✅ EJECUTADO'}`)
  if (!dryRun) {
    console.log('\n  Los planes existentes ahora tienen evidencia científica real.')
    console.log('  Los planes placeholder están listos para regeneración completa.')
  }
}

main().catch(console.error)
