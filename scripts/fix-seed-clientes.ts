/**
 * 🛠️ Fix: Completa clientes pendientes y dispara generación de planes IA
 * 
 * 1. Crea el cliente 5 (Pedro) que faltó
 * 2. Repara onboarding/perfil de Ana si está incompleto
 * 3. Dispara generación de plan IA para todos vía producción
 * 
 * Uso:
 *   npx tsx scripts/fix-seed-clientes.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL = 'https://nutricoach-delta.vercel.app'
const COACH_ID = process.env.NUTRICOACH_COACH_ID || 'f62aea4e-69a2-4062-b517-bb6a639ee1b5'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
})

const colores = {
    verde: (s: string) => `\x1b[32m${s}\x1b[0m`,
    rojo: (s: string) => `\x1b[31m${s}\x1b[0m`,
    amarillo: (s: string) => `\x1b[33m${s}\x1b[0m`,
    azul: (s: string) => `\x1b[34m${s}\x1b[0m`,
    cielo: (s: string) => `\x1b[36m${s}\x1b[0m`,
}

// ═══════════════════════════════════════════════════════
// PEDRO — el cliente que faltó
// ═══════════════════════════════════════════════════════

const PEDRO = {
    nombre: 'Pedro',
    apellidos: 'Ramírez Gómez',
    email: 'test-pedro@nutricoach-test.com',
    password: 'TestPass2026!',
    objetivo: 'mantener',
    nivel: 'principiante',
    peso_inicial: 83,
    altura: 170,
    edad: 65,
    sexo: 'hombre' as const,
    restricciones_alimentarias: 'Bajo en sodio por hipertensión',
    notas: 'Jubilado. Quiere mantener peso activo. Hipertenso controlado con medicación. Motivación: salud cardiovascular.',
    segmento: 'standard',
    actividad_base: 'ligero',
    dias_entreno: 4,
    tipo_entreno: ['cardio', 'funcional'],
    duracion_sesion_min: 40,
    alimentos_no_gustan: 'comida muy picante, frituras',
    nivel_cocina: 'intermedio',
    tiempo_cocina_min: 35,
    presupuesto_semanal_eur: 65,
    perfil: {
        trigger_onboarding: 'Preocupación por salud tras infarto leve de amigo. Quiere mejorar alimentación.',
        autoeficacia: 7,
        historial_dietas: [] as string[],
        razones_abandono: [] as string[],
        relacion_comida: 'flexible',
        todo_o_nada: 'no',
        dia_tipico: 'Desayuno: café con leche + pan tostado con aceite. Comida: legumbres con verdura y pescado. Merienda: fruta. Cena: sopa o crema + algo ligero.',
        comidas_favoritas: 'Potaje de garbanzos, merluza a la plancha, gazpacho',
        alimentos_evitar_extra: 'embutidos, salados',
        alcohol_semanal: '1',
        suplementos: 'Ninguno',
        hora_primera_ingesta: '08:00',
        hora_comida_principal: '14:30',
        hora_ultima_ingesta: '20:30',
        hora_entreno: '10:00',
        con_quien_come: ['mujer'],
        frecuencia_fuera: 1,
        comida_trampa: 'Un vino + tapas los sábados',
        condiciones_salud: 'Hipertensión arterial (Enalapril 10mg/día), colesterol total 210 (LDL 140, HDL 48), artrosis lumbar leve.',
        horas_sueno: 7,
        calidad_sueno: 4,
        nivel_estres: 2,
        descripcion_semana_entreno: 'Camina 30-40min diario. 2x/semana ejercicios movilidad en casa.',
        fecha_competicion: null,
        tipo_competicion: null,
        nutricion_peri_entreno: 'Agua antes y después. A veces plátano antes de caminar.',
    },
}

// ═══════════════════════════════════════════════════════
// CLIENTE IDs de los ya creados
// ═══════════════════════════════════════════════════════

const CLIENTES_EXISTENTES: Array<{ id: string; nombre: string; perfil_ok: boolean; onboarding_ok: boolean }> = []

async function diagnosticar() {
    console.log(colores.cielo('\n═══════════════════════════════════════════════'))
    console.log(colores.cielo('  🛠️ DIAGNÓSTICO — Clientes seed'))
    console.log(colores.cielo('═══════════════════════════════════════════════\n'))

    const { data: clientes } = await supabase
        .from('clientes')
        .select('id, objetivo, peso_inicial, edad, sexo, onboarding_completado, notas')
        .in('edad', [35, 28, 52, 42, 65])
        .order('created_at', { ascending: true })

    if (!clientes || clientes.length === 0) {
        console.log(colores.rojo('  No se encontraron clientes test. Ejecuta primero seed-clientes-test.ts\n'))
        return
    }

    console.log(`  Clientes encontrados en Supabase: ${clientes.length}`)

    const MAPA_NOMBRES: Record<string, string> = {
        'perder_grasa': 'Carlos (35, diabetes)',
        'ganar_musculo': 'María (28, vegana)',
        'recomposicion': 'Ana (52, menopausia)',
        'rendimiento': 'Javier (42, maratón)',
    }

    for (const c of clientes) {
        const nombre = MAPA_NOMBRES[c.objetivo || ''] || c.objetivo || 'sin objetivo'
        // Verificar onboarding
        const { data: onboarding } = await supabase
            .from('onboarding_responses')
            .select('id')
            .eq('cliente_id', c.id)
            .single()

        // Verificar perfil profundo
        const { data: perfil } = await supabase
            .from('onboarding_perfil_profundo')
            .select('id')
            .eq('cliente_id', c.id)
            .single()

        // Verificar registros IA
        const { data: registroIa } = await supabase
            .from('registros_ia')
            .select('id, tokens_usados')
            .eq('cliente_id', c.id)
            .maybeSingle()

        const ok = colores.verde('✓')
        const fail = colores.rojo('✗')
        console.log(`\n  [${c.objetivo || '?'}] ${colores.amarillo(nombre)}`)
        console.log(`    ID: ${c.id}`)
        console.log(`    Onboarding DB:  ${onboarding ? ok : fail}`)
        console.log(`    Perfil prof.:   ${perfil ? ok : fail}`)
        console.log(`    Completo flag:  ${c.onboarding_completado ? ok : fail}`)
        console.log(`    Plan IA:        ${registroIa ? `${ok} (${registroIa.tokens_usados} tokens)` : fail}`)

        CLIENTES_EXISTENTES.push({
            id: c.id,
            nombre,
            perfil_ok: !!perfil,
            onboarding_ok: !!onboarding,
        })
    }

    // Verificar si Pedro ya existe
    const { data: pedroCliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('edad', 65)
        .maybeSingle()

    if (!pedroCliente) {
        console.log(`\n  ${colores.rojo('✗')} Pedro (65, hipertenso) ${colores.rojo('NO CREADO')}`)
    } else {
        console.log(`\n  ${colores.verde('✓')} Pedro (65, hipertenso) ${colores.verde('YA EXISTE')} — ${pedroCliente.id}`)
    }

    return CLIENTES_EXISTENTES
}

async function crearPedro(): Promise<string | null> {
    console.log(colores.cielo('\n═══════════════════════════════════════════════'))
    console.log(colores.cielo('  👤 CREANDO PEDRO (65, hipertenso)'))
    console.log(colores.cielo('═══════════════════════════════════════════════\n'))

    const c = PEDRO

    // 1. Auth user
    const { data: newUser, error: authErr } = await supabase.auth.admin.createUser({
        email: c.email,
        password: c.password,
        user_metadata: { nombre: c.nombre, apellidos: c.apellidos, role: 'cliente' },
        email_confirm: true,
    })
    if (authErr) {
        if (authErr.message.includes('already exists')) {
            const { data: users } = await supabase.auth.admin.listUsers()
            const found = users?.users.find(u => u.email === c.email)
            if (found) {
                console.log(`  ${colores.verde('✓')} Usuario ya existe: ${found.id}`)
                return await completarPedro(found.id)
            }
        }
        console.error(`  ${colores.rojo('✗')} Error Auth: ${authErr.message}`)
        return null
    }
    console.log(`  ${colores.verde('✓')} Usuario Auth: ${newUser.user.id}`)
    return await completarPedro(newUser.user.id)
}

async function completarPedro(profileId: string): Promise<string | null> {
    const c = PEDRO

    // Actualizar profile
    await supabase.from('profiles').update({ apellidos: c.apellidos }).eq('id', profileId)

    // Cliente DB
    const { data: cliente, error: cliErr } = await supabase
        .from('clientes')
        .insert({
            profile_id: profileId,
            coach_id: COACH_ID,
            objetivo: c.objetivo,
            nivel: c.nivel,
            peso_inicial: c.peso_inicial,
            altura: c.altura,
            edad: c.edad,
            sexo: c.sexo,
            restricciones_alimentarias: c.restricciones_alimentarias,
            notas: c.notas,
            onboarding_completado: false,
            revisado_por_coach: false,
        })
        .select('id')
        .single()
    if (cliErr) { console.error(`  ${colores.rojo('✗')} Error cliente: ${cliErr.message}`); return null }
    console.log(`  ${colores.verde('✓')} Cliente DB: ${cliente.id}`)

    // Onboarding básico
    const { error: onbErr } = await supabase
        .from('onboarding_responses')
        .upsert({
            cliente_id: cliente.id,
            segmento: c.segmento,
            objetivo: c.objetivo,
            actividad_base: c.actividad_base,
            dias_entreno: c.dias_entreno,
            tipo_entreno: c.tipo_entreno,
            duracion_sesion_min: c.duracion_sesion_min,
            restricciones: [c.restricciones_alimentarias],
            alimentos_no_gustan: c.alimentos_no_gustan,
            nivel_cocina: c.nivel_cocina,
            tiempo_cocina_min: c.tiempo_cocina_min,
            presupuesto_semanal_eur: c.presupuesto_semanal_eur,
        }, { onConflict: 'cliente_id' })
    if (onbErr) { console.error(`  ${colores.rojo('✗')} Error onboarding: ${onbErr.message}`) }
    else console.log(`  ${colores.verde('✓')} Onboarding básico`)

    // Perfil profundo
    const pf = c.perfil
    const { error: perErr } = await supabase
        .from('onboarding_perfil_profundo')
        .upsert({
            cliente_id: cliente.id,
            trigger_onboarding: pf.trigger_onboarding,
            autoeficacia: pf.autoeficacia,
            historial_dietas: pf.historial_dietas,
            razones_abandono: pf.razones_abandono,
            relacion_comida: pf.relacion_comida,
            todo_o_nada: pf.todo_o_nada,
            dia_tipico: pf.dia_tipico,
            comidas_favoritas: pf.comidas_favoritas,
            alimentos_evitar_extra: pf.alimentos_evitar_extra,
            alcohol_semanal: pf.alcohol_semanal,
            suplementos: pf.suplementos,
            hora_primera_ingesta: pf.hora_primera_ingesta,
            hora_comida_principal: pf.hora_comida_principal,
            hora_ultima_ingesta: pf.hora_ultima_ingesta,
            hora_entreno: pf.hora_entreno,
            patrones_energia: ['media_manana'],
            con_quien_come: pf.con_quien_come,
            frecuencia_fuera: pf.frecuencia_fuera,
            comida_trampa: pf.comida_trampa,
            condiciones_salud: pf.condiciones_salud,
            horas_sueno: pf.horas_sueno,
            calidad_sueno: pf.calidad_sueno,
            nivel_estres: pf.nivel_estres,
            descripcion_semana_entreno: pf.descripcion_semana_entreno,
            fecha_competicion: pf.fecha_competicion,
            tipo_competicion: pf.tipo_competicion,
            nutricion_peri_entreno: pf.nutricion_peri_entreno,
        }, { onConflict: 'cliente_id' })
    if (perErr) { console.error(`  ${colores.rojo('✗')} Error perfil: ${perErr.message}`) }
    else console.log(`  ${colores.verde('✓')} Perfil profundo`)

    // Marcar onboarding completado y no revisado
    await supabase.from('clientes').update({
        onboarding_completado: true,
        revisado_por_coach: false,
    }).eq('id', cliente.id)

    console.log(`  ${colores.verde('✓')} Onboarding marcado como completado`)
    return cliente.id
}

async function repararAna() {
    const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('objetivo', 'recomposicion')
        .eq('edad', 52)

    if (!clientes || clientes.length === 0) {
        console.log(`  ${colores.rojo('✗')} No se encontró a Ana`)
        return null
    }

    const anaId = clientes[0].id
    console.log(`\n  Ana ID: ${anaId}`)

    // Verificar qué falta
    const { data: onboarding } = await supabase
        .from('onboarding_responses')
        .select('id')
        .eq('cliente_id', anaId)
        .single()

    const { data: perfil } = await supabase
        .from('onboarding_perfil_profundo')
        .select('id')
        .eq('cliente_id', anaId)
        .single()

    if (!onboarding) {
        console.log(`  ${colores.amarillo('⟳')} Insertando onboarding básico para Ana...`)
        const { error: e } = await supabase.from('onboarding_responses').upsert({
            cliente_id: anaId,
            segmento: 'recomposicion',
            objetivo: 'recomposicion',
            actividad_base: 'moderado',
            dias_entreno: 4,
            tipo_entreno: ['gym', 'running', 'yoga'],
            duracion_sesion_min: 50,
            restricciones: ['ninguna'],
            alimentos_no_gustan: 'pescado azul, vísceras',
            nivel_cocina: 'avanzado',
            tiempo_cocina_min: 40,
            presupuesto_semanal_eur: 80,
        }, { onConflict: 'cliente_id' })
        if (e) console.error(`  ${colores.rojo('✗')} Error: ${e.message}`)
        else console.log(`  ${colores.verde('✓')} Onboarding insertado`)
    }

    if (!perfil) {
        console.log(`  ${colores.amarillo('⟳')} Insertando perfil profundo para Ana...`)
        const { error: e } = await supabase.from('onboarding_perfil_profundo').upsert({
            cliente_id: anaId,
            trigger_onboarding: 'Cambios corporales desde hace 2 años. Aumento grasa abdominal y pérdida masa muscular.',
            autoeficacia: 6,
            historial_dietas: ['Paleo 2022 (6 meses)', 'Ayuno intermitente 2023 (4 meses)'],
            razones_abandono: ['Efecto rebote', 'Ansiedad con restricciones'],
            relacion_comida: 'conflicto',
            todo_o_nada: 'si',
            dia_tipico: 'Café + tostada integral con aguacate. Comida: ensalada grande con proteína. Merienda: fruta + yogur. Cena: crema verduras + pescado.',
            comidas_favoritas: 'Ensalada César, salmón, chocolate 85%',
            alimentos_evitar_extra: '',
            alcohol_semanal: '2',
            suplementos: 'Vitamina D 2000 UI, Magnesio 200mg, Colágeno 10g',
            hora_primera_ingesta: '08:30',
            hora_comida_principal: '14:00',
            hora_ultima_ingesta: '20:30',
            hora_entreno: '09:30',
            patrones_energia: ['media_manana', 'tarde_temprano'],
            con_quien_come: ['familia (hijos adolescentes)'],
            frecuencia_fuera: 1,
            comida_trampa: 'Cena con amigas viernes + chocolate artesano',
            condiciones_salud: 'Perimenopausia (sofocos, alteraciones sueño). Osteopenia lumbar (-1.8). TSH 2.8.',
            horas_sueno: 6,
            calidad_sueno: 3,
            nivel_estres: 3,
            descripcion_semana_entreno: 'L: gym sentadillas+banca. M: 5-7km running. X: peso muerto+remo. J: yoga. S: 10km o hiking.',
            fecha_competicion: null,
            tipo_competicion: null,
            nutricion_peri_entreno: 'Café pre-entreno. Batido proteico post gym.',
        }, { onConflict: 'cliente_id' })
        if (e) console.error(`  ${colores.rojo('✗')} Error: ${e.message}`)
        else console.log(`  ${colores.verde('✓')} Perfil profundo insertado`)
    }

    // Marcar completado
    await supabase.from('clientes').update({
        onboarding_completado: true,
        revisado_por_coach: false,
    }).eq('id', anaId)

    return anaId
}

async function generarPlanesIA(clienteIds: string[]) {
    console.log(colores.cielo('\n═══════════════════════════════════════════════'))
    console.log(colores.cielo('  🤖 GENERANDO PLANES IA (vía producción)'))
    console.log(colores.cielo('═══════════════════════════════════════════════\n'))

    const MAPA_NOMBRES: Record<string, string> = {
        'd324e4dc-bbfe-4266-9153-25a683e77f97': 'Carlos (diabetes)',
        '94259e48-0581-4ccb-ab31-4768090c08fb': 'María (vegana)',
        'ea2c3bdd-31fd-4176-bb33-89f3017596e8': 'Ana (menopausia)',
        'd1564f22-9980-4a21-978b-b06881ceda0d': 'Javier (maratón)',
    }

    // Verificar qué clientes ya tienen plan generado
    for (const id of clienteIds) {
        const { data: existing } = await supabase
            .from('registros_ia')
            .select('id, tokens_usados, created_at')
            .eq('cliente_id', id)
            .in('tipo', ['plan_inicial', 'dieta'])
            .maybeSingle()

        const nombre = MAPA_NOMBRES[id] || id.slice(0, 8)

        if (existing) {
            console.log(`  ${colores.verde('✓')} ${nombre}: ya tiene plan (${existing.tokens_usados} tokens, ${existing.created_at})`)
            continue
        }

        console.log(`  ${colores.amarillo('⟳')} ${nombre}: generando plan...`)
        try {
            const res = await fetch(`${APP_URL}/api/generar-plan-inicial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cliente_id: id }),
            })
            const data = await res.json()
            if (res.ok) {
                console.log(`    ${colores.verde('✓')} Plan: ${colores.cielo(`${data.plan?.kcal_objetivo ?? '?'} kcal`)}`)
                if (data.plan?.macros) {
                    const m = data.plan.macros
                    console.log(`    Macros: ${m.proteinas_g || m.proteinas}P / ${m.carbos_g || m.carbohidratos}C / ${m.grasas_g || m.grasas}G`)
                }
            } else {
                console.log(`    ${colores.rojo('✗')} Error: ${data.error || 'desconocido'}`)
            }
        } catch (err: any) {
            console.log(`    ${colores.rojo('✗')} Error conexión: ${err.message}`)
        }
    }
}

async function main() {
    // 1. Diagnosticar estado actual
    await diagnosticar()

    // 2. Crear Pedro
    const pedroId = await crearPedro()

    // 3. Reparar Ana si es necesario
    const anaId = await repararAna()

    // 4. Re-unir todos los IDs
    const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .in('edad', [35, 28, 52, 42, 65])
        .order('created_at', { ascending: true })

    if (clientes) {
        const todosIds = clientes.map(c => c.id)
        console.log(`\n${colores.cielo('═══════════════════════════════════════════════')}`)
        console.log(`${colores.verde(`  Total clientes test: ${todosIds.length}/5`)}`)
        console.log(`${colores.cielo('═══════════════════════════════════════════════')}`)

        // 5. Generar planes IA
        await generarPlanesIA(todosIds)
    }

    // Resumen final
    console.log(colores.cielo('\n═══════════════════════════════════════════════'))
    console.log(colores.cielo('  ✅ RESUMEN FINAL'))
    console.log(colores.cielo('═══════════════════════════════════════════════'))
    console.log(`
  ${colores.verde('1. Carlos (35, diabetes T2, perder grasa)')}
     → /clientes/d324e4dc-bbfe-4266-9153-25a683e77f97
  ${colores.verde('2. María (28, vegana, ganar músculo)')}
     → /clientes/94259e48-0581-4ccb-ab31-4768090c08fb
  ${colores.verde('3. Ana (52, menopausia, recomposición)')}
     → /clientes/ea2c3bdd-31fd-4176-bb33-89f3017596e8
  ${colores.verde('4. Javier (42, maratón, rendimiento)')}
     → /clientes/d1564f22-9980-4a21-978b-b06881ceda0d
  ${colores.verde('5. Pedro (65, hipertenso, mantenimiento)')}
     → /clientes/${pedroId || '??'}

  Email: test-XXXXX@nutricoach-test.com
  Pass:  TestPass2026!

  ${colores.amarillo('⚠️  Los planes IA se generan vía ' + APP_URL + '/api/generar-plan-inicial')}
  ${colores.amarillo('⚠️  Entra en /clientes para ver los resultados')}
  `)
}

main().catch(console.error)
