/**
 * 🌱 Seed de 5 clientes de prueba con perfiles diversos
 * 
 * Crea clientes con Auth Supabase + datos de onboarding + perfil profundo
 * y dispara generación de plan IA para verificar el flujo completo.
 * 
 * Uso:
 *   npx tsx scripts/seed-clientes-test.ts
 * 
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Cargar .env.local
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const COACH_ID = process.env.NUTRICOACH_COACH_ID || 'f62aea4e-69a2-4062-b517-bb6a639ee1b5'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
})

// ════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE LOS 5 CLIENTES TEST
// ════════════════════════════════════════════════════════════════

interface ClienteTest {
    id: string // email-based identifier
    nombre: string
    apellidos: string
    email: string
    password: string
    // Cliente record
    objetivo: string
    nivel: string
    peso_inicial: number
    altura: number
    edad: number
    sexo: 'hombre' | 'mujer'
    restricciones_alimentarias: string
    notas: string
    // Onboarding responses
    segmento: string
    actividad_base: string
    dias_entreno: number
    tipo_entreno: string[]
    duracion_sesion_min: number
    alimentos_no_gustan: string
    nivel_cocina: string
    tiempo_cocina_min: number
    presupuesto_semanal_eur: number
    // Perfil profundo
    perfil: {
        trigger_onboarding: string
        autoeficacia: number
        historial_dietas: string[]
        razones_abandono: string[]
        relacion_comida: string
        todo_o_nada: string
        dia_tipico: string
        comidas_favoritas: string
        alimentos_evitar_extra: string
        alcohol_semanal: string
        suplementos: string
        hora_primera_ingesta: string
        hora_comida_principal: string
        hora_ultima_ingesta: string
        hora_entreno: string
        con_quien_come: string[]
        frecuencia_fuera: number
        comida_trampa: string
        condiciones_salud: string
        horas_sueno: number
        calidad_sueno: number
        nivel_estres: number
        descripcion_semana_entreno: string
        fecha_competicion: string | null
        tipo_competicion: string | null
        nutricion_peri_entreno: string
    }
}

const CLIENTES_TEST: ClienteTest[] = [
    // ──────────────────────────────────────────────────────────────
    // 1. CARLOS — Hombre 35y, perder_grasa, diabetes tipo 2
    // ──────────────────────────────────────────────────────────────
    {
        id: 'carlos-diabetes',
        nombre: 'Carlos',
        apellidos: 'García López',
        email: 'test-carlos@nutricoach-test.com',
        password: 'TestPass2026!',
        objetivo: 'perder_grasa',
        nivel: 'principiante',
        peso_inicial: 92,
        altura: 178,
        edad: 35,
        sexo: 'hombre',
        restricciones_alimentarias: 'Diabetes tipo 2 diagnosticada hace 2 años',
        notas: 'Cliente con diabetes tipo 2. Toma metformina. Quiere perder 15kg. Motivación: salud y verse mejor.',
        segmento: 'standard',
        actividad_base: 'sedentario',
        dias_entreno: 3,
        tipo_entreno: ['gym', 'cardio'],
        duracion_sesion_min: 45,
        alimentos_no_gustan: 'coliflor, berenjena',
        nivel_cocina: 'basico',
        tiempo_cocina_min: 20,
        presupuesto_semanal_eur: 60,
        perfil: {
            trigger_onboarding: 'Diagnóstico de prediabetes → diabetes tipo 2. Preocupación por salud a largo plazo.',
            autoeficacia: 5,
            historial_dietas: ['Dieta mediterránea 2023 (3 meses)', 'Dieta keto 2024 (1 mes, abandonó)'],
            razones_abandono: ['Resultados lentos', 'Ansiedad por restricción'],
            relacion_comida: 'ansiedad',
            todo_o_nada: 'si',
            dia_tipico: 'Desayuno: café con leche + tostada. Comida: menú del día en restaurante cerca del trabajo. Cena: bocadillo o pizza. Pica entre horas snacks procesados.',
            comidas_favoritas: 'Arroz con pollo, lentejas, tortilla de patatas, pizza casera',
            alimentos_evitar_extra: 'ninguno',
            alcohol_semanal: '3',
            suplementos: 'Ninguno',
            hora_primera_ingesta: '08:00',
            hora_comida_principal: '14:00',
            hora_ultima_ingesta: '21:30',
            hora_entreno: '19:00',
            con_quien_come: ['familia'],
            frecuencia_fuera: 5,
            comida_trampa: 'Pizza o hamburguesa los sábados',
            condiciones_salud: 'Diabetes tipo 2 (metformina 850mg/12h), colesterol LDL elevado (160 mg/dL), tensión arterial 135/85',
            horas_sueno: 6.5,
            calidad_sueno: 3,
            nivel_estres: 4,
            descripcion_semana_entreno: 'Camina 15min al trabajo (vuelta). Sin entrenamiento estructurado actualmente.',
            fecha_competicion: null,
            tipo_competicion: null,
            nutricion_peri_entreno: 'No aplica',
        },
    },

    // ──────────────────────────────────────────────────────────────
    // 2. MARÍA — Mujer 28y, ganar_musculo, vegana
    // ──────────────────────────────────────────────────────────────
    {
        id: 'maria-vegana',
        nombre: 'María',
        apellidos: 'Fernández Ruiz',
        email: 'test-maria@nutricoach-test.com',
        password: 'TestPass2026!',
        objetivo: 'ganar_musculo',
        nivel: 'intermedio',
        peso_inicial: 58,
        altura: 165,
        edad: 28,
        sexo: 'mujer',
        restricciones_alimentarias: 'Vegana estricta (5 años)',
        notas: 'Cliente vegana que quiere ganar masa muscular. Entrena 4-5x/semana. Dificultad para alcanzar proteína diaria.',
        segmento: 'standard',
        actividad_base: 'activo',
        dias_entreno: 5,
        tipo_entreno: ['gym', 'funcional'],
        duracion_sesion_min: 60,
        alimentos_no_gustan: 'champiñones, aceitunas',
        nivel_cocina: 'intermedio',
        tiempo_cocina_min: 45,
        presupuesto_semanal_eur: 55,
        perfil: {
            trigger_onboarding: 'Quiere ganar masa muscular pero nota que no progresa. Sospecha que no come suficiente proteína.',
            autoeficacia: 7,
            historial_dietas: ['Cambio a vegana (5 años)', 'Ha intentado bulk sin éxito'],
            razones_abandono: ['Falta de resultados visibles'],
            relacion_comida: 'flexible',
            todo_o_nada: 'no',
            dia_tipico: 'Desayuno: batido de proteína vegetal + avena + plátano. Comida: bowl de quinoa con garbanzos y verduras. Merienda: hummus con crudités. Cena: tofu salteado con arroz integral. Post-entreno: batido proteico.',
            comidas_favoritas: 'Curry de garbanzos, lentejas rojas, tempeh a la plancha, smoothie bowls',
            alimentos_evitar_extra: 'Ninguno en particular. Todo vegetal.',
            alcohol_semanal: '1',
            suplementos: 'Proteína de guisante, B12 1000mcg/semana, Vitamina D 2000 UI/día',
            hora_primera_ingesta: '07:30',
            hora_comida_principal: '13:30',
            hora_ultima_ingesta: '21:00',
            hora_entreno: '12:00',
            con_quien_come: ['pareja'],
            frecuencia_fuera: 2,
            comida_trampa: 'Hamburguesa vegana con patatas fritas los domingos',
            condiciones_salud: 'Ninguna. Analítica reciente OK. Hierro en límite bajo (ferritina 25 ng/mL).',
            horas_sueno: 7.5,
            calidad_sueno: 4,
            nivel_estres: 2,
            descripcion_semana_entreno: 'Push/pull/legs split 5 días. Entrena en box de CrossFit. 1 sesión de yoga/semana.',
            fecha_competicion: null,
            tipo_competicion: null,
            nutricion_peri_entreno: 'Batido proteico post-entreno. No toma nada pre-entreno.',
        },
    },

    // ──────────────────────────────────────────────────────────────
    // 3. ANA — Mujer 52y, recomposicion, menopausia
    // ──────────────────────────────────────────────────────────────
    {
        id: 'ana-menopausia',
        nombre: 'Ana',
        apellidos: 'Martínez Torres',
        email: 'test-ana@nutricoach-test.com',
        password: 'TestPass2026!',
        objetivo: 'recomposicion',
        nivel: 'intermedio',
        peso_inicial: 72,
        altura: 162,
        edad: 52,
        sexo: 'mujer',
        restricciones_alimentarias: 'ninguna',
        notas: 'Cliente en perimenopausia avanzada. Quiere redefinir cuerpo. Teme ganar peso con la menopausia. Entrena fuerza 3x/semana.',
        segmento: 'recomposicion',
        actividad_base: 'moderado',
        dias_entreno: 4,
        tipo_entreno: ['gym', 'running', 'yoga'],
        duracion_sesion_min: 50,
        alimentos_no_gustan: 'pescado azul, vísceras',
        nivel_cocina: 'avanzado',
        tiempo_cocina_min: 40,
        presupuesto_semanal_eur: 80,
        perfil: {
            trigger_onboarding: 'Nota cambios corporales desde hace 2 años. Aumento de grasa abdominal y pérdida de masa muscular. Quiere sentirse fuerte y saludable.',
            autoeficacia: 6,
            historial_dietas: ['Dieta paleo 2022 (6 meses, buenos resultados)', 'Ayuno intermitente 16/8 2023 (4 meses, lo dejó por ansiedad)'],
            razones_abandono: ['Efecto rebote', 'Ansiedad con restricciones'],
            relacion_comida: 'conflicto',
            todo_o_nada: 'si',
            dia_tipico: 'Desayuno: café solo + tostada integral con aguacate y huevo. Comida: ensalada grande con proteína (pollo/atún). Merienda: fruta + yogur. Cena: crema de verduras + pescado/pollo. Pica chocolate negro por la tarde.',
            comidas_favoritas: 'Ensalada César casera, salmón al horno, revuelto de setas, chocolate negro 85%',
            alimentos_evitar_extra: 'Ninguno',
            alcohol_semanal: '2',
            suplementos: 'Vitamina D 2000 UI/día, Magnesio bisglicinato 200mg/noche, Colágeno hidrolizado 10g/día',
            hora_primera_ingesta: '08:30',
            hora_comida_principal: '14:00',
            hora_ultima_ingesta: '20:30',
            hora_entreno: '09:30',
            con_quien_come: ['familia (hijos adolescentes)'],
            frecuencia_fuera: 1,
            comida_trampa: 'Cena con amigas los viernes (vino + tapa) o chocolate artesano',
            condiciones_salud: 'Perimenopausia (sofocos, alteraciones sueño). Sin medicación hormonal. Osteopenia lumbar incipiente (DMO -1.8). TSH en rango (2.8).',
            horas_sueno: 6,
            calidad_sueno: 3,
            nivel_estres: 3,
            descripcion_semana_entreno: 'L: sentadillas + press banca (gym). M: carrera 5-7km. X: peso muerto + remo (gym). J: yoga restaurativo. S: carrera 10km o hiking.',
            fecha_competicion: null,
            tipo_competicion: null,
            nutricion_peri_entreno: 'Café solo antes de entrenar. Agua durante. Batido proteico post-entreno los días de gym.',
        },
    },

    // ──────────────────────────────────────────────────────────────
    // 4. JAVIER — Hombre 42y, rendimiento, maratonista
    // ──────────────────────────────────────────────────────────────
    {
        id: 'javier-maraton',
        nombre: 'Javier',
        apellidos: 'Sánchez Pérez',
        email: 'test-javier@nutricoach-test.com',
        password: 'TestPass2026!',
        objetivo: 'rendimiento',
        nivel: 'avanzado',
        peso_inicial: 75,
        altura: 180,
        edad: 42,
        sexo: 'hombre',
        restricciones_alimentarias: 'Intolerancia a lactosa (leche, nata)',
        notas: 'Corredor popular. Prepara maratón de Valencia (diciembre 2026). Tiene experiencia en running pero descuida nutrición. Último maratón 3:52.',
        segmento: 'performance',
        actividad_base: 'muy_activo',
        dias_entreno: 6,
        tipo_entreno: ['running', 'gym', 'ciclismo'],
        duracion_sesion_min: 75,
        alimentos_no_gustan: 'legumbres (digestión pesada), huevos cocidos',
        nivel_cocina: 'basico',
        tiempo_cocina_min: 15,
        presupuesto_semanal_eur: 70,
        perfil: {
            trigger_onboarding: 'Último maratón 3:52, quiere romper 3:30. Sabe que su nutrición es su punto débil. Nunca ha seguido un plan nutricional estructurado.',
            autoeficacia: 8,
            historial_dietas: ['Ninguna estructurada. "Come de todo"'],
            razones_abandono: [],
            relacion_comida: 'flexible',
            todo_o_nada: 'no',
            dia_tipico: 'Desayuno: café con leche sin lactosa + tostada con mermelada. Media mañana: barrita. Comida: pasta/arroz con pollo o atún. Merienda: plátano + frutos secos. Cena: tortilla francesa + ensalada. Entreno: geles durante tirada larga.',
            comidas_favoritas: 'Pasta carbonara (sin nata), sushi, poke bowl, tortilla de patatas',
            alimentos_evitar_extra: 'lácteos con lactosa',
            alcohol_semanal: '2',
            suplementos: 'Geles en carrera (Isostar), electrolitos en polvo, cafeína solo antes de competición',
            hora_primera_ingesta: '06:30',
            hora_comida_principal: '13:00',
            hora_ultima_ingesta: '21:00',
            hora_entreno: '06:30 (semana) / 08:00 (finde tirada larga)',
            con_quien_come: ['pareja', 'compañeros trabajo'],
            frecuencia_fuera: 4,
            comida_trampa: 'Cerveza + ración de patatas bravas los sábados al mediodía',
            condiciones_salud: 'Intolerancia a lactosa. Tendinitis aquílea derecha recurrente (controlada con excéntricos). Sin medicación.',
            horas_sueno: 7,
            calidad_sueno: 4,
            nivel_estres: 2,
            descripcion_semana_entreno: 'L: descanso o natación suave. M: 10-12km ritmo suave. X: series en pista (400-1000m). J: 8-10km suave. V: gym (fuerza core + piernas). S: tirada larga progresiva (18-30km). D: rodaje regenerativo 6-8km.',
            fecha_competicion: '2026-12-06',
            tipo_competicion: 'Maratón (Valencia)',
            nutricion_peri_entreno: 'Pre-tirada larga: tostada + plátano 2h antes. Durante: 1 gel cada 40min + agua. Post: recuperación con leche sin lactosa + plátano. No usa electrolitos en tiradas <2h.',
        },
    },

    // ──────────────────────────────────────────────────────────────
    // 5. PEDRO — Hombre 65y, mantenimiento, hipertenso
    // ──────────────────────────────────────────────────────────────
    {
        id: 'pedro-hipertenso',
        nombre: 'Pedro',
        apellidos: 'Ramírez Gómez',
        email: 'test-pedro@nutricoach-test.com',
        password: 'TestPass2026!',
        objetivo: 'mantener',
        nivel: 'principiante',
        peso_inicial: 83,
        altura: 170,
        edad: 65,
        sexo: 'hombre',
        restricciones_alimentarias: 'Bajo en sodio por hipertensión',
        notas: 'Jubilado. Quiere mantener peso activo. Hipertenso controlado con medicación. Nunca ha seguido una dieta. Motivación: salud cardiovascular y energía.',
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
            trigger_onboarding: 'Preocupación por la salud tras infarto leve de un amigo. Quiere "ponerse las pilas" con la alimentación y el ejercicio. Su mujer le apoya.',
            autoeficacia: 7,
            historial_dietas: ['Ninguna. Siempre ha comido de forma tradicional mediterránea.'],
            razones_abandono: [],
            relacion_comida: 'flexible',
            todo_o_nada: 'no',
            dia_tipico: 'Desayuno: café con leche + pan tostado con aceite y tomate. Comida: legumbres/pasta/arroz con verdura y carne/pescado. Merienda: fruta de temporada. Cena: sopa/crema + algo ligero. Le gusta picar frutos secos.',
            comidas_favoritas: 'Potaje de garbanzos, merluza a la plancha, gazpacho, fruta variada',
            alimentos_evitar_extra: 'embutidos, salados',
            alcohol_semanal: '1',
            suplementos: 'Ninguno',
            hora_primera_ingesta: '08:00',
            hora_comida_principal: '14:30',
            hora_ultima_ingesta: '20:30',
            hora_entreno: '10:00',
            con_quien_come: ['mujer', 'hijos (fines de semana)'],
            frecuencia_fuera: 1,
            comida_trampa: 'Un vino + tapas los sábados al mediodía con la familia',
            condiciones_salud: 'Hipertensión arterial (Enalapril 10mg/día), colesterol total 210 (LDL 140, HDL 48), artrosis lumbar leve. Sin diabetes. Creatinina 1.1.',
            horas_sueno: 7,
            calidad_sueno: 4,
            nivel_estres: 2,
            descripcion_semana_entreno: 'Camina 30-40min diario con la mujer. 2x/semana ejercicios de movilidad y fuerza suave en casa (pesas ligeras). Quiere apuntarse al gimnasio municipal.',
            fecha_competicion: null,
            tipo_competicion: null,
            nutricion_peri_entreno: 'Agua antes y después de caminar. A veces un plátano antes.',
        },
    },
]

// ════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ════════════════════════════════════════════════════════════════

function colorear(texto: string, tipo: 'verde' | 'rojo' | 'amarillo' | 'azul' | 'cielo'): string {
    const colores: Record<string, string> = {
        verde: '\x1b[32m',
        rojo: '\x1b[31m',
        amarillo: '\x1b[33m',
        azul: '\x1b[34m',
        cielo: '\x1b[36m',
    }
    return `${colores[tipo] || ''}${texto}\x1b[0m`
}

async function crearUsuarioAuth(cliente: ClienteTest): Promise<string | null> {
    const { data, error } = await supabase.auth.admin.createUser({
        email: cliente.email,
        password: cliente.password,
        user_metadata: {
            nombre: cliente.nombre,
            apellidos: cliente.apellidos,
            role: 'cliente',
        },
        email_confirm: true,
    })
    if (error) {
        // Si el usuario ya existe, lo recuperamos
        if (error.message.includes('already exists')) {
            const { data: existing } = await supabase.auth.admin.listUsers()
            const found = existing?.users.find(u => u.email === cliente.email)
            if (found) return found.id
        }
        console.error(`  ${colorear('✗', 'rojo')} Error Auth: ${error.message}`)
        return null
    }
    console.log(`  ${colorear('✓', 'verde')} Usuario Auth creado: ${data.user.id}`)
    return data.user.id
}

async function actualizarProfile(profileId: string, apellidos: string) {
    const { error } = await supabase
        .from('profiles')
        .update({
            apellidos,
            role: 'cliente',
        })
        .eq('id', profileId)
    if (error) {
        console.error(`  ${colorear('✗', 'rojo')} Error profile: ${error.message}`)
        return false
    }
    return true
}

async function crearClienteDB(cliente: ClienteTest, profileId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('clientes')
        .insert({
            profile_id: profileId,
            coach_id: COACH_ID,
            objetivo: cliente.objetivo,
            nivel: cliente.nivel,
            peso_inicial: cliente.peso_inicial,
            altura: cliente.altura,
            edad: cliente.edad,
            sexo: cliente.sexo,
            restricciones_alimentarias: cliente.restricciones_alimentarias,
            notas: cliente.notas,
            onboarding_completado: false,
            revisado_por_coach: false,
        })
        .select('id')
        .single()

    if (error) {
        console.error(`  ${colorear('✗', 'rojo')} Error cliente: ${error.message}`)
        return null
    }
    console.log(`  ${colorear('✓', 'verde')} Cliente DB: ${data.id}`)
    return data.id
}

async function insertarOnboarding(clienteId: string, c: ClienteTest) {
    const { error } = await supabase
        .from('onboarding_responses')
        .upsert({
            cliente_id: clienteId,
            segmento: c.segmento,
            objetivo: c.objetivo,
            actividad_base: c.actividad_base,
            dias_entreno: c.dias_entreno,
            tipo_entreno: c.tipo_entreno,
            duracion_sesion_min: c.duracion_sesion_min,
            restricciones: c.restricciones_alimentarias ? [c.restricciones_alimentarias] : [],
            alimentos_no_gustan: c.alimentos_no_gustan,
            nivel_cocina: c.nivel_cocina,
            tiempo_cocina_min: c.tiempo_cocina_min,
            presupuesto_semanal_eur: c.presupuesto_semanal_eur,
        }, { onConflict: 'cliente_id' })

    if (error) {
        console.error(`  ${colorear('✗', 'rojo')} Error onboarding: ${error.message}`)
        return false
    }
    console.log(`  ${colorear('✓', 'verde')} Onboarding básico insertado`)
    return true
}

async function insertarPerfilProfundo(clienteId: string, c: ClienteTest) {
    const perfil = c.perfil
    // Determinar analítica disponible según condiciones de salud
    const analisisDisponibles: string[] = []
    const analisisValores: Record<string, string> = {}

    if (c.perfil.condiciones_salud?.toLowerCase().includes('diabet')) {
        analisisDisponibles.push('glucosa', 'hbA1c', 'perfil lipídico')
        analisisValores['glucosa'] = '126 mg/dL'
        analisisValores['hbA1c'] = '7.1%'
        analisisValores['colesterol total'] = '200 mg/dL'
        analisisValores['ldl'] = '160 mg/dL'
        analisisValores['hdl'] = '38 mg/dL'
    }

    const { error } = await supabase
        .from('onboarding_perfil_profundo')
        .upsert({
            cliente_id: clienteId,
            trigger_onboarding: perfil.trigger_onboarding,
            autoeficacia: perfil.autoeficacia,
            historial_dietas: perfil.historial_dietas,
            razones_abandono: perfil.razones_abandono,
            relacion_comida: perfil.relacion_comida,
            todo_o_nada: perfil.todo_o_nada,
            dia_tipico: perfil.dia_tipico,
            comidas_favoritas: perfil.comidas_favoritas,
            alimentos_evitar_extra: perfil.alimentos_evitar_extra,
            alcohol_semanal: perfil.alcohol_semanal,
            suplementos: perfil.suplementos,
            hora_primera_ingesta: perfil.hora_primera_ingesta,
            hora_comida_principal: perfil.hora_comida_principal,
            hora_ultima_ingesta: perfil.hora_ultima_ingesta,
            hora_entreno: perfil.hora_entreno,
            patrones_energia: ['media_manana', 'tarde_temprano'],
            con_quien_come: perfil.con_quien_come,
            frecuencia_fuera: perfil.frecuencia_fuera,
            comida_trampa: perfil.comida_trampa,
            condiciones_salud: perfil.condiciones_salud,
            horas_sueno: perfil.horas_sueno,
            calidad_sueno: perfil.calidad_sueno,
            nivel_estres: perfil.nivel_estres,
            descripcion_semana_entreno: perfil.descripcion_semana_entreno,
            fecha_competicion: perfil.fecha_competicion,
            tipo_competicion: perfil.tipo_competicion,
            nutricion_peri_entreno: perfil.nutricion_peri_entreno,
            analisis_disponibles: analisisDisponibles,
            analisis_valores: analisisValores,
        }, { onConflict: 'cliente_id' })

    if (error) {
        console.error(`  ${colorear('✗', 'rojo')} Error perfil profundo: ${error.message}`)
        return false
    }
    console.log(`  ${colorear('✓', 'verde')} Perfil profundo insertado`)
    return true
}

async function marcarOnboarding(clienteId: string) {
    const { error } = await supabase
        .from('clientes')
        .update({ onboarding_completado: true })
        .eq('id', clienteId)
    if (error) {
        console.error(`  ${colorear('✗', 'rojo')} Error al marcar onboarding: ${error.message}`)
        return false
    }
    return true
}

async function dispararGeneracionPlan(clienteId: string, idx: number, nombre: string) {
    try {
        const res = await fetch(`${appUrl}/api/generar-plan-inicial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: clienteId }),
        })
        const data = await res.json()
        if (res.ok) {
            console.log(`  ${colorear('✓', 'verde')} Plan generado: ${colorear(`${data.plan?.kcal_objetivo ?? '?'} kcal`, 'cielo')}`)
            if (data.plan?.macros) {
                const m = data.plan.macros
                console.log(`    Macros: ${m.proteinas_g || m.proteinas}g P | ${m.carbos_g || m.carbohidratos}g C | ${m.grasas_g || m.grasas}g G`)
            }
            if (data.plan?.distribucion_comidas) {
                console.log(`    Comidas: ${(data.plan.distribucion_comidas as any[]).map((c: any) => c.nombre).join(', ')}`)
            }
            return true
        } else {
            console.error(`  ${colorear('✗', 'rojo')} Error generación plan: ${data.error || 'desconocido'}`)
            return false
        }
    } catch (err: any) {
        console.error(`  ${colorear('✗', 'rojo')} Error request plan: ${err.message}`)
        return false
    }
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════

async function main() {
    console.log(`\n${colorear('═══════════════════════════════════════════════', 'cielo')}`)
    console.log(`${colorear('  🌱 SEED CLIENTES TEST — NutriCoach', 'cielo')}`)
    console.log(`${colorear('═══════════════════════════════════════════════', 'cielo')}`)
    console.log(`  URL App:  ${appUrl}`)
    console.log(`  Supabase: ${supabaseUrl}`)
    console.log(`  Coach ID: ${COACH_ID}`)
    console.log(`  Fecha:    ${new Date().toISOString().split('T')[0]}\n`)

    let exitos = 0
    let fallos = 0

    for (let i = 0; i < CLIENTES_TEST.length; i++) {
        const c = CLIENTES_TEST[i]
        const label = `${c.nombre} ${c.apellidos} — ${c.objetivo} / ${c.edad}a / ${c.sexo}`
        console.log(`${colorear(`[${i + 1}/${CLIENTES_TEST.length}]`, 'azul')} ${colorear(label, 'amarillo')}`)
        console.log(`  Email: ${c.email}`)

        // 1. Crear usuario Auth
        const profileId = await crearUsuarioAuth(c)
        if (!profileId) { fallos++; continue }

        // 2. Actualizar profile (apellidos)
        await actualizarProfile(profileId, c.apellidos)

        // 3. Crear cliente en DB
        const clienteId = await crearClienteDB(c, profileId)
        if (!clienteId) { fallos++; continue }

        // 4. Insertar onboarding básico
        await insertarOnboarding(clienteId, c)

        // 5. Insertar perfil profundo
        await insertarPerfilProfundo(clienteId, c)

        // 6. Marcar onboarding como completado
        await marcarOnboarding(clienteId)

        // 7. Disparar generación de plan IA
        console.log(`  ${colorear('⟳', 'cielo')} Generando plan IA...`)
        const planOk = await dispararGeneracionPlan(clienteId, i, c.nombre)

        if (planOk) {
            exitos++
        } else {
            console.log(`  ${colorear('⚠', 'amarillo')} Plan generado con fallback (sin IA o con datos calculados)`)
            console.log(`    Revisar manualmente en /clientes/${clienteId}`)
            exitos++ // el cliente se creó, pero el plan usó fallback
        }
        console.log('')
    }

    // Resumen
    console.log(colorear('═══════════════════════════════════════════════', 'cielo'))
    console.log(colorear('  📊 RESUMEN', 'cielo'))
    console.log(colorear('═══════════════════════════════════════════════', 'cielo'))
    console.log(`  Total: ${CLIENTES_TEST.length}`)
    console.log(`  ${colorear(`✓ Clientes creados: ${exitos}`, 'verde')}`)
    console.log(`  ${colorear(`✗ Fallos: ${fallos}`, fallos > 0 ? 'rojo' : 'verde')}`)
    console.log('')
    console.log(colorear('  Accede a cada cliente en:', 'azul'))
    for (const c of CLIENTES_TEST) {
        console.log(`  • ${c.nombre}: http://localhost:3000/clientes  (buscar por email)`)
    }
    console.log('')
    console.log(colorear('  Para probar portal cliente:', 'azul'))
    console.log('  Cada plan tiene un código público en /clientes/[id] → copiar enlace portal')
    console.log('')
}

main().catch(console.error)
