#!/usr/bin/env node
/**
 * crear-alimentos-faltantes.mjs
 *
 * Crea alimentos base en Supabase para cubrir ingredientes huérfanos
 * que no existen en la BD pero son alimentos básicos o recurrentes.
 *
 * USO:
 *   node scripts/crear-alimentos-faltantes.mjs          → dry-run
 *   node scripts/crear-alimentos-faltantes.mjs --apply   → inserta
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const APPLY = process.argv.includes('--apply')

// Alimentos a crear con sus macros (por 100g)
// Fuentes: BEDCA, USDA, etiquetado nutricional
const ALIMENTOS = [
    {
        nombre: 'Aceite vegetal',
        calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0,
        descripcion: 'Aceite vegetal genérico (girasol, soja o mezcla)',
        categoria: 'Aceites y grasas',
    },
    {
        nombre: 'Proteína en polvo sabor vainilla',
        calorias: 380, proteinas: 75, carbohidratos: 7, grasas: 5, fibra: 0,
        descripcion: 'Whey protein isolate sabor vainilla',
        categoria: 'Suplementos',
    },
    {
        nombre: 'Proteína en polvo sabor chocolate',
        calorias: 375, proteinas: 72, carbohidratos: 8, grasas: 5, fibra: 1,
        descripcion: 'Whey protein isolate sabor chocolate',
        categoria: 'Suplementos',
    },
    {
        nombre: 'Proteína de suero (whey)',
        calorias: 380, proteinas: 75, carbohidratos: 7, grasas: 5, fibra: 0,
        descripcion: 'Whey protein sin sabor',
        categoria: 'Suplementos',
    },
    {
        nombre: 'Yogur de proteína sabor chocolate',
        calorias: 80, proteinas: 10, carbohidratos: 7, grasas: 1, fibra: 0,
        descripcion: 'Yogur con proteína añadida sabor chocolate',
        categoria: 'Lácteos',
    },
    {
        nombre: 'Yogur de proteína sabor vainilla',
        calorias: 78, proteinas: 10, carbohidratos: 7, grasas: 1, fibra: 0,
        descripcion: 'Yogur con proteína añadida sabor vainilla',
        categoria: 'Lácteos',
    },
    {
        nombre: 'Galletas María',
        calorias: 430, proteinas: 7, carbohidratos: 76, grasas: 11, fibra: 3,
        descripcion: 'Galletas tipo María',
        categoria: 'Galletas',
    },
    {
        nombre: 'Aderezo César',
        calorias: 350, proteinas: 2, carbohidratos: 4, grasas: 37, fibra: 0,
        descripcion: 'Aderezo estilo César para ensaladas',
        categoria: 'Salsas y condimentos',
    },
    {
        nombre: 'Condimento BBQ',
        calorias: 120, proteinas: 1, carbohidratos: 28, grasas: 1, fibra: 1,
        descripcion: 'Condimento seco estilo barbacoa',
        categoria: 'Especias',
    },
    {
        nombre: 'Hojuelas de chile (chili flakes)',
        calorias: 318, proteinas: 12, carbohidratos: 57, grasas: 17, fibra: 27,
        descripcion: 'Hojuelas de chile seco (red pepper flakes)',
        categoria: 'Especias',
    },
    {
        nombre: 'Mirin',
        calorias: 200, proteinas: 0.5, carbohidratos: 43, grasas: 0, fibra: 0,
        descripcion: 'Vino de arroz dulce para cocina japonesa',
        categoria: 'Condimentos',
    },
    {
        nombre: 'Cornflakes sin azúcar',
        calorias: 375, proteinas: 7, carbohidratos: 84, grasas: 1, fibra: 3,
        descripcion: 'Copos de maíz tostados sin azúcar añadido',
        categoria: 'Cereales',
    },
    {
        nombre: 'Pickles dulces',
        calorias: 30, proteinas: 1, carbohidratos: 7, grasas: 0, fibra: 1,
        descripcion: 'Pepinillos encurtidos dulces',
        categoria: 'Encurtidos',
    },
    {
        nombre: 'Yufka (masa para rollos)',
        calorias: 250, proteinas: 8, carbohidratos: 45, grasas: 4, fibra: 2,
        descripcion: 'Masa fina tipo filo para rollos turcos',
        categoria: 'Masas',
    },
    {
        nombre: 'Láminas de lasaña sin gluten',
        calorias: 350, proteinas: 7, carbohidratos: 75, grasas: 2, fibra: 3,
        descripcion: 'Placas para lasaña sin gluten (arroz/maíz)',
        categoria: 'Pastas',
    },
    {
        nombre: 'Pepinillos en vinagre',
        calorias: 12, proteinas: 0.5, carbohidratos: 2, grasas: 0.2, fibra: 1,
        descripcion: 'Pepinillos encurtidos en vinagre',
        categoria: 'Encurtidos',
    },
    {
        nombre: 'Piel de yuzu deshidratada',
        calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0,
        descripcion: 'Ralladura de yuzu deshidratada para aromatizar',
        categoria: 'Especias',
    },
    {
        nombre: 'Pastillas de caldo de ave trituradas',
        calorias: 2, proteinas: 0.1, carbohidratos: 0.3, grasas: 0, fibra: 0,
        descripcion: 'Pastillas de caldo concentrado de ave trituradas',
        categoria: 'Condimentos',
    },
    {
        nombre: 'Pepinillos holandeses',
        calorias: 11, proteinas: 0.4, carbohidratos: 2, grasas: 0.1, fibra: 1,
        descripcion: 'Pepinillos encurtidos estilo holandés',
        categoria: 'Encurtidos',
    },
    {
        nombre: 'Galletas (genérico)',
        calorias: 430, proteinas: 7, carbohidratos: 76, grasas: 11, fibra: 2,
        descripcion: 'Galletas genéricas para uso en recetas',
        categoria: 'Galletas',
    },
]

async function main() {
    console.log(`\n🥗 Crear alimentos faltantes en Supabase\n`)

    // Verificar duplicados
    for (const al of ALIMENTOS) {
        const { data } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .eq('nombre', al.nombre)
            .maybeSingle()

        if (data) {
            console.log(`   ⏭️  Ya existe: "${al.nombre}" (${data.id})`)
            continue
        }

        console.log(`   ${APPLY ? '✅' : '🔍'} Crear: "${al.nombre}" — ${al.calorias} kcal | P:${al.proteinas}g | C:${al.carbohidratos}g | G:${al.grasas}g`)

        if (APPLY) {
            const { data: created, error } = await supabase
                .from('alimentos')
                .insert({
                    nombre: al.nombre,
                    calorias: al.calorias,
                    proteinas: al.proteinas,
                    carbohidratos: al.carbohidratos,
                    grasas: al.grasas,
                    fibra: al.fibra,
                    categoria: al.categoria || 'Otros',
                })
                .select('id')
                .single()

            if (error) {
                console.error(`   ❌ Error: ${error.message}`)
            } else {
                console.log(`   ✅ Creado con ID: ${created.id}`)
            }
        }
    }

    console.log(`\n${APPLY ? '✅ Alimentos creados.' : '🔍 Dry-run — usa --apply para crear.'}`)
    if (!APPLY) {
        console.log('\n⚠️  Tras crear los alimentos, ejecuta:')
        console.log('   node scripts/rematch-ingredientes.mjs --apply')
    }
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})
