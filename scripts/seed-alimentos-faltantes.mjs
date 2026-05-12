/**
 * Script para insertar alimentos base faltantes en Supabase
 * usando la API REST (service_role_key).
 * 
 * USO: node scripts/seed-alimentos-faltantes.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

// Alimentos a insertar (parseados del SQL)
const ALIMENTOS = [
    // CONDIMENTOS / SALSAS
    { nombre: 'Vinagre', categoria: 'Condimentos', calorias: 18, proteinas: 0, carbohidratos: 0.9, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Vinagre de manzana', categoria: 'Condimentos', calorias: 22, proteinas: 0, carbohidratos: 0.9, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Salsa de soja', categoria: 'Condimentos', calorias: 53, proteinas: 8, carbohidratos: 4.7, grasas: 0.4, fibra: 0, custom: false },
    { nombre: 'Mostaza', categoria: 'Condimentos', calorias: 67, proteinas: 3.7, carbohidratos: 4.8, grasas: 3.3, fibra: 1.5, custom: false },
    { nombre: 'Kétchup', categoria: 'Condimentos', calorias: 101, proteinas: 1.1, carbohidratos: 23.4, grasas: 0.1, fibra: 0.4, custom: false },
    { nombre: 'Mayonesa', categoria: 'Condimentos', calorias: 724, proteinas: 1.1, carbohidratos: 1.3, grasas: 79, fibra: 0, custom: false },

    // VERDURAS
    { nombre: 'Cebolla morada', categoria: 'Verduras', calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7, custom: false },
    { nombre: 'Hinojo', categoria: 'Verduras', calorias: 31, proteinas: 1.2, carbohidratos: 7.3, grasas: 0.2, fibra: 3.1, custom: false },
    { nombre: 'Pimiento verde', categoria: 'Verduras', calorias: 20, proteinas: 0.9, carbohidratos: 4.6, grasas: 0.2, fibra: 1.7, custom: false },
    { nombre: 'Calabaza', categoria: 'Verduras', calorias: 26, proteinas: 1, carbohidratos: 6.5, grasas: 0.1, fibra: 0.5, custom: false },
    { nombre: 'Berenjena', categoria: 'Verduras', calorias: 25, proteinas: 1, carbohidratos: 5.9, grasas: 0.2, fibra: 3, custom: false },
    { nombre: 'Judías verdes', categoria: 'Verduras', calorias: 31, proteinas: 1.8, carbohidratos: 7, grasas: 0.1, fibra: 3.2, custom: false },
    { nombre: 'Remolacha', categoria: 'Verduras', calorias: 43, proteinas: 1.6, carbohidratos: 9.6, grasas: 0.2, fibra: 2.8, custom: false },
    { nombre: 'Apio', categoria: 'Verduras', calorias: 16, proteinas: 0.7, carbohidratos: 3, grasas: 0.2, fibra: 1.6, custom: false },
    { nombre: 'Rábano', categoria: 'Verduras', calorias: 16, proteinas: 0.7, carbohidratos: 3.4, grasas: 0.1, fibra: 1.6, custom: false },
    { nombre: 'Alcachofa', categoria: 'Verduras', calorias: 53, proteinas: 3.3, carbohidratos: 11, grasas: 0.2, fibra: 5.4, custom: false },
    { nombre: 'Canónigos', categoria: 'Verduras', calorias: 23, proteinas: 2, carbohidratos: 3.6, grasas: 0.4, fibra: 1.6, custom: false },
    { nombre: 'Endibias', categoria: 'Verduras', calorias: 15, proteinas: 1, carbohidratos: 1.6, grasas: 0.1, fibra: 1.5, custom: false },
    { nombre: 'Col lombarda', categoria: 'Verduras', calorias: 27, proteinas: 1.4, carbohidratos: 5.8, grasas: 0.2, fibra: 2, custom: false },
    { nombre: 'Coles de Bruselas', categoria: 'Verduras', calorias: 43, proteinas: 3.4, carbohidratos: 9, grasas: 0.3, fibra: 3.8, custom: false },
    { nombre: 'Nabos', categoria: 'Verduras', calorias: 28, proteinas: 0.9, carbohidratos: 6.4, grasas: 0.1, fibra: 1.8, custom: false },

    // CEREALES
    { nombre: 'Pan de molde integral', categoria: 'Cereales', calorias: 247, proteinas: 10, carbohidratos: 44, grasas: 3.3, fibra: 7, custom: false },
    { nombre: 'Pan de molde blanco', categoria: 'Cereales', calorias: 265, proteinas: 9, carbohidratos: 49, grasas: 3.2, fibra: 2.7, custom: false },
    { nombre: 'Pan rallado', categoria: 'Cereales', calorias: 395, proteinas: 13, carbohidratos: 75, grasas: 5.3, fibra: 4, custom: false },
    { nombre: 'Cebada', categoria: 'Cereales', calorias: 354, proteinas: 12.5, carbohidratos: 73.5, grasas: 2.3, fibra: 17.3, custom: false },
    { nombre: 'Centeno', categoria: 'Cereales', calorias: 338, proteinas: 10.3, carbohidratos: 75.9, grasas: 1.6, fibra: 15.1, custom: false },
    { nombre: 'Arroz salvaje', categoria: 'Cereales', calorias: 357, proteinas: 14.7, carbohidratos: 73, grasas: 1.1, fibra: 6.2, custom: false },

    // FRUTAS
    { nombre: 'Uvas', categoria: 'Frutas', calorias: 69, proteinas: 0.7, carbohidratos: 18.1, grasas: 0.2, fibra: 0.9, custom: false },
    { nombre: 'Melón', categoria: 'Frutas', calorias: 34, proteinas: 0.8, carbohidratos: 8.2, grasas: 0.2, fibra: 0.9, custom: false },
    { nombre: 'Cerezas', categoria: 'Frutas', calorias: 50, proteinas: 1, carbohidratos: 12.2, grasas: 0.3, fibra: 1.6, custom: false },
    { nombre: 'Higos', categoria: 'Frutas', calorias: 74, proteinas: 0.8, carbohidratos: 19.2, grasas: 0.3, fibra: 2.9, custom: false },
    { nombre: 'Ciruelas', categoria: 'Frutas', calorias: 46, proteinas: 0.7, carbohidratos: 11.4, grasas: 0.3, fibra: 1.4, custom: false },
    { nombre: 'Albaricoque', categoria: 'Frutas', calorias: 48, proteinas: 1.4, carbohidratos: 11.1, grasas: 0.4, fibra: 2, custom: false },
    { nombre: 'Melocotón', categoria: 'Frutas', calorias: 39, proteinas: 0.9, carbohidratos: 9.5, grasas: 0.3, fibra: 1.5, custom: false },
    { nombre: 'Limón', categoria: 'Frutas', calorias: 29, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.3, fibra: 2.8, custom: false },
    { nombre: 'Pomelo', categoria: 'Frutas', calorias: 42, proteinas: 0.8, carbohidratos: 10.7, grasas: 0.1, fibra: 1.6, custom: false },
    { nombre: 'Papaya', categoria: 'Frutas', calorias: 43, proteinas: 0.5, carbohidratos: 11, grasas: 0.3, fibra: 1.7, custom: false },
    { nombre: 'Granada', categoria: 'Frutas', calorias: 83, proteinas: 1.7, carbohidratos: 18.7, grasas: 1.2, fibra: 4, custom: false },
    { nombre: 'Coco rallado', categoria: 'Frutas', calorias: 660, proteinas: 6.9, carbohidratos: 23.7, grasas: 64.5, fibra: 16.3, custom: false },

    // LÁCTEOS
    { nombre: 'Yogur natural', categoria: 'Lácteos', calorias: 61, proteinas: 3.5, carbohidratos: 4.7, grasas: 3.3, fibra: 0, custom: false },
    { nombre: 'Yogur natural desnatado', categoria: 'Lácteos', calorias: 36, proteinas: 3.5, carbohidratos: 5, grasas: 0.2, fibra: 0, custom: false },
    { nombre: 'Leche de coco (lata)', categoria: 'Lácteos', calorias: 230, proteinas: 2.3, carbohidratos: 5.5, grasas: 23.8, fibra: 0, custom: false },
    { nombre: 'Nata líquida', categoria: 'Lácteos', calorias: 196, proteinas: 2.8, carbohidratos: 3, grasas: 19, fibra: 0, custom: false },
    { nombre: 'Nata para montar (35% MG)', categoria: 'Lácteos', calorias: 337, proteinas: 2.5, carbohidratos: 3, grasas: 35, fibra: 0, custom: false },
    { nombre: 'Mantequilla', categoria: 'Lácteos', calorias: 717, proteinas: 0.9, carbohidratos: 0.1, grasas: 81, fibra: 0, custom: false },
    { nombre: 'Requesón', categoria: 'Lácteos', calorias: 80, proteinas: 9, carbohidratos: 4, grasas: 3, fibra: 0, custom: false },

    // CARNES
    { nombre: 'Pollo entero (crudo)', categoria: 'Carnes', calorias: 215, proteinas: 18.6, carbohidratos: 0, grasas: 15.1, fibra: 0, custom: false },
    { nombre: 'Alas de pollo (crudas)', categoria: 'Carnes', calorias: 203, proteinas: 17.5, carbohidratos: 0, grasas: 14.2, fibra: 0, custom: false },
    { nombre: 'Costillas de cerdo', categoria: 'Carnes', calorias: 277, proteinas: 17, carbohidratos: 0, grasas: 23, fibra: 0, custom: false },
    { nombre: 'Solomillo de cerdo', categoria: 'Carnes', calorias: 155, proteinas: 23, carbohidratos: 0, grasas: 6.5, fibra: 0, custom: false },
    { nombre: 'Cordero (pierna)', categoria: 'Carnes', calorias: 205, proteinas: 18, carbohidratos: 0, grasas: 14.5, fibra: 0, custom: false },
    { nombre: 'Conejo', categoria: 'Carnes', calorias: 136, proteinas: 20, carbohidratos: 0, grasas: 5.6, fibra: 0, custom: false },

    // PESCADOS
    { nombre: 'Salmón ahumado', categoria: 'Pescados', calorias: 199, proteinas: 18.5, carbohidratos: 0, grasas: 14, fibra: 0, custom: false },
    { nombre: 'Caballa (fresca)', categoria: 'Pescados', calorias: 205, proteinas: 18.7, carbohidratos: 0, grasas: 13.9, fibra: 0, custom: false },
    { nombre: 'Boquerones (frescos)', categoria: 'Pescados', calorias: 131, proteinas: 18.2, carbohidratos: 0, grasas: 6.1, fibra: 0, custom: false },
    { nombre: 'Pulpo (cocido)', categoria: 'Pescados', calorias: 82, proteinas: 14.9, carbohidratos: 2.2, grasas: 1.8, fibra: 0, custom: false },
    { nombre: 'Calamares', categoria: 'Pescados', calorias: 78, proteinas: 15.6, carbohidratos: 1.5, grasas: 1.2, fibra: 0, custom: false },
    { nombre: 'Mejillones (cocidos)', categoria: 'Pescados', calorias: 86, proteinas: 11.9, carbohidratos: 3.7, grasas: 2.2, fibra: 0, custom: false },
    { nombre: 'Almejas', categoria: 'Pescados', calorias: 73, proteinas: 12.8, carbohidratos: 2.8, grasas: 1, fibra: 0, custom: false },

    // GRASAS / FRUTOS SECOS
    { nombre: 'Aceite de coco', categoria: 'Grasas', calorias: 862, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, custom: false },
    { nombre: 'Aceite de girasol', categoria: 'Grasas', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, custom: false },
    { nombre: 'Anacardos', categoria: 'Frutos secos', calorias: 553, proteinas: 18.2, carbohidratos: 30.2, grasas: 43.9, fibra: 3.3, custom: false },
    { nombre: 'Pistachos', categoria: 'Frutos secos', calorias: 560, proteinas: 20.2, carbohidratos: 27.2, grasas: 45.3, fibra: 10.6, custom: false },
    { nombre: 'Avellanas', categoria: 'Frutos secos', calorias: 628, proteinas: 15, carbohidratos: 17, grasas: 61, fibra: 9.7, custom: false },
    { nombre: 'Piñones', categoria: 'Frutos secos', calorias: 673, proteinas: 13.7, carbohidratos: 13.1, grasas: 68.4, fibra: 3.7, custom: false },
    { nombre: 'Semillas de sésamo', categoria: 'Semillas', calorias: 573, proteinas: 17.7, carbohidratos: 23.5, grasas: 49.7, fibra: 11.8, custom: false },
    { nombre: 'Semillas de lino', categoria: 'Semillas', calorias: 534, proteinas: 18.3, carbohidratos: 28.9, grasas: 42.2, fibra: 27.3, custom: false },
    { nombre: 'Semillas de calabaza', categoria: 'Semillas', calorias: 559, proteinas: 30.2, carbohidratos: 10.7, grasas: 49.1, fibra: 6, custom: false },

    // GALLETAS / SNACKS (genéricos, no de marca)
    { nombre: 'Galletas tipo María', categoria: 'Cereales', calorias: 420, proteinas: 7.5, carbohidratos: 75, grasas: 12, fibra: 2.5, custom: false },
    { nombre: 'Galletas tipo Digestive', categoria: 'Cereales', calorias: 460, proteinas: 7, carbohidratos: 68, grasas: 20, fibra: 4, custom: false },
    { nombre: 'Galletas tipo Cookie', categoria: 'Cereales', calorias: 470, proteinas: 6, carbohidratos: 65, grasas: 22, fibra: 2, custom: false },
]

async function main() {
    console.log(`📦 Insertando ${ALIMENTOS.length} alimentos base faltantes...\n`)

    // Insertar en lotes de 20 para no sobrecargar la API
    const BATCH_SIZE = 20
    let inserted = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < ALIMENTOS.length; i += BATCH_SIZE) {
        const batch = ALIMENTOS.slice(i, i + BATCH_SIZE)

        // Verificar si ya existen (por nombre)
        const nombres = batch.map(a => a.nombre)
        const { data: existing } = await supabase
            .from('alimentos')
            .select('nombre')
            .in('nombre', nombres)

        const existingNames = new Set(existing?.map(e => e.nombre) || [])

        const toInsert = batch.filter(a => !existingNames.has(a.nombre))
        const alreadyExist = batch.filter(a => existingNames.has(a.nombre))

        skipped += alreadyExist.length

        if (toInsert.length === 0) {
            console.log(`  Lote ${Math.floor(i / BATCH_SIZE) + 1}: todos ya existen (${alreadyExist.length} saltados)`)
            continue
        }

        const { error } = await supabase
            .from('alimentos')
            .insert(toInsert)
            .select('id, nombre')

        if (error) {
            // Si es duplicate key, contamos como saltado
            if (error.code === '23505' || error.message?.includes('duplicate')) {
                skipped += toInsert.length
                console.log(`  Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${toInsert.length} duplicados`)
            } else {
                errors++
                console.error(`  ❌ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message?.substring(0, 100)}`)
            }
        } else {
            inserted += toInsert.length
            console.log(`  ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${toInsert.length} insertados`)
            if (toInsert.length > 0) {
                console.log(`    ─ ${toInsert.map(a => a.nombre).join(', ')}`)
            }
        }
    }

    console.log(`\n📊 Resultado final:`)
    console.log(`  ✅ Insertados: ${inserted}`)
    console.log(`  ⏭️  Ya existían: ${skipped}`)
    if (errors > 0) console.log(`  ❌ Errores: ${errors}`)
    console.log(`  📦 Total en seed: ${ALIMENTOS.length}`)
    console.log(`\n✨ Seed completado!`)
}

main().catch(console.error)
