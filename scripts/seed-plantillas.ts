import { supabase } from '@/lib/supabase'

/**
 * PLANTILLAS DE DIETA — v5 (Enfoque sostenible)
 *
 * REFERENCIAS:
 * • Dr. Mike Israetel / RP: calorie floors (mujeres >1.600, hombres >2.000),
 *   déficit máx 15%, priorizar adherencia sobre restricción
 * • Alan Aragon: proteína 1.6-1.8 g/kg óptimo para población general
 * • Morton et al. (2018): 1.6 g/kg plateau síntesis proteica muscular
 * • Trexler / Henselmans: grasas mín. 0.8 g/kg, mínimo 25% kcal
 *
 * FILOSOFÍA:
 * • Sostenible > agresivo (no somos culturistas)
 * • Proteína 1.6-1.8 g/kg (suficiente para gen pop)
 * • Grasas mín. 25% kcal para función hormonal
 * • Carbohidratos generosos para adherencia y energía
 * • Déficit máx 10-15%, suelo mínimo 1.600-2.000 kcal
 * • La mejor dieta es la que el cliente puede mantener
 */

interface PlantillaInput {
    nombre: string
    descripcion: string
    tipo?: 'normal' | 'carga' | 'suplementos'
    kcal_objetivo: number
    proteinas_objetivo: number
    carbohidratos_objetivo: number
    grasas_objetivo: number
}

const plantillas: PlantillaInput[] = [
    // ==========================================
    // PÉRDIDA DE PESO — Déficit 10-15%
    // ==========================================
    {
        nombre: 'Pérdida suave (1.600 kcal)',
        descripcion:
            'Déficit suave para inicio de pérdida de peso. Perfil: mujer pequeña o persona ligera (~60kg) que empieza. Proteína 1.7g/kg (105g). Grasas generosas (31%) para salud hormonal femenina. Tendencias actuales en nutrición sostenible.',
        kcal_objetivo: 1600,
        proteinas_objetivo: 105,
        carbohidratos_objetivo: 171,
        grasas_objetivo: 55,
    },
    {
        nombre: 'Pérdida moderada (1.900 kcal)',
        descripcion:
            'Déficit moderado para pérdida de peso sostenible. Perfil: mujer activa u hombre ligero (~70kg). Proteína equilibrada (120g). Carbohidratos generosos (216g / 45%) para mantener energía sin sensación de restricción.',
        kcal_objetivo: 1900,
        proteinas_objetivo: 120,
        carbohidratos_objetivo: 216,
        grasas_objetivo: 62,
    },
    {
        nombre: 'Pérdida activa (2.200 kcal)',
        descripcion:
            'Déficit ligero para hombre activo que entrena. Perfil: ~78-82kg buscando pérdida de grasa. Proteína 1.7g/kg (135g). Carbohidratos altos (269g / 49%) para rendimiento y adherencia.',
        kcal_objetivo: 2200,
        proteinas_objetivo: 135,
        carbohidratos_objetivo: 269,
        grasas_objetivo: 65,
    },
    // ==========================================
    // GANANCIA DE MASA MUSCULAR — Superávit
    // ==========================================
    {
        nombre: 'Ganancia moderada (2.600 kcal)',
        descripcion:
            'Superávit moderado para ganancia muscular limpia. Perfil: persona que entrena fuerza (~80kg). Carbohidratos altos (364g / 56%) para rendimiento y recuperación. Proteína 1.7g/kg (140g) suficiente para hipertrofia.',
        kcal_objetivo: 2600,
        proteinas_objetivo: 140,
        carbohidratos_objetivo: 364,
        grasas_objetivo: 65,
    },
    {
        nombre: 'Ganancia activa (2.900 kcal)',
        descripcion:
            'Superávit para ganancia de volumen. Perfil: hardgainer o persona grande (~85-90kg). Alta densidad de carbohidratos (418g / 58%) para rendimiento máximo. Proteína 1.7g/kg (150g).',
        kcal_objetivo: 2900,
        proteinas_objetivo: 150,
        carbohidratos_objetivo: 418,
        grasas_objetivo: 70,
    },
    // ==========================================
    // RECOMPOSICIÓN CORPORAL — Déficit ligero
    // ==========================================
    {
        nombre: 'Recomposición (2.000 kcal)',
        descripcion:
            'Déficit ligero para recomposición en principiantes o personas que retoman actividad (~75kg). Proteína ligeramente elevada 1.8g/kg (135g) para balance nitrogenado. Carbohidratos generosos (235g / 47%) para adherencia.',
        kcal_objetivo: 2000,
        proteinas_objetivo: 135,
        carbohidratos_objetivo: 235,
        grasas_objetivo: 58,
    },
    {
        nombre: 'Recomposición activa (2.300 kcal)',
        descripcion:
            'Ligero déficit para recomposición en personas que entrenan regularmente (~80kg). Carbohidratos dominantes (296g / 51%) para rendimiento. Proteína 1.7g/kg (140g) balance nitrogenado positivo.',
        kcal_objetivo: 2300,
        proteinas_objetivo: 140,
        carbohidratos_objetivo: 296,
        grasas_objetivo: 62,
    },
    // ==========================================
    // CARGA DE CARBOHIDRATOS — Competición
    // ==========================================
    {
        nombre: 'Carga clásica (8g/kg carbos)',
        descripcion:
            'Protocolo de carga de carbohidratos para competición de resistencia. 3 días previos con 8g/kg/día de carbohidratos. Basado en protocolo clásico de supercompensación de glucógeno. Proteína moderada (1.6g/kg). Grasas reducidas (0.6g/kg).',
        tipo: 'carga',
        kcal_objetivo: 3200,
        proteinas_objetivo: 120,
        carbohidratos_objetivo: 600,
        grasas_objetivo: 45,
    },
    {
        nombre: 'Carga intensiva (12g/kg carbos)',
        descripcion:
            'Protocolo de carga intensiva para deportes de ultra-resistencia (Ironman, ultra-trail). 12g/kg/día carbohidratos 3 días previos. Proteína 1.4g/kg. Grasas mínimas 0.4g/kg.',
        tipo: 'carga',
        kcal_objetivo: 4000,
        proteinas_objetivo: 105,
        carbohidratos_objetivo: 900,
        grasas_objetivo: 30,
    },
    // ==========================================
    // SUPLEMENTACIÓN — Competición
    // ==========================================
    {
        nombre: 'Protocolo suplementos (60-90 min)',
        descripcion:
            'Plan de suplementación para competición de media distancia (~60-90 min). 1 gel cada 30 min (25g carbos), electrolitos cada 60 min, cafeína 100mg opcional 30 min antes. Hidratación 150ml/15min.',
        tipo: 'suplementos',
        kcal_objetivo: 600,
        proteinas_objetivo: 0,
        carbohidratos_objetivo: 150,
        grasas_objetivo: 0,
    },
    {
        nombre: 'Protocolo suplementos ultra (>3h)',
        descripcion:
            'Plan de suplementación para ultra-resistencia (>3h). 1 gel cada 20 min (25g carbos), electrolitos cada 30 min, cafeína 200mg. Hidratación 200ml/15min. Proteína líquida desde hora 2.',
        tipo: 'suplementos',
        kcal_objetivo: 2000,
        proteinas_objetivo: 40,
        carbohidratos_objetivo: 450,
        grasas_objetivo: 10,
    },
]

