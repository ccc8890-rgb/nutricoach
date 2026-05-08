/**
 * Seed directo de plantillas de dieta usando service_role_key
 * No necesita servidor ni sesión activa.
 *
 * USO:
 *   node scripts/seed-plantillas-directo.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Leer .env.local manualmente
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ No se encontraron las credenciales de Supabase en .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

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

async function main() {
    console.log('🌱 Buscando primer coach en profiles...')

    const { data: coaches, error: coachError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'coach')
        .limit(1)

    if (coachError) {
        console.error('❌ Error al buscar coach:', coachError.message)
        process.exit(1)
    }

    if (!coaches || coaches.length === 0) {
        console.error('❌ No hay ningún coach registrado. Crea tu cuenta primero desde /login.')
        console.error('   Después de crear la cuenta, ejecuta este script de nuevo.')
        process.exit(1)
    }

    const coachId = coaches[0].id
    console.log(`✅ Coach encontrado: ${coachId}`)

    // Verificar si ya existen
    const { data: existentes } = await supabase
        .from('plantillas_dietas')
        .select('id')
        .eq('coach_id', coachId)
        .limit(1)

    if (existentes && existentes.length > 0) {
        console.log('ℹ️  Las plantillas ya están insertadas para este coach.')
        process.exit(0)
    }

    // Insertar
    const plantillasConCoach = PLANTILLAS.map((p) => ({ coach_id: coachId, ...p }))

    const { data, error } = await supabase
        .from('plantillas_dietas')
        .insert(plantillasConCoach)
        .select('id, nombre')

    if (error) {
        console.error('❌ Error al insertar plantillas:', error.message)
        process.exit(1)
    }

    console.log(`✅ ${data.length} plantillas insertadas correctamente:`)
    data.forEach((p) => console.log(`   • ${p.nombre}`))
}

main()
