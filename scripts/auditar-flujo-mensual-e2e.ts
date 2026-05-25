import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { evaluarCheckin } from '../lib/periodizacion/arbol-decision'
import { calcularAjusteCaloricoSemanal } from '../lib/periodizacion/motor-macros'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nutricoach-delta.vercel.app'

type Check = {
  area: string
  ok: boolean
  severity: 'info' | 'warning' | 'critical'
  message: string
  data?: unknown
}

const checks: Check[] = []

function add(area: string, ok: boolean, severity: Check['severity'], message: string, data?: unknown) {
  checks.push({ area, ok, severity, message, data })
}

async function count(table: string, filters: (q: any) => any) {
  const res = await filters(supabase.from(table).select('id', { count: 'exact', head: true }))
  return res.count ?? 0
}

async function main() {
  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('id, profile_id, objetivo, activo, revisado_por_coach, onboarding_completado, created_at')
    .eq('onboarding_completado', true)
    .order('created_at', { ascending: false })
    .limit(12)

  if (clientesError) throw new Error(clientesError.message)
  add('clientes', Boolean(clientes?.length), 'critical', `Clientes con onboarding completado: ${clientes?.length ?? 0}`)

  let cliente = clientes?.find(c => c.activo && c.revisado_por_coach) ?? clientes?.[0]
  if (!cliente) {
    await writeReport(null)
    process.exit(1)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, email')
    .eq('id', cliente.profile_id)
    .maybeSingle()

  const clienteLabel = `${profile?.nombre ?? 'Cliente'} (${profile?.email ?? cliente.id})`

  const [
    onboardingRes,
    perfilRes,
    planNutriRes,
    planEntrenoRes,
    registrosIaRes,
    tareasRes,
    periodizacionRes,
  ] = await Promise.all([
    supabase.from('onboarding_responses').select('*').eq('cliente_id', cliente.id).maybeSingle(),
    supabase.from('onboarding_perfil_profundo').select('*').eq('cliente_id', cliente.id).maybeSingle(),
    supabase.from('planes_nutricion').select('*').eq('cliente_id', cliente.id).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('planes_entrenamiento').select('*').eq('cliente_id', cliente.id).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('registros_ia').select('id, tipo, created_at').eq('cliente_id', cliente.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('agente_tareas').select('id, agente, tipo, estado, created_at').eq('cliente_id', cliente.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('periodizacion_acciones').select('id, accion, aplicado, requiere_aprobacion, created_at').eq('cliente_id', cliente.id).order('created_at', { ascending: false }).limit(10),
  ])

  add('onboarding', Boolean(onboardingRes.data), 'critical', 'Existe onboarding_responses para el cliente seleccionado')
  add('onboarding', Boolean(perfilRes.data), 'warning', 'Existe onboarding_perfil_profundo para personalización avanzada')
  add('cliente', Boolean(cliente.activo && cliente.revisado_por_coach), cliente.activo ? 'warning' : 'critical', `Cliente activo=${cliente.activo}, revisado_por_coach=${cliente.revisado_por_coach}`)

  const planNutri = planNutriRes.data
  add('nutricion', Boolean(planNutri), 'critical', 'Existe plan nutricional activo')
  if (planNutri) {
    add('nutricion', Boolean(planNutri.codigo_publico), 'critical', 'Plan nutricional activo tiene codigo_publico para portal/check-in')
    add('nutricion', Number(planNutri.kcal_objetivo ?? 0) > 1000, 'critical', `Kcal objetivo plausible: ${planNutri.kcal_objetivo}`)
    add('nutricion', Number(planNutri.proteinas_objetivo ?? 0) > 40, 'critical', `Proteína objetivo plausible: ${planNutri.proteinas_objetivo}`)

    const comidas = await count('comidas', (q) => q.eq('plan_id', planNutri.id))
    const comidasConReceta = await count('comidas', (q) => q.eq('plan_id', planNutri.id).not('receta_id', 'is', null))
    const alimentos = await count('comida_alimentos', async (q) => {
      const { data } = await supabase.from('comidas').select('id').eq('plan_id', planNutri.id)
      const ids = (data ?? []).map(r => r.id)
      return ids.length ? q.in('comida_id', ids) : q.eq('id', '00000000-0000-0000-0000-000000000000')
    })

    add('nutricion', comidas >= 4, 'critical', `Comidas creadas en plan: ${comidas}`)
    add('nutricion', comidasConReceta > 0 || alimentos > 0, 'critical', `Comidas vinculadas a recetas o alimentos: recetas=${comidasConReceta}, alimentos=${alimentos}`)
  }

  const planEntreno = planEntrenoRes.data
  add('entrenamiento', Boolean(planEntreno), 'critical', 'Existe plan de entrenamiento activo')
  if (planEntreno) {
    const sesiones = await count('sesiones_entrenamiento', (q) => q.eq('plan_id', planEntreno.id))
    add('entrenamiento', sesiones > 0, 'critical', `Sesiones de entrenamiento creadas: ${sesiones}`)
  }

  const checkins30 = await count('checkins', (q) => q.eq('cliente_id', cliente.id).gte('fecha', new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]))
  const actividad30 = await count('actividad_externa_cliente', (q) => q.eq('cliente_id', cliente.id).gte('fecha', new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]))
  add('mes_1', checkins30 >= 1, 'warning', `Check-ins últimos 30 días: ${checkins30}`)
  add('mes_1', actividad30 >= 1, 'warning', `Actividad externa/manual últimos 30 días: ${actividad30}`)

  add('ia', (registrosIaRes.data ?? []).length > 0, 'warning', `Registros IA del cliente: ${registrosIaRes.data?.length ?? 0}`, registrosIaRes.data)
  add('agentes', (tareasRes.data ?? []).length > 0, 'warning', `Tareas de agentes del cliente: ${tareasRes.data?.length ?? 0}`, tareasRes.data)
  add('periodizacion', (periodizacionRes.data ?? []).length > 0, 'warning', `Acciones de periodización del cliente: ${periodizacionRes.data?.length ?? 0}`, periodizacionRes.data)

  if (planNutri) {
    const decision = evaluarCheckin({
      energia: 2,
      horas_sueno: 5,
      adherencia: 60,
      tls_semanal: 120,
      semanas_en_deficit: 4,
      umbral_carga_alta: 80,
    })
    const ajuste = calcularAjusteCaloricoSemanal({
      kcal: planNutri.kcal_objetivo ?? 2000,
      proteinas: planNutri.proteinas_objetivo ?? 150,
      carbohidratos: planNutri.carbohidratos_objetivo ?? 200,
      grasas: planNutri.grasas_objetivo ?? 70,
    })
    add('periodizacion', Boolean(decision.accion), 'critical', `Árbol de decisión responde: ${decision.accion}`)
    add('periodizacion', ajuste.kcal_ajustado !== planNutri.kcal_objetivo, 'critical', `Motor macros calcula ajuste: ${planNutri.kcal_objetivo} → ${ajuste.kcal_ajustado}`, ajuste)
  }

  const [genLoteAuth, importLoteAuth] = await Promise.all([
    fetch(`${APP_URL}/api/recetas/generar-lote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bloque: 'test', tipo: 'manual' }) }),
    fetch(`${APP_URL}/api/recetas/importar-lote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recetas: [] }) }),
  ])
  add('seguridad', genLoteAuth.status === 401, 'critical', `generar-lote sin sesión responde ${genLoteAuth.status}`)
  add('seguridad', importLoteAuth.status === 401, 'critical', `importar-lote sin sesión responde ${importLoteAuth.status}`)

  await writeReport({
    cliente_id: cliente.id,
    cliente: clienteLabel,
    objetivo: cliente.objetivo,
  })
}

async function writeReport(cliente: unknown) {
  const resumen = {
    fecha: new Date().toISOString(),
    cliente,
    ok: checks.filter(c => c.ok).length,
    warnings: checks.filter(c => !c.ok && c.severity === 'warning').length,
    criticals: checks.filter(c => !c.ok && c.severity === 'critical').length,
    checks,
  }
  const outDir = path.resolve(process.cwd(), 'salidas')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, '25-05-2026_auditoria-e2e-mensual.json')
  fs.writeFileSync(outFile, JSON.stringify(resumen, null, 2))

  console.log(`Cliente: ${(cliente as { cliente?: string } | null)?.cliente ?? 'sin cliente'}`)
  console.log(`OK: ${resumen.ok} | warnings: ${resumen.warnings} | críticos: ${resumen.criticals}`)
  for (const check of checks) {
    const mark = check.ok ? 'OK' : check.severity.toUpperCase()
    console.log(`[${mark}] ${check.area}: ${check.message}`)
  }
  console.log(`Reporte: ${outFile}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