/**
 * Inserta las 7 plantillas de dieta base en Supabase.
 * Requiere que el usuario coach esté autenticado (sesión activa).
 *
 * USO DESDE API:
 *   GET http://localhost:3000/api/plantillas/seed
 */
export async function seedPlantillas(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return { success: false, count: 0, error: 'No hay sesión activa. Inicia sesión como coach primero.' }
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profileError || profile?.role !== 'coach') {
            return { success: false, count: 0, error: 'El usuario no tiene rol de coach.' }
        }

        const plantillasConCoach = plantillas.map((p) => ({ coach_id: user.id, ...p }))

        const { data, error } = await supabase.from('plantillas_dietas').insert(plantillasConCoach).select('id, nombre')

        if (error) {
            return { success: false, count: 0, error: error.message }
        }

        return { success: true, count: data?.length ?? 0 }
    } catch (error: any) {
        console.error('Error al insertar plantillas:', error)
        return { success: false, count: 0, error: error.message }
    }
}

// Auto-ejecución si se llama directamente
if (require.main === module) {
    ; (async () => {
        console.log('🌱 Insertando 7 plantillas de dieta base (enfoque sostenible)...')
        const result = await seedPlantillas()
        if (result.success) {
            console.log(`✅ ${result.count} plantillas insertadas correctamente.`)
        } else {
            console.error('❌ Error:', result.error)
        }
        process.exit(result.success ? 0 : 1)
    })()
}
