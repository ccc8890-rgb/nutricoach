/**
 * test-flujo-completo.ts
 * Traza el flujo E2E de generar-plan-inicial para Laura García sin llamar a DeepSeek.
 * Prueba: TDEE, consulta de recetas compatibles, carga de contexto executor.ts
 * Uso: npx tsx scripts/test-flujo-completo.ts
 */

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan env vars')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const LAURA_EMAIL = 'laura.garcia.test@nutricoach.dev'

// ── Mifflin-St Jeor para Laura ─────────────────────────────────────────────
function calcularTDEE(peso: number, altura: number, edad: number, sexo: 'hombre' | 'mujer', actividad: string): {
  tmb: number; tdee: number; kcalObjetivo: number
} {
  const tmb = sexo === 'mujer'
    ? 10 * peso + 6.25 * altura - 5 * edad - 161
    : 10 * peso + 6.25 * altura - 5 * edad + 5

  const factores: Record<string, number> = {
    sedentario: 1.2,
    ligero: 1.375,
    moderado: 1.55,
    activo: 1.725,
    muy_activo: 1.9,
  }
  const factor = factores[actividad] ?? 1.55
  const tdee = tmb * factor
  const kcalObjetivo = tdee - 400 // déficit para perdida de grasa

  return { tmb: Math.round(tmb), tdee: Math.round(tdee), kcalObjetivo: Math.round(kcalObjetivo) }
}

interface RecetaRow {
  id: string
  nombre: string
  kcal: number
  tipo_plato: string
  intolerancias: string[] | null
}

