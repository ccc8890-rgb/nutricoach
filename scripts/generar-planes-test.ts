/**
 * 🚀 Genera planes IA para los 5 clientes test
 * 
 * 1. Crea Pedro si no existe
 * 2. Llama directamente a DeepSeek API para generar planes
 * 3. Guarda en registros_ia
 * 
 * Uso: npx tsx scripts/generar-planes-test.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

const COL = {
    verde: (s: string) => `\x1b[32m${s}\x1b[0m`,
    rojo: (s: string) => `\x1b[31m${s}\x1b[0m`,
    ama: (s: string) => `\x1b[33m${s}\x1b[0m`,
    azul: (s: string) => `\x1b[34m${s}\x1b[0m`,
    cielo: (s: string) => `\x1b[36m${s}\x1b[0m`,
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
const COACH_ID = process.env.NUTRICOACH_COACH_ID || 'f62aea4e-69a2-4062-b517-bb6a639ee1b5'

const ACTIVIDAD_FACTOR: Record<string, number> = {
    sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muy_activo: 1.9,
}
const OBJETIVO_AJUSTE: Record<string, number> = {
    perder_grasa: -400, ganar_musculo: 300, rendimiento: 200, mantenimiento: 0, recomposicion: -150, salud_general: 0,
}
const PROTEINA_OBJETIVO: Record<string, number> = {
    salud_general: 1.0, mantenimiento: 1.6, rendimiento: 1.8, ganar_musculo: 2.0, perder_grasa: 2.4, recomposicion: 2.0,
}

function calcularTDEE(peso: number, altura: number, edad: number, sexo: string, actividad: string): number {
    const tmb = sexo === 'mujer' ? 10 * peso + 6.25 * altura - 5 * edad - 161 : 10 * peso + 6.25 * altura - 5 * edad + 5
    return Math.round(tmb * (ACTIVIDAD_FACTOR[actividad] ?? 1.55))
}

async function crearPedro() {
    const c = {
        nombre: 'Pedro', apellidos: 'Ramírez Gómez',
        email: 'test-pedro@nutricoach-test.com', password: 'TestPass2026!',
        objetivo: 'mantenimiento', nivel: 'principiante', peso_inicial: 83, altura: 170, edad: 65,
        sexo: 'hombre' as const, restricciones: 'Bajo en sodio por hipertensión',
        notas: 'Jubilado. Quiere mantener peso activo. Hipertenso controlado con medicación.',
    }

    // 1. Buscar por email primero (puede existir de intento anterior)
    const { data: userByEmail } = await supabase.auth.admin.listUsers()
    const existingUser = userByEmail?.users?.find(u => u.email === c.email)

    let profileId: string
    if (existingUser) {
        profileId = existingUser.id
        console.log(`  ${COL.ama('⟳')} Pedro ya existe en Auth: ${profileId}`)
        // Buscar si ya tiene cliente asociado
        const { data: existingCliente } = await supabase
            .from('clientes').select('id').eq('profile_id', profileId).maybeSingle()
        if (existingCliente) {
            console.log(`  ${COL.verde('✓')} Pedro ya tiene cliente: ${existingCliente.id}`)
            // Asegurar onboarding
            await asegurarOnboardingPedro(existingCliente.id, c)
            return existingCliente.id
        }
    } else {
        // Crear Auth user
        const { data: nu, error } = await supabase.auth.admin.createUser({
            email: c.email, password: c.password,
            user_metadata: { nombre: c.nombre, apellidos: c.apellidos, role: 'cliente' },
            email_confirm: true,
        })
        if (error) throw new Error(`Error creando Auth Pedro: ${error.message}`)
        if (!nu?.user) throw new Error('No se pudo crear usuario Auth para Pedro')
        profileId = nu.user.id
        await supabase.from('profiles').update({ apellidos: c.apellidos }).eq('id', profileId)
    }

    // Crear registro cliente
    const { data: cliente } = await supabase.from('clientes').insert({
        profile_id: profileId, coach_id: COACH_ID,
        objetivo: c.objetivo, nivel: c.nivel, peso_inicial: c.peso_inicial, altura: c.altura,
        edad: c.edad, sexo: c.sexo, restricciones_alimentarias: c.restricciones, notas: c.notas,
        onboarding_completado: false, revisado_por_coach: false,
    }).select('id').single()
    if (!cliente) throw new Error('No se pudo crear cliente Pedro')

    await asegurarOnboardingPedro(cliente.id, c)
    console.log(`  ${COL.verde('✓')} Pedro creado: ${cliente.id}`)
    return cliente.id
}

async function asegurarOnboardingPedro(clienteId: string, c: any) {
    await supabase.from('onboarding_responses').upsert({
        cliente_id: clienteId, segmento: 'standard', objetivo: 'mantener',
        actividad_base: 'ligero', dias_entreno: 4, tipo_entreno: ['cardio', 'funcional'],
        duracion_sesion_min: 40, restricciones: ['Bajo en sodio'],
        alimentos_no_gustan: 'comida picante, frituras', nivel_cocina: 'intermedio',
        tiempo_cocina_min: 35, presupuesto_semanal_eur: 65,
    }, { onConflict: 'cliente_id' })

    await supabase.from('onboarding_perfil_profundo').upsert({
        cliente_id: clienteId, trigger_onboarding: 'Preocupación salud tras infarto amigo.',
        autoeficacia: 7, historial_dietas: [], razones_abandono: [],
        relacion_comida: 'flexible', todo_o_nada: 'no',
        dia_tipico: 'Desayuno: café+tostada aceite. Comida: legumbres+verdura+pescado. Merienda: fruta. Cena: sopa+ligero.',
        comidas_favoritas: 'Potaje garbanzos, merluza, gazpacho', condiciones_salud: 'HTA (Enalapril 10mg)',
        horas_sueno: 7, calidad_sueno: 4, nivel_estres: 2,
        descripcion_semana_entreno: 'Camina 30-40min diario + ejercicios movilidad 2x/sem',
    }, { onConflict: 'cliente_id' })

    await supabase.from('clientes').update({ onboarding_completado: true }).eq('id', clienteId)
}

async function generarPlan(clienteId: string, label: string) {
    // Verificar si ya tiene plan
    const { data: existing } = await supabase
        .from('registros_ia')
        .select('id')
        .eq('cliente_id', clienteId)
        .in('tipo', ['plan_inicial', 'dieta'])
        .maybeSingle()
    if (existing) { console.log(`  ${COL.ama('⟳')} ${label}: ya tiene plan`); return }

    // Fetch datos
    const { data: cliente } = await supabase.from('clientes')
        .select('*').eq('id', clienteId).single()
    if (!cliente) { console.log(`  ${COL.rojo('✗')} ${label}: cliente no encontrado`); return }

    const { data: onboarding } = await supabase.from('onboarding_responses')
        .select('*').eq('cliente_id', clienteId).single()
    if (!onboarding) { console.log(`  ${COL.rojo('✗')} ${label}: sin onboarding`); return }

    const { data: perfil } = await supabase.from('onboarding_perfil_profundo')
        .select('*').eq('cliente_id', clienteId).single()

    // Calcular TDEE y macros
    const tdee = calcularTDEE(
        cliente.peso_inicial ?? 70, cliente.altura ?? 170, cliente.edad ?? 30,
        cliente.sexo ?? 'hombre', onboarding.actividad_base)
    const kcalObjetivo = tdee + (OBJETIVO_AJUSTE[onboarding.objetivo] ?? 0)
    const gProteina = PROTEINA_OBJETIVO[onboarding.objetivo] ?? 1.8
    const proteinas = Math.round((cliente.peso_inicial ?? 70) * gProteina)
    const grasas = Math.round((kcalObjetivo * 0.28) / 9)
    const carbos = Math.round((kcalObjetivo - proteinas * 4 - grasas * 9) / 4)

    console.log(`  ${COL.azul('⟳')} ${label}: calculando plan...`)
    console.log(`    TDEE: ${tdee} → Kcal objetivo: ${kcalObjetivo}`)
    console.log(`    Macros target: P${proteinas} / C${carbos} / G${grasas}`)

    // Llamar DeepSeek
    const prompt = `Genera un plan nutricional personalizado en JSON para este cliente.
Objetivo: ${onboarding.objetivo}
TDEE (Mifflin-St Jeor): ${tdee} kcal/día
Kcal objetivo: ${kcalObjetivo} kcal/día
Macros objetivo: ${proteinas}g proteína | ${carbos}g carbohidratos | ${grasas}g grasa
Sexo: ${cliente.sexo} | Edad: ${cliente.edad} | Peso: ${cliente.peso_inicial}kg
${perfil?.condiciones_salud ? `Condiciones de salud: ${perfil.condiciones_salud}` : ''}
${cliente.restricciones_alimentarias ? `Restricciones: ${cliente.restricciones_alimentarias}` : ''}
${onboarding.restricciones?.length ? `Intolerancias: ${onboarding.restricciones.join(', ')}` : ''}
${perfil?.suplementos ? `Suplementos: ${perfil.suplementos}` : ''}
Nivel actividad: ${onboarding.actividad_base} (${onboarding.dias_entreno} días/sem)
${perfil?.dia_tipico ? `Día típico: ${perfil.dia_tipico}` : ''}
${perfil?.comidas_favoritas ? `Comidas favoritas: ${perfil.comidas_favoritas}` : ''}

Responde SOLO con este JSON (sin markdown, sin \`\`\`):
{
  "kcal_objetivo": número,
  "macros": { "proteinas_g": número, "carbos_g": número, "grasas_g": número },
  "distribucion_comidas": [
    { "nombre": string, "porcentaje_kcal": número, "kcal": número, "hora_sugerida": "HH:MM" }
  ],
  "recomendaciones": ["frase1", "frase2", "frase3"],
  "alertas_coach": ["alerta1", "alerta2"],
  "estrategia_adherencia": "string",
  "valvula_escape": "string",
  "notas_coach": "string"
}`

    let planJson: Record<string, any> = {}
    let tokensUsados = 0

    try {
        const res = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
            body: JSON.stringify({
                model: DEEPSEEK_MODEL,
                messages: [
                    { role: 'system', content: 'Eres Carlos Casanova, dietista titulado. Respondes solo con JSON válido en español.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.3,
                max_tokens: 2000,
            }),
        })
        if (res.ok) {
            const data = await res.json()
            const content = data.choices?.[0]?.message?.content ?? ''
            const match = content.match(/\{[\s\S]*\}/)
            if (match) planJson = JSON.parse(match[0])
            tokensUsados = data.usage?.total_tokens ?? 0
            console.log(`    ${COL.verde('✓')} DeepSeek OK: ${tokensUsados} tokens`)
        } else {
            const errText = await res.text()
            console.log(`    ${COL.rojo('✗')} DeepSeek error: ${res.status} ${errText.slice(0, 200)}`)
        }
    } catch (err: any) {
        console.log(`    ${COL.rojo('✗')} Error: ${err.message}`)
    }

    // Fallback si DeepSeek falla
    if (!planJson.kcal_objetivo) {
        planJson = {
            kcal_objetivo: kcalObjetivo,
            macros: { proteinas_g: proteinas, carbos_g: carbos, grasas_g: grasas },
            distribucion_comidas: [
                { nombre: 'Desayuno', porcentaje_kcal: 25, kcal: Math.round(kcalObjetivo * 0.25), hora_sugerida: '08:00' },
                { nombre: 'Comida', porcentaje_kcal: 35, kcal: Math.round(kcalObjetivo * 0.35), hora_sugerida: '13:30' },
                { nombre: 'Merienda', porcentaje_kcal: 15, kcal: Math.round(kcalObjetivo * 0.15), hora_sugerida: '17:00' },
                { nombre: 'Cena', porcentaje_kcal: 25, kcal: Math.round(kcalObjetivo * 0.25), hora_sugerida: '20:30' },
            ],
            estrategia_adherencia: 'Plan flexible con ajuste semanal.',
            valvula_escape: 'Una comida libre semanal planificada.',
            recomendaciones: ['El coach revisará y personalizará en detalle.'],
            alertas_coach: [],
            notas_coach: `Cliente nuevo. Objetivo: ${onboarding.objetivo}. TDEE: ${tdee} kcal.`,
        }
        console.log(`    ${COL.ama('⚠')} Usando fallback (sin IA)`)
    }

    // Guardar en registros_ia
    await supabase.from('registros_ia').insert({
        coach_id: COACH_ID,
        cliente_id: clienteId,
        tipo: 'dieta',
        prompt,
        respuesta_json: planJson,
        modelo: DEEPSEEK_MODEL,
        tokens_usados: tokensUsados,
    })

    // Marcar como no revisado
    await supabase.from('clientes').update({ revisado_por_coach: false }).eq('id', clienteId)

    console.log(`    ${COL.verde('✓')} Plan guardado: ${COL.cielo(`${planJson.kcal_objetivo} kcal`)}`)
    const m = planJson.macros
    console.log(`    Macros: P${m.proteinas_g} / C${m.carbos_g} / G${m.grasas_g}`)
    if (planJson.distribucion_comidas) {
        console.log(`    Comidas: ${planJson.distribucion_comidas.map((c: any) => c.nombre).join(' → ')}`)
    }
}

async function main() {
    console.log(`${COL.cielo('═══════════════════════════════════════════════')}`)
    console.log(`${COL.cielo('  🚀 GENERACIÓN DE PLANES IA - CLIENTES TEST')}`)
    console.log(`${COL.cielo('═══════════════════════════════════════════════')}\n`)

    // 1. Crear Pedro
    console.log(`${COL.azul('→')} Creando Pedro...`)
    const pedroId = await crearPedro()
    console.log('')

    // 2. Reparar onboarding de Ana (lo perdió en seed original)
    console.log(`${COL.azul('→')} Reparando onboarding de Ana...`)
    const anaId = 'ea2c3bdd-31fd-4176-bb33-89f3017596e8'
    const { data: anaOnb } = await supabase.from('onboarding_responses').select('id').eq('cliente_id', anaId).maybeSingle()
    if (!anaOnb) {
        const { error: ie } = await supabase.from('onboarding_responses').insert({
            cliente_id: anaId, segmento: 'recomposicion', objetivo: 'recomposicion',
            actividad_base: 'moderado', dias_entreno: 5, tipo_entreno: ['fuerza', 'cardio'],
            duracion_sesion_min: 50, restricciones: ['soja'],
            alimentos_no_gustan: 'comida ultraprocesada', nivel_cocina: 'avanzado',
            tiempo_cocina_min: 40, presupuesto_semanal_eur: 80,
        })
        if (ie) console.log(`  ${COL.rojo('✗')} Error Ana onboarding: ${ie.message}`)
        else console.log(`  ${COL.verde('✓')} Onboarding Ana reparado`)
        // También perfil profundo
        await supabase.from('onboarding_perfil_profundo').upsert({
            cliente_id: anaId, trigger_onboarding: 'Sofocos, cambios de peso.',
            autoeficacia: 8, historial_dietas: ['dieta_mediterranea'], razones_abandono: ['sin_energia'],
            relacion_comida: 'intuitivo', todo_o_nada: 'no',
            dia_tipico: 'Desayuno: yogur+fruta. Comida: ensalada+proteína. Merienda: frutos secos. Cena: crema verduras+pollo.',
            comidas_favoritas: 'Berenjenas gratinadas, salmón, quinoa', condiciones_salud: 'Menopausia, osteopenia',
            suplementos: 'Calcio, Vitamina D', horas_sueno: 6, calidad_sueno: 3, nivel_estres: 3,
            descripcion_semana_entreno: 'Crossfit 3x/sem + yoga 2x/sem + caminar',
        }, { onConflict: 'cliente_id' })
    } else {
        console.log(`  ${COL.verde('✓')} Ana ya tiene onboarding`)
    }
    console.log('')

    // 3. IDs de los 5 clientes
    const clientes: Array<{ id: string; nombre: string }> = [
        { id: 'd324e4dc-bbfe-4266-9153-25a683e77f97', nombre: 'Carlos (35, diabetes, perder grasa)' },
        { id: '94259e48-0581-4ccb-ab31-4768090c08fb', nombre: 'María (28, vegana, ganar músculo)' },
        { id: anaId, nombre: 'Ana (52, menopausia, recomposición)' },
        { id: 'd1564f22-9980-4a21-978b-b06881ceda0d', nombre: 'Javier (42, maratón, rendimiento)' },
    ]
    if (pedroId) clientes.push({ id: pedroId, nombre: 'Pedro (65, hipertenso, mantener)' })

    // 3. Generar planes
    for (let i = 0; i < clientes.length; i++) {
        const c = clientes[i]
        console.log(`${COL.azul(`[${i + 1}/${clientes.length}]`)} ${COL.ama(c.nombre)}`)
        await generarPlan(c.id, c.nombre)
        console.log('')
    }

    // 4. Resumen
    console.log(`${COL.cielo('═══════════════════════════════════════════════')}`)
    console.log(`${COL.verde('  ✅ GENERACIÓN COMPLETADA')}`)
    console.log(`${COL.cielo('═══════════════════════════════════════════════')}`)
    console.log(`\n  ${COL.azul('Para ver los resultados accede a:')}`)
    console.log(`  • https://nutricoach-delta.vercel.app/clientes`)
    console.log(`\n  ${COL.ama('Emails: test-XXXXX@nutricoach-test.com / TestPass2026!')}`)

    // Mostrar kcal de cada uno
    console.log(`\n  ${COL.cielo('Planes generados:')}`)
    for (const c of clientes) {
        const { data } = await supabase.from('registros_ia')
            .select('respuesta_json')
            .eq('cliente_id', c.id)
            .in('tipo', ['plan_inicial', 'dieta'])
            .maybeSingle()
        const kcal = (data?.respuesta_json as any)?.kcal_objetivo ?? '?'
        console.log(`  • ${c.nombre.split('(')[0].trim()}: ${COL.cielo(`${kcal} kcal`)}`)
    }
    console.log('')
}

main().catch(console.error)
