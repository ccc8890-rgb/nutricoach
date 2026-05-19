#!/usr/bin/env node
/**
 * Limpia productos_supermercado que referencian alimentos no comestibles
 * (alcohol, bebidas energéticas, cosmética, mascotas, etc.)
 *
 * También detecta productos cuyo nombre contiene keywords no comestibles
 * aunque el alimento_id apunte a algo comestible (scraping mal vinculado).
 *
 * Uso:
 *   node scripts/_limpiar-productos-no-comestibles.mjs --dry-run   # solo inspeccionar
 *   node scripts/_limpiar-productos-no-comestibles.mjs              # eliminar
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(PROJECT_ROOT, '.env.local')
    if (!existsSync(envPath)) { console.error('❌ No .env.local'); process.exit(1) }
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
        process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

// ─── Misma lógica que lib/scraping/index.ts ─────────────────────

const NO_COMESTIBLE_KEYWORDS = [
    'champú', 'champu', 'acondicionador', 'mascarilla capilar', 'sérum capilar',
    'gel de ducha', 'gel ducha', 'desodorante', 'antitranspirante', 'colonia', 'perfume', 'eau de parfum',
    'crema corporal', 'loción corporal', 'sorbete corporal', 'manteca corporal',
    'aceite corporal', 'crema reductora', 'anticelulítico', 'tratamiento reductor',
    'crema facial', 'sérum facial', 'contorno de ojos', 'parches para ojos',
    'gel de afeitar', 'espuma de afeitar', 'aftershave', 'after shave', 'maquinilla',
    'pasta de dientes', 'dentifrico', 'dentífrico', 'cepillo de dientes', 'enjuague bucal', 'hilo dental',
    'jabón de manos', 'champú seco',
    'tampón', 'tampones', 'compresas', 'salvaslip', 'protegeslip', 'copa menstrual',
    'preservativo', 'preservativos', 'lubricante sexual',
    'pañal', 'pañales', 'toallitas bebé', 'biberón', 'chupete', 'tetina',
    'cepillo limpiabiberón',
    'maquillaje', 'colorete', 'corrector maquillaje', 'base de maquillaje',
    'máscara de pestañas', 'delineador de ojos', 'sombra de ojos',
    'laca de uñas', 'tratamiento para uñas', 'rizador de pestañas',
    'aftersun', 'after sun',
    'agua micelar', 'agua facial', 'agua de peinado',
    'bálsamo labial', 'balsamo labial', 'protector labial',
    'barra labios', 'pintalabios', 'labial ',
    'body spray', 'body mist', 'body lotion', 'body milk',
    'antiestrias', 'anti-estrias', 'antiestrías',
    'protector solar', 'crema solar', 'spray solar', 'spf ',
    'sérum cabello', 'serum cabello', 'ampollas capilares', 'ampollas cabello',
    'ampollas tratamiento', 'ampollas flash',
    'aclarante cabello', 'tinte cabello', 'decolorante cabello',
    'mascarilla facial', 'exfoliante facial', 'desmaquillante',
    'bastoncillos', 'algodón hidrófilo', 'algodón mágico',
    'bandas depilatorias', 'cera depilatoria', 'crema depilatoria',
    'alicate uñas', 'lima uñas', 'cortauñas',
    'espuma cabello', 'laca cabello', 'fijador cabello',
    'aplicador sombra', 'pincel maquillaje',
    'auto bronceador', 'autobronceador', 'locion autobronceadora',
    'locion reafirmante', 'reafirmante corporal',
    'apósitos', 'apositos', 'apòsits',
    'tiritas', 'vendas', 'venda ',
    'suero fisiológico', 'ampollas suero',
    'arcos dentales', 'irrigador dental',
    'laxante', 'laxforte',
    'solución única lentes', 'lentes de contacto',
    'lágrimas hidratantes', 'lagrimas hidratantes',
    'spray desinfectante antiséptico', 'clorhexidina spray',
    'lejía', 'limpiador', 'limpiacristales', 'desengrasante', 'quitamanchas ropa',
    'detergente ropa', 'suavizante ropa', 'pastillas lavavajillas', 'gel lavavajillas',
    'limpiahogar', 'limpiavidrios', 'limpiagafas', 'lavaparabrisas',
    'bayeta', 'estropajo', 'fregona', 'bolsa basura', 'bolsas basura',
    'papel higiénico', 'papel de cocina', 'papel aluminio', 'papel vegetal', 'film transparente',
    'ambientador', 'difusor ambientador', 'insecticida', 'trampa ratas',
    'borrador mágico', 'cera multisuperficies', 'sosa cáustica',
    'alcohol 96', 'agua oxigenada', 'amoniaco',
    'abrillantador', 'quitagrasas', 'desincrustante', 'posavajillas',
    'rasqueta', 'multiusos', 'disuelve manchas', 'limpiajuntas',
    'limpiafondos', 'desatascador', 'desagües',
    'estropajo metálico', 'esponja metálica', 'limpiacoches', 'champú coche',
    'limpiador tapicerías', 'limpia alfombras', 'quitacal', 'antical',
    'limpiametales', 'lavaplatos', 'limpiador horno', 'limpiahornos',
    'limpiador baño', 'limpia baños', 'fregasuelos',
    'escoba', 'escobilla', 'plumero', 'recogedor', 'cubo fregona',
    'friegasuelos', 'limpia suelos', 'limpiador suelos',
    'absorbeolores', 'antipolilla', 'antipolillas',
    'repelente insectos', 'repelente mosquitos',
    'citronela colgador', 'pulsera citronela',
    'aditivo textil', 'quitamanchas prelavado', 'prelavado spray',
    'desinfectante textil', 'quitamanchas desinfectante',
    'comida perro', 'comida para perro', 'pienso perro', 'pienso para perro',
    'comida gato', 'comida para gato', 'pienso gato', 'pienso para gato',
    'comida húmeda perro', 'comida húmeda gato',
    'snack perro', 'snack para perro', 'snack gato', 'snack para gato',
    'hueso para perro',
    'arena gato', 'arena para gato', 'arenero',
    'leche polvo gato', 'leche maternizada gato',
    'antipulgas', 'antiparasitario',
    'shampoo perro',
    'pilas', 'batería ', 'cargador', 'bombilla', 'adaptador corriente',
    'pinza', 'brida', 'cinta adhesiva', 'pegamento',
    'tijeras', 'cúter',
    'candado', 'cerradura',
    'filtro agua', 'filtro de agua',
    'fundas cojín', 'funda cojín',
    'colgador', 'perchero', 'estante', 'balda',
    'vela aromática', 'vela decorativa', 'vela de cumpleaños', 'vela led',
    'mechero', 'encendedor',
    'cenicero', 'cigarrillos',
    'comida para peces', 'comida peces',
    'freidora de aire', 'freidora sin aceite',
    'microondas ', 'horno eléctrico', 'tostadora', 'sandwichera',
    'robot cocina',
    'pienso', 'comida perro', 'comida gato',
    'cama perro', 'cama gato',
    'juguete perro', 'juguete gato',
    'transportin', 'correa perro', 'arnés',
    'comedero perro', 'bebedero perro',
    'pechera perro', 'bozal',
    'caca perro', 'popo perro',
    'entrenamiento perro', 'educación perro',
    'mordedor perro', 'mordedor gato',
    'comedero', 'bebedero',
    'collar antiladridos',
    'pienso premium',
    'comida húmeda', 'comida seca',
    'alimento húmedo perro',
    'pienso cordero',
    'pienso salmón',
    'pienso pollo',
    'pienso natural',
    'comida natural perro',
    'comida natural gato',
    'barf perro', 'barf gato',
    'comida deshidratada perro',
    'hueso masticable',
    'snack dental perro',
    'snack dental gato',
    'golosina perro',
    'golosina gato',
    'leche maternizada',
    'leche perro',
    'leche gato',
    'lata perro',
    'lata gato',
    'dieta perro',
    'dieta gato',
    'higiène bucal gato',
    'pastas dentales mascotas',
    'cepillo dental mascotas',
    'galleta perro',
    'galleta gato',
    'kit comida',
    'tabaco', 'cigarro',
    'tornillo', 'tuerca', 'arandela', 'destornillador',
    'taladro', 'broca', 'alicate', 'llave inglesa',
    'cable eléctrico', 'enchufe', 'alargador',
    'linterna', 'candado', 'cerradura', 'bombilla',
    'plancha de vapor', 'aspirador', 'aspiradora',
    'picadora multifunción', 'robot aspirador',
    'cafetera superautomática', 'máquina de coser',
]

const BEBIDAS_NO_SALUDABLES_KEYWORDS = [
    'monster energy', 'monster ',
    'red bull', 'redbull',
    'burn energy', 'burn ',
    'rockstar energy',
    'hell energy',
    'boost energy',
    'te energy',
    'amper energy',
    'battery energy',
    'bullit energy',
    'dark dog',
    'enjoy energy',
    'free way energy',
    'go fast energy',
    'lifefuel',
    'megamon',
    'monster verde', 'monster azul', 'monster blanco', 'monster rojo',
    'monster mango', 'monster original',
    'mutant energy',
    'one energy shot',
    'panda energy',
    'playmatte energy',
    'pro tension',
    'pure energy',
    'red fire',
    'select energy',
    'spark energy',
    'speed energy',
    'tnt energy',
    'torque energy',
    'v energy',
    'viper energy',
    'volt energy',
    'wakal energy',
    'x-force energy',
    'x-raid energy',
    'zero effect',
    'bebida energética', 'bebida energetica',
    'energy drink',
    'calipo ',
    'cubata ',
    'destornillador ',
    'zumo fermentado',
    'hidromiel',
]

const ALCOHOL_KEYWORDS = [
    'cerveza', 'cervesa', 'cerveza sin', 'cerveza 0,0',
    'vino tinto', 'vino blanco', 'vino rosado', 'vino espumoso', 'vino dulce',
    'vino de jerez', 'vino generoso', 'vino ecologico', 'vino ecológico',
    'vi negre', 'vi blanc', 'vi rosat', 'vi escumós', 'vi dolc', 'vi ranci',
    'caixa vi ',
    'cava brut', 'cava semi', 'cava rosado', 'cava rosat', 'cava nature',
    'cava benjamín', 'cava pack',
    'whisky', 'whiskey', 'bourbon',
    'vodka',
    'ginebra', ' gin ',
    'tequila', 'mezcal',
    'brandy', 'coñac', 'cognac',
    'amaretto', 'absenta', 'absinthe',
    'ron añejo', 'ron blanco', 'ron negro', 'ron dorado', 'ron de caña',
    'licor de café', 'licor de menta', 'licor de hierbas', 'licor de naranja',
    'licor de almendra', 'licor de anís', 'aperitivo licor',
    'anís seco', 'anís dulce', 'anisete',
    'vermut', 'vermouth',
    'moscatel',
    'jerez fino', 'jerez oloroso', 'jerez amontillado',
    'oporto',
    'champán', 'champagne',
    'sidra',
    'sangría', 'sangria',
    'tinto de verano',
    'bebida preparada de ron', 'bebida preparada de vodka', 'bebida preparada de gin',
    'carajillo de ron',
    'cerveza tostada', 'cerveza rubia', 'cerveza negra',
    'cerveza artesana', 'cerveza artesanal',
    'pack cerveza', 'lata cerveza',
    'vino variedad', 'vino crianza', 'vino reserva', 'vino gran reserva',
    'vino de la tierra', 'vino de pago',
    'botella vino', 'botella de vino',
    'canasta de vino',
    'vino de aguja',
    'vino de hielo',
    'vino naranja',
    'vino de naranja',
    'clarete',
    'mosto de uva',
    'vinagre de vino',
    'cerveza 0.0', 'cerveza 0,0%', 'cerveza 0.0%',
]

const ALCOHOL_FOOD_EXCEPTIONS = [
    'al vino', 'en vino', 'con vino', 'estofado', 'guiso',
    'al licor', 'bombones', 'trufas', 'pralinés',
    'al ron', 'flambead',
    'vinagre',
    'vitamina',
    'pasas',
    'uva moscatel', 'uvas moscatel',
]

const COMESTIBLE_EXCEPTIONS = [
    'jabón con glicerina',
    'palomitas microondas', 'palomitas para microondas',
    'para microondas',
    'brócoli microondas', 'brocoli microondas',
    'coliflor microondas',
    'verduras microondas',
    'patatas microondas', 'batatas microondas',
    'patata microondas', 'batata microondas',
    'verdura microondas',
    'vegetales microondas',
    'sazonador ',
    'coliflor-brócoli-zanahoria microondas',
    'floretas de',
    'spray para freidora', 'spray freidora',
    'spray especial freidora',
    'aceite para freidora',
]

function esProductoNoComestible(nombre) {
    const lower = nombre.toLowerCase()

    const tieneVatios = /\d{3,}\s*w/i.test(lower) || /\(w\)/i.test(lower)
    if (tieneVatios) return true

    const matchKw = NO_COMESTIBLE_KEYWORDS.find(kw => lower.includes(kw))
    if (matchKw) {
        if (matchKw.includes('dosificador') && lower.includes('miel')) return false
        if (matchKw === 'grill' && (lower.includes('brocheta') || lower.includes('minigrill')
            || lower.includes('tostada') || lower.includes('biscotes'))) return false
        if (matchKw.trim() === 'vela' && lower.includes('chorizo')) return false
        if (matchKw.includes('jabón') && lower.includes('glicerina')) return false
        if ((matchKw.includes('freidora') || matchKw.includes('microondas'))
            && COMESTIBLE_EXCEPTIONS.some(ex => lower.includes(ex))) {
            return false
        }
        return true
    }

    const tieneExcepcion = ALCOHOL_FOOD_EXCEPTIONS.some(ex => lower.includes(ex))
    if (!tieneExcepcion && ALCOHOL_KEYWORDS.some(kw => lower.includes(kw))) return true

    if (BEBIDAS_NO_SALUDABLES_KEYWORDS.some(kw => lower.includes(kw))) return true

    return false
}

async function fetchAllProductos() {
    const all = []
    let from = 0
    const limit = 1000
    while (true) {
        const { data, error } = await supabase
            .from('productos_supermercado')
            .select('id, nombre_original, url_producto, supermercado_id, alimento_id, created_at')
            .range(from, from + limit - 1)
            .order('id')

        if (error) { console.error('❌ Error:', error.message); break }
        if (!data || data.length === 0) break
        all.push(...data)
        from += limit
    }
    return all
}

async function fetchAlimentosMap() {
    const { data } = await supabase.from('alimentos').select('id, nombre, es_comestible')
    const map = new Map()
    if (data) for (const a of data) map.set(a.id, a)
    return map
}

async function main() {
    console.log(`${CYAN}══════════════════════════════════════════════════════════${RESET}`)
    console.log(`${CYAN}  🧹 Limpieza de productos_supermercado no comestibles${RESET}`)
    console.log(`${CYAN}══════════════════════════════════════════════════════════${RESET}`)
    console.log(`Dry-run: ${DRY_RUN ? 'SÍ' : 'NO'}\n`)

    const [productos, alimentosMap] = await Promise.all([
        fetchAllProductos(),
        fetchAlimentosMap(),
    ])

    console.log(`📦 Total productos_supermercado: ${productos.length}`)
    console.log(`📦 Total alimentos (referencia): ${alimentosMap.size}\n`)

    // Categorías de limpieza
    const candidatosAEliminar = []

    for (const p of productos) {
        const alimento = alimentosMap.get(p.alimento_id)
        const nombreAlimento = alimento?.nombre || '(desconocido)'
        const esComestible = alimento?.es_comestible

        // Caso 1: El alimento vinculado ya está marcado como no comestible
        if (esComestible === false) {
            candidatosAEliminar.push({
                ...p,
                motivo: `alimento "${nombreAlimento}" marcado como no comestible`,
                nombreAlimento,
            })
            continue
        }

        // Caso 2: El nombre del producto contiene keyword no comestible
        // (scraping mal vinculado: producto no comestible linkeado a alimento comestible)
        if (esProductoNoComestible(p.nombre_original)) {
            candidatosAEliminar.push({
                ...p,
                motivo: `nombre de producto contiene keyword no comestible (alimento vinculado: "${nombreAlimento}")`,
                nombreAlimento,
            })
            continue
        }
    }

    if (candidatosAEliminar.length === 0) {
        console.log(`${GREEN}✓ No hay productos que limpiar.${RESET}`)
        return
    }

    // Agrupar por motivo para mejor reporte
    const porMotivo = {}
    for (const c of candidatosAEliminar) {
        const key = c.motivo.includes('marcado como no comestible') ? 'alimento_no_comestible' : 'keyword_en_nombre'
        if (!porMotivo[key]) porMotivo[key] = []
        porMotivo[key].push(c)
    }

    if (porMotivo.alimento_no_comestible) {
        console.log(`${YELLOW}🔗 Productos con alimento marcado como no comestible (${porMotivo.alimento_no_comestible.length}):${RESET}`)
        for (const c of porMotivo.alimento_no_comestible) {
            console.log(`   [${c.id}] "${c.nombre_original}" → alimento: "${c.nombreAlimento}" (${c.alimento_id.slice(0, 8)})`)
        }
        console.log()
    }

    if (porMotivo.keyword_en_nombre) {
        console.log(`${YELLOW}🏷️  Productos con keyword no comestible en nombre (${porMotivo.keyword_en_nombre.length}):${RESET}`)
        for (const c of porMotivo.keyword_en_nombre) {
            console.log(`   [${c.id}] "${c.nombre_original}" → alimento: "${c.nombreAlimento}" (${c.alimento_id.slice(0, 8)})`)
        }
        console.log()
    }

    console.log(`${CYAN}Total a eliminar: ${candidatosAEliminar.length} filas${RESET}`)

    if (DRY_RUN) {
        console.log(`\n${YELLOW}🏁 Dry-run — no se modificó nada.${RESET}`)
        console.log(`Para eliminar: node scripts/_limpiar-productos-no-comestibles.mjs`)
        return
    }

    // Confirmación interactiva
    console.log(`\n${RED}⚠️  ATENCIÓN: Se eliminarán ${candidatosAEliminar.length} registros de productos_supermercado.${RESET}`)
    console.log(`Pulsa Ctrl+C para cancelar o espera 5 segundos para continuar...`)
    await new Promise(r => setTimeout(r, 5000))

    // Eliminar en lotes
    let ok = 0, err = 0
    const LOTE = 100
    for (let i = 0; i < candidatosAEliminar.length; i += LOTE) {
        const ids = candidatosAEliminar.slice(i, i + LOTE).map(c => c.id)
        const { error } = await supabase
            .from('productos_supermercado')
            .delete()
            .in('id', ids)

        if (error) {
            console.error(`   ${RED}✗${RESET} Lote ${i / LOTE + 1}: ${error.message}`)
            err += ids.length
        } else {
            console.log(`   ${GREEN}✓${RESET} Lote ${i / LOTE + 1}: ${ids.length} eliminados`)
            ok += ids.length
        }
    }

    console.log(`\n${GREEN}✅ Limpieza completada${RESET}`)
    console.log(`   Eliminados: ${ok}`)
    console.log(`   Errores: ${err}`)
    console.log(`\n💡 Ahora ejecuta backfill para marcar alimentos como no comestibles:`)
    console.log(`   node scripts/backfill-es-comestible.mjs --aplicar`)
    console.log(`   node scripts/backfill-es-comestible.mjs --sql (solo ver SQL)`)
}

main().catch(e => { console.error('💥', e.message); process.exit(1) })
