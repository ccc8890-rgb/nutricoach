/**
 * Añadir alimentos básicos que faltan en la BD
 * Detectados por check-missing-foods.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

const alimentos = [
    // FRUTOS SECOS (los que pidió el usuario)
    ['Nueces', 'Frutos secos', 654, 15.2, 13.7, 65.2, 6.7, false],
    ['Almendra cruda', 'Frutos secos', 579, 21.2, 21.6, 49.9, 12.5, false],
    ['Almendra tostada', 'Frutos Secos', 598, 22.1, 19.7, 52.5, 10.9, false],

    // LÁCTEOS BÁSICOS
    ['Leche entera', 'Lácteos', 66, 3.2, 4.8, 3.6, 0, false],
    ['Leche semidesnatada', 'Lácteos', 49, 3.1, 4.8, 1.8, 0, false],
    ['Leche desnatada', 'Lácteos', 35, 3.4, 4.8, 0.2, 0, false],
    ['Yogur griego natural', 'Lácteos', 97, 9, 4, 5, 0, false],

    // CEREALES BÁSICOS
    ['Avena (copos)', 'Cereales', 389, 16.9, 66.3, 6.9, 10.6, false],
    ['Pan integral', 'Cereales', 247, 9.2, 41.3, 3.4, 7, false],
    ['Pan blanco', 'Cereales', 265, 9, 49, 3.2, 2.7, false],

    // LEGUMBRES BÁSICAS
    ['Garbanzos cocidos', 'Legumbres', 139, 8.9, 27.4, 2.6, 7.6, false],
    ['Lentejas cocidas', 'Legumbres', 116, 9, 20, 0.4, 7.9, false],

    // VERDURAS BÁSICAS
    ['Cebolla cruda', 'Verduras', 40, 1.1, 9.3, 0.1, 1.7, false],
    ['Tomate natural', 'Verduras', 18, 0.9, 3.9, 0.2, 1.2, false],
    ['Tomate triturado (bote)', 'Verduras', 38, 1.9, 7.8, 0.3, 1.9, false],
    ['Calabaza cruda', 'Verduras', 26, 1, 6.5, 0.1, 0.5, false],

    // FRUTAS QUE FALTAN
    ['Mango', 'Frutas', 60, 0.8, 15, 0.4, 1.6, false],
    ['Kiwi', 'Frutas', 61, 1.1, 14.7, 0.5, 3, false],
    ['Fresa', 'Frutas', 32, 0.7, 7.7, 0.3, 2, false],

    // PESCADOS BÁSICOS
    ['Atún en lata (escurrido)', 'Pescados', 198, 29.1, 0, 8.2, 0, false],
    ['Atún fresco', 'Pescados', 144, 23.3, 0, 4.9, 0, false],
    ['Merluza', 'Pescados', 82, 17.5, 0, 1.3, 0, false],
    ['Dorada', 'Pescados', 96, 17.5, 0, 2.7, 0, false],
    ['Trucha', 'Pescados', 148, 20.5, 0, 6.6, 0, false],

    // CARNES QUE FALTAN
    ['Solomillo de cerdo', 'Carnes', 155, 24, 0, 6.5, 0, false],
    ['Lomo de cerdo', 'Carnes', 145, 22, 0, 6, 0, false],
    ['Carne picada de pollo', 'Carnes', 158, 21, 0, 8, 0, false],
    ['Ala de pollo', 'Carnes', 203, 18, 0, 14, 0, false],
    ['Jamón serrano', 'Carnes', 241, 30, 0, 13, 0, false],
    ['Jamón york (cocido)', 'Carnes', 145, 20, 1, 7, 0, false],

    // OTROS
    ['Clara de huevo', 'Huevos', 52, 10.9, 0.7, 0.2, 0, false],
    ['Cacao en polvo (desgrasado)', 'Suplementos', 352, 22, 12, 13, 28, false],
    ['Cebolla caramelizada', 'Verduras', 110, 1.3, 26, 0.1, 1.5, false],

    // ESPECIAS/HIERBAS QUE FALTAN (las del primer seed tenían categorías incorrectas)
    ['Albahaca seca', 'Condimentos', 233, 23, 48, 4, 37, false],
    ['Eneldo seco', 'Condimentos', 253, 20, 42, 4, 14, false],
    ['Curry en polvo', 'Condimentos', 325, 14, 55, 14, 53, false],
    ['Cúrcuma molida', 'Condimentos', 354, 7.8, 64.9, 9.9, 21, false],
]

console.log(`Añadiendo ${alimentos.length} alimentos básicos...\n`)

let ok = 0, skipped = 0, fail = 0

for (let i = 0; i < alimentos.length; i++) {
    const [nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra, custom] = alimentos[i]

    process.stdout.write(`  [${i + 1}/${alimentos.length}] ${String(nombre).padEnd(35)} `)

    const { error } = await supabase
        .from('alimentos')
        .insert({ nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra, custom })

    if (!error) {
        console.log('OK')
        ok++
    } else if (error.message?.includes('duplicate') || error.code === '23505') {
        console.log('ya existe')
        skipped++
    } else {
        console.log(`ERROR: ${error.message.substring(0, 60)}`)
        fail++
    }
}

console.log(`\nResultado: ${ok} insertados, ${skipped} ya existían, ${fail} errores`)