async function main() {
  const bugs: Array<{ severidad: string; descripcion: string; detalle?: string }> = []

  console.log('=== TEST FLUJO COMPLETO — Laura García ===\n')

  // ── 1. Leer cliente_id de Laura ──────────────────────────────────────────
  console.log('1. Leyendo cliente...')
  const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  const authUser = authUsers?.users.find(u => u.email === LAURA_EMAIL)
  if (!authUser) {
    console.error('ERROR: auth user de Laura no encontrado')
    process.exit(1)
  }

  const { data: clienteRow } = await db
    .from('clientes')
    .select('id, objetivo, peso_inicial, altura, edad, sexo')
    .eq('profile_id', authUser.id)
    .single()

  if (!clienteRow) {
    console.error('ERROR: fila en clientes no encontrada')
    process.exit(1)
  }

  const clienteId = clienteRow.id
  console.log(`   cliente_id: ${clienteId}`)

  // ── 2. TDEE ─────────────────────────────────────────────────────────────
  console.log('\n2. Calculando TDEE (Mifflin-St Jeor, moderado)...')
  const { tmb, tdee, kcalObjetivo } = calcularTDEE(68, 165, 32, 'mujer', 'moderado')
  console.log(`   TMB   : ${tmb} kcal`)
  console.log(`   TDEE  : ${tdee} kcal`)
  console.log(`   Objetivo (déficit -400): ${kcalObjetivo} kcal`)

  const kcalComida   = Math.round(kcalObjetivo * 0.35)
  const kcalCena     = Math.round(kcalObjetivo * 0.30)
  const kcalDesayuno = Math.round(kcalObjetivo * 0.20)
  const kcalSnack    = Math.round(kcalObjetivo * 0.075)

  console.log(`\n   Distribución objetivo:`)
  console.log(`   Desayuno : ${kcalDesayuno} kcal`)
  console.log(`   Comida   : ${kcalComida} kcal`)
  console.log(`   Merienda : ${kcalSnack} kcal`)
  console.log(`   Cena     : ${kcalCena} kcal`)

  // ── 3. Verificar onboarding_responses ───────────────────────────────────
  console.log('\n3. Verificando onboarding_responses...')
  const { data: onboarding, error: onbErr } = await db
    .from('onboarding_responses')
    .select('restricciones, alimentos_no_gustan, alimentos_base, objetivo, actividad_base, dias_entreno')
    .eq('cliente_id', clienteId)
    .single()

  if (onbErr || !onboarding) {
    console.error('   ERROR: onboarding_responses no encontrado:', onbErr?.message)
    bugs.push({ severidad: '🔴', descripcion: 'onboarding_responses no existe para este cliente', detalle: onbErr?.message })
  } else {
    console.log(`   objetivo         : ${onboarding.objetivo}`)
    console.log(`   actividad_base   : ${onboarding.actividad_base}`)
    console.log(`   dias_entreno     : ${onboarding.dias_entreno}`)
    console.log(`   restricciones    : ${JSON.stringify(onboarding.restricciones)}`)
    console.log(`   alimentos_no_gustan: ${JSON.stringify(onboarding.alimentos_no_gustan)}`)
    console.log(`   alimentos_base   : ${JSON.stringify(onboarding.alimentos_base)}`)
    if (!onboarding.restricciones?.length) {
      bugs.push({ severidad: '🟠', descripcion: 'restricciones vacías en onboarding_responses — executor.ts no puede poblar intolerancias', detalle: 'restricciones: []' })
    }
  }

  // ── 4. Verificar onboarding_perfil_profundo ──────────────────────────────
  console.log('\n4. Verificando onboarding_perfil_profundo...')
  const { data: perfil, error: perfErr } = await db
    .from('onboarding_perfil_profundo')
    .select('comidas_favoritas, alimentos_evitar_extra, condiciones_salud, descripcion_semana_entreno')
    .eq('cliente_id', clienteId)
    .single()

  if (perfErr || !perfil) {
    console.error('   ERROR: onboarding_perfil_profundo no encontrado:', perfErr?.message)
    bugs.push({ severidad: '🔴', descripcion: 'onboarding_perfil_profundo no existe', detalle: perfErr?.message })
  } else {
    console.log(`   comidas_favoritas     : ${JSON.stringify(perfil.comidas_favoritas)}`)
    console.log(`   alimentos_evitar_extra: ${JSON.stringify(perfil.alimentos_evitar_extra)}`)
    console.log(`   condiciones_salud     : ${perfil.condiciones_salud}`)
    console.log(`   descripcion_semana    : ${perfil.descripcion_semana_entreno}`)
  }

  // ── 5. Simular cargarContextoCliente preferencias_recetas ───────────────
  console.log('\n5. Simulando preferencias_recetas (lógica nueva de executor.ts)...')
  const rechazadosOnboarding: string[] = onboarding?.alimentos_no_gustan
    ? (Array.isArray(onboarding.alimentos_no_gustan)
        ? onboarding.alimentos_no_gustan as string[]
        : [onboarding.alimentos_no_gustan as string])
    : []
  const rechazadosPerfil: string[] = perfil?.alimentos_evitar_extra
    ? (Array.isArray(perfil.alimentos_evitar_extra)
        ? perfil.alimentos_evitar_extra as string[]
        : [perfil.alimentos_evitar_extra as string])
    : []
  const favoritosOnboarding: string[] = onboarding?.alimentos_base
    ? (Array.isArray(onboarding.alimentos_base)
        ? onboarding.alimentos_base as string[]
        : [onboarding.alimentos_base as string])
    : []
  const favoritosPerfil: string[] = perfil?.comidas_favoritas
    ? (Array.isArray(perfil.comidas_favoritas)
        ? perfil.comidas_favoritas as string[]
        : [perfil.comidas_favoritas as string])
    : []
  const intolerancias: string[] = onboarding?.restricciones
    ? (Array.isArray(onboarding.restricciones)
        ? onboarding.restricciones as string[]
        : [onboarding.restricciones as string])
    : []
  const patologias: string[] = perfil?.condiciones_salud
    ? (perfil.condiciones_salud as string).split(',').map((s: string) => s.trim()).filter(Boolean)
    : []

  const preferenciasRecetas = {
    alimentos_favoritos: favoritosPerfil.length > 0 ? favoritosPerfil : favoritosOnboarding,
    alimentos_rechazados: [...new Set([...rechazadosOnboarding, ...rechazadosPerfil])],
    dieta_habitual: perfil?.descripcion_semana_entreno ?? null,
    intolerancias,
    patologias,
  }

  console.log('   preferencias_recetas resultado:')
  console.log(JSON.stringify(preferenciasRecetas, null, 4))

  if (!preferenciasRecetas.intolerancias.length) {
    bugs.push({ severidad: '🟠', descripcion: 'preferencias_recetas.intolerancias está vacío — Sin Gluten no se pasa a la IA ni al filtro de recetas' })
  }
  if (!preferenciasRecetas.patologias.length) {
    bugs.push({ severidad: '🟠', descripcion: 'preferencias_recetas.patologias está vacío — resistencia_insulina no llega al sistema de decisión' })
  }

  // ── 6. Consulta de recetas compatibles para Comida ───────────────────────
  console.log('\n6. Consultando recetas compatibles (tipo_plato=Comida, Sin Gluten excluido, rango kcal)...')

  const tolerancia = 0.35
  const kcalMin = Math.round(kcalComida * (1 - tolerancia))
  const kcalMax = Math.round(kcalComida * (1 + tolerancia))
  console.log(`   Rango kcal: ${kcalMin} – ${kcalMax} (objetivo: ${kcalComida})`)

  // Con filtro de intolerancia Sin Gluten
  const { data: recetasConFiltro, error: recErr1 } = await db
    .from('recetas')
    .select('id, nombre, kcal, tipo_plato, intolerancias')
    .eq('estado', 'aprobada')
    .eq('tipo_plato', 'Comida')
    .gte('kcal', kcalMin)
    .lte('kcal', kcalMax)
    .not('intolerancias', 'cs', '{"Con Gluten"}')
    .limit(10)

  if (recErr1) {
    console.error('   ERROR consulta recetas con filtro:', recErr1.message)
    bugs.push({ severidad: '🔴', descripcion: 'Error en consulta recetas con filtro intolerancia', detalle: recErr1.message })
  } else {
    console.log(`   Recetas Comida Sin Gluten en rango (${kcalMin}-${kcalMax} kcal): ${recetasConFiltro?.length ?? 0}`)
    recetasConFiltro?.forEach((r: RecetaRow) => {
      console.log(`     - ${r.nombre} (${r.kcal} kcal) | intolerancias: ${JSON.stringify(r.intolerancias)}`)
    })
    if (!recetasConFiltro?.length) {
      bugs.push({ severidad: '🔴', descripcion: `0 recetas Comida sin gluten en rango ${kcalMin}-${kcalMax} kcal — la IA no tendrá opciones para Laura`, detalle: `Rango: ${kcalMin}-${kcalMax}, tipo_plato=Comida, NOT Con Gluten` })
    }
  }

  // Sin filtro intolerancia — para ver cuántas hay en el rango sin restricción
  const { data: recetasSinFiltro } = await db
    .from('recetas')
    .select('id, nombre, kcal, tipo_plato, intolerancias')
    .eq('estado', 'aprobada')
    .eq('tipo_plato', 'Comida')
    .gte('kcal', kcalMin)
    .lte('kcal', kcalMax)
    .limit(20)

  console.log(`   Total recetas Comida en rango (sin filtro gluten): ${recetasSinFiltro?.length ?? 0}`)
  if (recetasSinFiltro && recetasSinFiltro.length > 0 && (!recetasConFiltro?.length)) {
    console.log('   Recetas en rango (sin filtro):')
    recetasSinFiltro?.slice(0, 5).forEach((r: RecetaRow) => {
      const tieneGluten = r.intolerancias?.includes('Con Gluten')
      console.log(`     - ${r.nombre} (${r.kcal} kcal) | Con Gluten: ${tieneGluten}`)
    })
    bugs.push({ severidad: '🟠', descripcion: 'Hay recetas en el rango kcal pero todas tienen "Con Gluten" — recetario necesita más recetas sin gluten en esa franja', detalle: `${recetasSinFiltro.length} en rango, 0 sin gluten` })
  }

  // ── 7. Verificar Desayuno ────────────────────────────────────────────────
  console.log('\n7. Consultando recetas Desayuno sin gluten...')
  const kcalMinD = Math.round(kcalDesayuno * (1 - tolerancia))
  const kcalMaxD = Math.round(kcalDesayuno * (1 + tolerancia))

  const { data: recetasDesayuno } = await db
    .from('recetas')
    .select('id, nombre, kcal, tipo_plato, intolerancias')
    .eq('estado', 'aprobada')
    .eq('tipo_plato', 'Desayuno')
    .gte('kcal', kcalMinD)
    .lte('kcal', kcalMaxD)
    .not('intolerancias', 'cs', '{"Con Gluten"}')
    .limit(10)

  console.log(`   Rango desayuno: ${kcalMinD}-${kcalMaxD} kcal`)
  console.log(`   Recetas Desayuno sin gluten en rango: ${recetasDesayuno?.length ?? 0}`)
  recetasDesayuno?.forEach((r: RecetaRow) => console.log(`     - ${r.nombre} (${r.kcal} kcal)`))
  if (!recetasDesayuno?.length) {
    bugs.push({ severidad: '🟠', descripcion: `0 recetas Desayuno sin gluten en rango ${kcalMinD}-${kcalMaxD} kcal` })
  }

  // ── 8. Verificar Cena ────────────────────────────────────────────────────
  console.log('\n8. Consultando recetas Cena sin gluten...')
  const kcalMinC = Math.round(kcalCena * (1 - tolerancia))
  const kcalMaxC = Math.round(kcalCena * (1 + tolerancia))

  const { data: recetasCena } = await db
    .from('recetas')
    .select('id, nombre, kcal, tipo_plato, intolerancias')
    .eq('estado', 'aprobada')
    .eq('tipo_plato', 'Cena')
    .gte('kcal', kcalMinC)
    .lte('kcal', kcalMaxC)
    .not('intolerancias', 'cs', '{"Con Gluten"}')
    .limit(10)

  console.log(`   Rango cena: ${kcalMinC}-${kcalMaxC} kcal`)
  console.log(`   Recetas Cena sin gluten en rango: ${recetasCena?.length ?? 0}`)
  recetasCena?.forEach((r: RecetaRow) => console.log(`     - ${r.nombre} (${r.kcal} kcal)`))
  if (!recetasCena?.length) {
    bugs.push({ severidad: '🟠', descripcion: `0 recetas Cena sin gluten en rango ${kcalMinC}-${kcalMaxC} kcal` })
  }

  // ── 9. Verificar que generar-plan-inicial puede arrancar ─────────────────
  console.log('\n9. Verificando que generar-plan-inicial podría arrancar...')

  // Check onboarding exists (required check in the route)
  if (!onboarding) {
    bugs.push({ severidad: '🔴', descripcion: 'generar-plan-inicial devuelve 400 — onboarding no encontrado', detalle: 'La ruta requiere onboarding para continuar' })
    console.log('   ERROR: el endpoint devolvería 400 (sin onboarding)')
  } else {
    console.log('   Onboarding existe → endpoint no bloquea en el check básico')
  }

  // Check coach_id match
  const { data: clienteCheck } = await db
    .from('clientes')
    .select('coach_id')
    .eq('id', clienteId)
    .single()

  if (clienteCheck?.coach_id !== 'f62aea4e-69a2-4062-b517-bb6a639ee1b5') {
    bugs.push({ severidad: '🔴', descripcion: 'coach_id no coincide — el endpoint devolvería 403', detalle: `coach_id en BD: ${clienteCheck?.coach_id}` })
  } else {
    console.log('   coach_id correcto → no bloquea en check de acceso')
  }

  // ── 10. Verificar filtro intolerancias en /api/recetas/sugeridas ─────────
  console.log('\n10. Verificando lógica del endpoint /api/recetas/sugeridas con cliente_id...')
  const { data: onbForCheck } = await db
    .from('onboarding_responses')
    .select('restricciones')
    .eq('cliente_id', clienteId)
    .single()

  const intoleranciasParaFiltrar = onbForCheck?.restricciones as string[] | null
  console.log(`   restricciones en BD: ${JSON.stringify(intoleranciasParaFiltrar)}`)

  if (!intoleranciasParaFiltrar?.length) {
    bugs.push({ severidad: '🟠', descripcion: '/api/recetas/sugeridas con cliente_id=Laura no filtrará por intolerancias — el array está vacío', detalle: 'La ruta verifica .contains() pero el array vacío no filtra nada' })
  }

  // Check how the sugeridas route maps restrictions to recipe tags
  // It uses `.contains('intolerancias', [...])` → maps 'Sin Gluten' to 'Sin Gluten' tag
  // But Laura has ['Sin Gluten'] in restricciones — this should work IF the mapping exists
  const intolMap: Record<string, string> = {
    'Sin Gluten': 'Sin Gluten',
    'Sin Lactosa': 'Sin Lactosa',
    'Vegano': 'Vegano',
    'Vegetariano': 'Vegetariano',
    'Sin Huevo': 'Sin Huevo',
    'Sin Frutos Secos': 'Sin Frutos Secos',
    'Sin Mariscos': 'Sin Mariscos',
    'Sin Cerdo': 'Sin Cerdo',
    'Sin Soja': 'Sin Soja',
  }

  const mapped = intoleranciasParaFiltrar?.map((r: string) => intolMap[r]).filter(Boolean) ?? []
  if (intoleranciasParaFiltrar?.length && !mapped.length) {
    bugs.push({ severidad: '🟠', descripcion: 'Restricciones del onboarding no se mapean a tags del recetario — /api/recetas/sugeridas no filtrará correctamente' })
  } else {
    console.log(`   Mapping restricciones → tags recetario: ${JSON.stringify(mapped)}`)
    if (mapped.length) console.log('   Mapping OK')
  }

  // ── REPORT ───────────────────────────────────────────────────────────────
  console.log('\n=== BUGS ENCONTRADOS ===\n')
  if (!bugs.length) {
    console.log('Ninguno detectado en este análisis.')
  } else {
    const sorted = [
      ...bugs.filter(b => b.severidad === '🔴'),
      ...bugs.filter(b => b.severidad === '🟠'),
      ...bugs.filter(b => b.severidad === '🟡'),
    ]
    sorted.forEach((b, i) => {
      console.log(`${b.severidad} BUG-${i + 1}: ${b.descripcion}`)
      if (b.detalle) console.log(`   Detalle: ${b.detalle}`)
    })
  }

  console.log('\n=== RESUMEN CÁLCULOS ===')
  console.log(`TDEE Laura: ${tdee} kcal | Objetivo (déficit 400): ${kcalObjetivo} kcal`)
  console.log(`Macros sugeridos (Mifflin, 2g/kg proteína por objetivo perder_grasa):`)
  const proteinas = Math.round(68 * 2)   // 2g/kg para déficit
  const grasas    = Math.round(68 * 0.9) // ~0.9g/kg mínimo
  const carbos    = Math.round((kcalObjetivo - proteinas * 4 - grasas * 9) / 4)
  console.log(`  Proteínas: ${proteinas}g | Grasas: ${grasas}g | Carbos: ${carbos}g`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
