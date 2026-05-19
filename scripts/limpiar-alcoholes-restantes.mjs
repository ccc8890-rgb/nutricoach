// 🧹 Elimina alcoholes reales restantes con 0 referencias FK
// Uso: node scripts/limpiar-alcoholes-restantes.mjs
// --dry-run: modo simulación (no borra)

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const DRY_RUN = process.argv.includes('--dry-run')

// ── Cargar env ──
const envPath = resolve(process.cwd(), '.env.local')
const envRaw = readFileSync(envPath, 'utf-8')
for (const line of envRaw.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

// ── Normalización (misma que en limpiar-todo-alimentos) ──
function n(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// ── Palabras que indican que NO es alcohol aunque coincida con patrón ──
const FALSE_POSITIVE_KEYWORDS = [
    'cavalla',           // mackerel (caballa)
    'vinagre',           // vinegar
    'cigron',            // chickpea
    'macarr',            // pasta (macarrones, macarrons)
    'spaguet',           // spaghetti
    'plumas',            // pasta type
    'tiburon',           // shark
    'pepperoni',         // cured meat
    'botifarr',          // sausage
    'boqueron',          // anchovy
    'rondanxa',          // fish product
    'maasdam',           // cheese
    'tonyina',           // tuna
    'pasas moscatel',    // raisins
    'queso de cava',     // cheese (named after region, not beverage)
    'queso la cava',     // cheese
    'queso tierno',      // cheese
    'queso lonchas',     // cheese
    'queso bola',        // cheese
    'aceite solar',      // sunscreen
    'lanjaron',          // water brand (contains 'ron')
    'agua colonia',      // cologne
    'pasta dental',      // toothpaste
    'capsulas acido',    // supplements
    'collagen',          // supplements
    'hialuronico',       // supplements/hygiene
    'chipiron',          // baby squid
    'cigronet',          // legume
    'mongeta',           // legume
    'taronja',           // orange
    'melindros',         // pastry
    'croissant',         // pastry
    'melmelada',         // jam
    'poma golden',       // apple
    'taronges',          // oranges
    'smoothie',          // smoothie (not alcohol)
    'crunch',            // cereal
    'bloque turron',     // turron (contains 'ron')
    'cereales',          // cereals
    'cacao',             // cocoa
    'peiron',            // brand (bakery)
    'ensaimada',         // pastry
    'carrilladas',       // cooked pork cheeks (al vino is a recipe)
    'chucrut',           // sauerkraut (al vino blanco is cooked)
    'alcaparrones',      // capers (en vinagre)
    'crema lambrusco',   // vinegar condiment, not alcohol
    'boquerones al vinagre', // anchovies in vinegar
    'boquerones en vinagre', // anchovies in vinegar
    'aceite oliva',      // olive oil
    'barritas',          // snack bars
    'xoric',             // sausage
    'pizza',             // pizza
    'maccheroni',        // pasta
    'nescafe latte',     // coffee mix with baileys flavor
    'infisport',         // supplements
    'salmon',            // salmon
    'atunlo',            // tuna brand
    'lluc',              // fish (hake)
    'melva',             // fish
    'palometa',          // fish
    'bacall',            // cod
    'pollo',             // chicken
    'merluza',           // hake
    'lubina',            // sea bass
    'dorada',            // sea bream
]

function esFalsoPositivo(nombre) {
    const name = n(nombre)
    return FALSE_POSITIVE_KEYWORDS.some(kw => name.includes(kw))
}

// ── Categorías que consideramos "alcohol real" ──
const ALCOHOL_KEYWORDS = [
    // Vinos
    'vino tinto', 'vino blanco', 'vino rosado', 'vino rosat',
    'vino fino', 'vino dulce', 'vino de mesa',
    // Cervezas
    'cerveza', 'cerveza sin', 'cervesa',
    // Espumosos
    'cava', 'prosecco', 'champán', 'champagne', 'lambrusco',
    // Destilados
    'whisky', 'whiskey', 'ginebra', 'gin ', 'vodka', 'tequila',
    'ron ', 'ron añejo', 'ron caribeño', 'ron dominicano', 'ron nejo',
    'brandi', 'cognac', 'coñac',
    // Licores
    'licor ', 'licor crema', 'licor de', 'licor hierbas',
    'anisete', 'pacharan', 'ouzo',
    // Vermuts
    'vermú', 'vermut',
    // Vinos generosos
    'jerez', 'moscatel',
    // Preparados
    'bebida preparada ron',
    // Otros
    'aguardiente', 'absenta',
    'baileys', 'amaretto', 'martini',
    'sidra',
    // Marcas específicas
    'cacciatora prosecco', 'mionetto', 'dell\'emilia lambrusco',
    'solera 1866', 'mascaro brandi',
    'recompensa ice', 'recompensa ron',
    'ice cuvee rosado',
]

function esAlcoholReal(nombre) {
    const lowered = nombre.toLowerCase()
    return ALCOHOL_KEYWORDS.some(kw => lowered.includes(kw))
}

// ── Cosas que NO son bebidas alcohólicas pero que se cuelan ──
const EXCEPTIONS = [
    // Recetas cocinadas con vino
    'carrilladas de cerdo al vino',
    'carrilladas al vino',
    'chucrut al vino blanco',
    // Vinagres (ya cubierto por FALSE_POSITIVE_KEYWORDS)
    // Pasas
    'pasas moscatel',
]

function esExcepcion(nombre) {
    const lowered = nombre.toLowerCase()
    return EXCEPTIONS.some(e => lowered.includes(e))
}

// ── Main ──
async function main() {
    console.log(`🧹 Modo: ${DRY_RUN ? '📋 SIMULACIÓN (dry-run)' : '🔥 ELIMINACIÓN REAL'}\n`)

    // Obtener TODOS los items que coinciden con patrones de alcohol
    const patterns = [
        '%vino%', '%cerveza%', '%licor%', '%pacharan%', '%lambrusco%',
        '%prosecco%', '%whisky%', '%ginebra%', '%ron%', '%anisete%',
        '%cava%', '%sidra%', '%vermú%', '%vermut%', '%jerez%',
        '%moscatel%', '%champán%', '%champagne%', '%coñac%', '%cognac%',
        '%vodka%', '%tequila%', '%brandi%', '%ouzo%', '%amaretto%',
        '%baileys%', '%martini%', '%aguardiente%', '%absenta%'
    ]

    const orClauses = patterns.map(p => `nombre.ilike.${p}`).join(',')
    const { data: all, error } = await supabase.from('alimentos').select('id,nombre,categoria,calorias').or(orClauses)

    if (error) { console.error('Error fetching:', error); return }
    if (!all || all.length === 0) { console.log('✅ No se encontraron items. Nada que hacer.'); return }

    console.log(`📦 Total items con patrones de alcohol: ${all.length}`)
    console.log(`   (la mayoría son falsos positivos como vinagre, pasta, legumbres, etc.)\n`)

    // Filtrar: solo alcoholes reales que no sean excepciones ni falsos positivos
    const candidatos = all.filter(a =>
        esAlcoholReal(a.nombre) && !esExcepcion(a.nombre) && !esFalsoPositivo(a.nombre)
    )

    console.log(`🍷 Alcoholes reales detectados: ${candidatos.length}\n`)

    // Mostrar tabla
    for (const a of candidatos) {
        const { nombre, categoria, calorias } = a
        console.log(`  [${categoria ?? '?'}] ${nombre} (cal: ${calorias ?? '?'})`)
    }

    if (candidatos.length === 0) {
        console.log('\n✅ No hay alcoholes reales para eliminar.')
        return
    }

    console.log('')

    // Verificar referencias y eliminar
    let eliminados = 0
    let conRefs = 0
    let errores = 0

    for (let i = 0; i < candidatos.length; i += 200) {
        const batch = candidatos.slice(i, i + 200)

        for (const a of batch) {
            // Check FK refs
            let refs = 0
            for (const t of ['receta_ingredientes', 'comida_alimentos', 'productos_supermercado']) {
                const { count } = await supabase.from(t).select('id', { count: 'exact', head: true }).eq('alimento_id', a.id)
                refs += count ?? 0
            }

            if (refs > 0) {
                console.log(`  ⏭️  [${refs} refs] ${a.nombre} — tiene referencias, se conserva`)
                conRefs++
                continue
            }

            if (DRY_RUN) {
                console.log(`  📋 [SIMULACIÓN] Se eliminaría: ${a.nombre}`)
                eliminados++
            } else {
                const { error: delErr } = await supabase.from('alimentos').delete().eq('id', a.id)
                if (delErr) {
                    console.error(`  ❌ Error al eliminar ${a.nombre}: ${delErr.message}`)
                    errores++
                } else {
                    console.log(`  ✅ Eliminado: ${a.nombre}`)
                    eliminados++
                }
            }
        }
    }

    console.log(`\n📊 RESUMEN:`)
    console.log(`  Total alcoholes reales detectados: ${candidatos.length}`)
    console.log(`  Eliminados: ${eliminados}`)
    console.log(`  Con referencias (conservados): ${conRefs}`)
    console.log(`  Errores: ${errores}`)
    console.log(`  Operación: ${DRY_RUN ? '📋 SIMULACIÓN' : '🔥 REAL'}`)
}

main().catch(console.error)
