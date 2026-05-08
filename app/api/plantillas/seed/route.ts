import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLANTILLAS = [
    { nombre: 'Pérdida suave (1.600 kcal)', descripcion: 'Déficit suave para inicio de pérdida de peso. Perfil: mujer pequeña o persona ligera (~60kg) que empieza. Proteína 1.7g/kg (105g). Grasas generosas (31%) para salud hormonal femenina.', tipo: 'normal', kcal_objetivo: 1600, proteinas_objetivo: 105, carbohidratos_objetivo: 171, grasas_objetivo: 55 },
    { nombre: 'Pérdida moderada (1.900 kcal)', descripcion: 'Déficit moderado para pérdida de peso sostenible. Perfil: mujer activa u hombre ligero (~70kg). Proteína equilibrada (120g). Carbohidratos generosos (216g / 45%) para mantener energía.', tipo: 'normal', kcal_objetivo: 1900, proteinas_objetivo: 120, carbohidratos_objetivo: 216, grasas_objetivo: 62 },
    { nombre: 'Pérdida activa (2.200 kcal)', descripcion: 'Déficit ligero para hombre activo que entrena. Perfil: ~78-82kg buscando pérdida de grasa. Proteína 1.7g/kg (135g). Carbohidratos altos (269g / 49%) para rendimiento.', tipo: 'normal', kcal_objetivo: 2200, proteinas_objetivo: 135, carbohidratos_objetivo: 269, grasas_objetivo: 65 },
    { nombre: 'Ganancia moderada (2.600 kcal)', descripcion: 'Superávit moderado para ganancia muscular limpia. Perfil: persona que entrena fuerza (~80kg). Carbohidratos altos (364g / 56%) para rendimiento. Proteína 1.7g/kg (140g).', tipo: 'normal', kcal_objetivo: 2600, proteinas_objetivo: 140, carbohidratos_objetivo: 364, grasas_objetivo: 65 },
    { nombre: 'Ganancia activa (2.900 kcal)', descripcion: 'Superávit para ganancia de volumen. Perfil: hardgainer o persona grande (~85-90kg). Alta densidad de carbohidratos (418g / 58%) para rendimiento máximo.', tipo: 'normal', kcal_objetivo: 2900, proteinas_objetivo: 150, carbohidratos_objetivo: 418, grasas_objetivo: 70 },
    { nombre: 'Recomposición (2.000 kcal)', descripcion: 'Déficit ligero para recomposición en principiantes (~75kg). Proteína ligeramente elevada 1.8g/kg (135g) para balance nitrogenado. Carbohidratos generosos (235g / 47%).', tipo: 'normal', kcal_objetivo: 2000, proteinas_objetivo: 135, carbohidratos_objetivo: 235, grasas_objetivo: 58 },
    { nombre: 'Recomposición activa (2.300 kcal)', descripcion: 'Ligero déficit para recomposición en personas que entrenan regularmente (~80kg). Carbohidratos dominantes (296g / 51%) para rendimiento. Proteína 1.7g/kg (140g).', tipo: 'normal', kcal_objetivo: 2300, proteinas_objetivo: 140, carbohidratos_objetivo: 296, grasas_objetivo: 62 },
    // Carga de carbohidratos
    { nombre: 'Carga clásica (8g/kg carbos)', descripcion: 'Protocolo de carga de carbohidratos para competición de resistencia. 3 días previos con 8g/kg/día de carbohidratos. Basado en protocolo clásico de supercompensación de glucógeno.', tipo: 'carga', kcal_objetivo: 3200, proteinas_objetivo: 120, carbohidratos_objetivo: 600, grasas_objetivo: 45 },
    { nombre: 'Carga intensiva (12g/kg carbos)', descripcion: 'Protocolo de carga intensiva para deportes de ultra-resistencia (Ironman, ultra-trail). 12g/kg/día carbohidratos 3 días previos.', tipo: 'carga', kcal_objetivo: 4000, proteinas_objetivo: 105, carbohidratos_objetivo: 900, grasas_objetivo: 30 },
    // Suplementación
    { nombre: 'Protocolo suplementos (60-90 min)', descripcion: 'Plan de suplementación para competición de media distancia (~60-90 min). 1 gel cada 30 min (25g carbos), electrolitos cada 60 min, cafeína 100mg opcional.', tipo: 'suplementos', kcal_objetivo: 600, proteinas_objetivo: 0, carbohidratos_objetivo: 150, grasas_objetivo: 0 },
    { nombre: 'Protocolo suplementos ultra (>3h)', descripcion: 'Plan de suplementación para ultra-resistencia (>3h). 1 gel cada 20 min (25g carbos), electrolitos cada 30 min, cafeína 200mg. Hidratación 200ml/15min.', tipo: 'suplementos', kcal_objetivo: 2000, proteinas_objetivo: 40, carbohidratos_objetivo: 450, grasas_objetivo: 10 },
]

/**
 * GET /api/plantillas/seed
 *
 * Inserta las 11 plantillas de dieta base usando service role.
 * Asigna las plantillas al primer coach encontrado en la BD.
 * NO requiere sesión activa (usa service role).
 *
 * USO:
 *   curl -X GET http://localhost:3000/api/plantillas/seed
 */
export async function GET() {
    try {
        // 1. Buscar el primer coach en profiles
        const { data: coaches, error: coachError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'coach')
            .limit(1)

        if (coachError) {
            return NextResponse.json({ error: `Error al buscar coach: ${coachError.message}` }, { status: 500 })
        }

        if (!coaches || coaches.length === 0) {
            return NextResponse.json(
                { error: 'No hay ningún coach registrado. Crea tu cuenta primero desde /login.' },
                { status: 400 }
            )
        }

        const coachId = coaches[0].id

        // 2. Verificar si ya existen plantillas para este coach
        const { data: existentes } = await supabaseAdmin
            .from('plantillas_dietas')
            .select('id')
            .eq('coach_id', coachId)
            .limit(1)

        if (existentes && existentes.length > 0) {
            return NextResponse.json({
                message: 'ℹ️ Las plantillas ya están insertadas para este coach.',
                count: 0,
            })
        }

        // 3. Insertar plantillas
        const plantillasConCoach = PLANTILLAS.map((p) => ({ coach_id: coachId, ...p }))

        const { data, error } = await supabaseAdmin
            .from('plantillas_dietas')
            .insert(plantillasConCoach)
            .select('id, nombre')

        if (error) {
            return NextResponse.json({ error: `Error al insertar plantillas: ${error.message}` }, { status: 500 })
        }

        return NextResponse.json({
            message: `✅ ${data.length} plantillas insertadas correctamente.`,
            count: data.length,
        })
    } catch (error: any) {
        console.error('Error en seed API:', error)
        return NextResponse.json(
            { error: 'Error interno al insertar plantillas' },
            { status: 500 }
        )
    }
}
