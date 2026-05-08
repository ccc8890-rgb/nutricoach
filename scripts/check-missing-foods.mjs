/**
 * Verificar qué alimentos básicos faltan en la BD
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

const buscar = [
    // Frutos secos que deberían estar
    'Nueces',
    'Nuez',
    'Almendra',
    'Almendra cruda',
    'Almendra natural',
    'Almendra tostada',
    // Carnes
    'Pechuga de pollo',
    'Muslo de pollo',
    'Ala de pollo',
    'Pollo',
    'Solomillo de cerdo',
    'Lomo de cerdo',
    'Carne picada de pollo',
    'Carne picada de ternera',
    'Huevo',
    'Huevos',
    // Lácteos
    'Leche entera',
    'Leche semidesnatada',
    'Leche desnatada',
    'Yogur griego natural',
    'Yogur natural',
    'Queso fresco',
    'Queso cottage',
    // Verduras
    'Espinacas',
    'Espinaca',
    'Brócoli',
    'Coliflor',
    'Lechuga',
    'Pimiento rojo',
    'Pimiento verde',
    'Calabaza',
    'Cebolla',
    'Zanahoria',
    // Frutas
    'Manzana',
    'Plátano',
    'Naranja',
    'Limón',
    'Aguacate',
    'Fresa',
    'Uvas',
    'Piña',
    'Mango',
    'Kiwi',
    'Pera',
    // Cereales
    'Avena',
    'Arroz blanco',
    'Arroz integral',
    'Pasta integral',
    'Pasta',
    'Pan integral',
    'Pan blanco',
    // Pescados
    'Salmón',
    'Atún',
    'Merluza',
    'Dorada',
    'Trucha',
    'Pez espada',
    // Legumbres
    'Garbanzos',
    'Lentejas',
    'Judías',
    'Alubias',
    // Otros
    'Chocolate negro',
    'Chocolate 85',
    'Cacao en polvo',
    'Miel',
    'Sirope de arce',
    'Levadura nutricional',
    'Proteína whey',
    'Proteína en polvo',
    'Clara de huevo',
    'Tomate natural',
    'Tomate triturado',
    'Tomate frito',
    'Pavo',
    'Jamón serrano',
    'Jamón york',
]

console.log('=== ALIMENTOS A VERIFICAR ===\n')

for (const nombre of buscar) {
    const { data } = await supabase
        .from('alimentos')
        .select('id, nombre, categoria')
        .ilike('nombre', `%${nombre}%`)
        .limit(5)

    if (data && data.length > 0) {
        const matches = data.map(a => `  ${a.nombre} (${a.categoria})`).join('\n')
        console.log(`✅ "${nombre}":\n${matches}\n`)
    } else {
        console.log(`❌ "${nombre}": NO ENCONTRADO\n`)
    }
}
