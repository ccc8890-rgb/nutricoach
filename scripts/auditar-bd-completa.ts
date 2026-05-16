/**
 * auditar-bd-completa.ts — Auditoría masiva de TODA la BD
 *
 * Escanea productos_supermercado en busca de:
 * 1. Falsos positivos (productos no comestibles)
 * 2. Productos sin alimento_id
 * 3. Duplicados por supermercado
 *
 * Uso: npx tsx --env-file=.env.local scripts/auditar-bd-completa.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

// ── MISMO FILTRO QUE index.ts (sincronizado) ─────────────────────

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
    'discos desmaquillantes', 'discos de algodón',
    'esponja exfoliante', 'esponja facial',
    'cepillos para el cabello', 'cepillo para el cabello', 'peine',
    'plancha de pelo', 'secador de pelo', 'rizador de pelo',
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
    'limpia mopas', 'spray limpiamopas', 'recambio mopa',
    'gamuzas impregnadas', 'gamuzas atrapapolvo',
    'blanqueador juntas',
    'cuaderno', 'bolígrafo', 'boligrafo', 'rotulador', 'subrayador',
    'pegamento', 'celo', 'cinta adhesiva', 'tijeras', 'grapadora',
    'pilas', 'bombilla', 'vela ', 'mechero', 'cerilla',
    'clip', 'grapas', 'goma de borrar',
    'guantes desechables', 'mascarilla quirúrgica', 'mascarillas quirúrgicas', 'cubrecalzado',
    'candado', 'cerradura', 'bombona', 'butano', 'propano',
    'bandeja cartón', 'bandeja carton', 'bandeja papel',
    'bol biodegradable', 'plato biodegradable', 'plato desechable',
    'cubiertos desechables', 'vasos desechables', 'pajitas',
    'bolsas papel bocadillo', 'bolsa isotérmica', 'bolsa isotermica',
    'bolsa de rafia', 'bolsa reutilizable', 'bolsas reutilizables',
    'barreño', 'barren ovalado', 'almohadilla inferior',
    'sacapuntas',
    'comida para gato', 'comida para perro', 'pienso', 'arena para gato', 'arena gatos',
    'snack para perro', 'snack para gato', 'gatos adulto', 'caninos',
    'aritos perro', 'cepillo mascotas', 'toallitas mascotas',
    'empapadores mascotas', 'lecho mascotas', 'pinza animales',
    'recambio eléctrico mascotas', 'recambio ectrico mascotas',
    'bañador desechable', 'banador desechable',
    'babero desechable', 'anillo denticion',
    'aparato eléctrico', 'aparato ectrico', 'aparato ecttrico',
    'recambio eléctrico', 'recambio ectrico',
    'espumador de leche', 'cafetera', 'batidora',
    'freidora de aceite', 'freidora eléctrica', 'freidora de aire',
    'microondas ',
    'microondas con', 'microondas de', 'microondas digital', 'microondas integrado',
    'horno microondas', 'microondas grill',
    'hervidor de agua', 'licuadora', 'exprimidor',
    'máquina para hacer pasta', 'palomitero', 'cocedor de huevos',
    'cuecehuevos', 'grill', 'olla eléctrica', 'olla de cocción',
    'fuente de chocolate', 'fondue eléctrica',
    'herramienta multifunción', 'herramienta de diagnóstico',
    'mini nevera', 'mininevera',
    'hervidor ',
    'juguete', 'de juguete', 'caja registradora',
    'cuchillo de cocina', 'sartén ', 'set de cuencos',
    'bolsa térmica', 'bolsa para aparejos',
    'recipiente para alimentos', 'recipientes para alimentos',
    'recipientes con tapa', 'set de recipientes',
    'caja de accesorios para',
    'hervidor de agua con', 'hervidor de agua de',
    'hervidor de agua 3', 'hervidor de agua 2',
    'cubertería', 'cuberteria',
    'tazas', 'platillo', 'dosificador', 'dosificador de',
    'envasadora al vacío', 'envasadora al vacio',
    'máquina para pasta', 'maquina para pasta',
    'accesorios para manguera',
    'pachira', 'schefflera', 'drácena', 'anturio',
    'arbusto', 'bonsái', 'bonsai',
    'spa de pies', 'spa pies',
    'croquetas perro', 'croquetas gato', 'comida perro', 'comida gato',
    'snack para perro', 'snack para gato', 'pienso para',
    'cuenco', 'cuencos',
    'robot de cocina', 'monsieur cuisine', 'cuisine smart',
    'kitchen tools',
    'calcetines', 'calcetín', 'chaqueta', 'edredón', 'edredon',
    'almohada', 'bufanda', 'gorro', 'guantes', 'vestido',
    'pantalón', 'pantalon', 'ropa de cama', 'funda nórdica',
    'cojín', 'cojin', 'sábanas', 'sabana', 'cortina', 'toalla',
    'toallas', 'camiseta', 'polar térmica', 'polar térmico',
    'abrigo', 'bañador', 'banador', 'bikini', 'piel de cordero',
    'maceta', 'tierra para plantas', 'planta decorativa',
    'planta artificial', 'flor artificial', 'portavelas',
    'marco foto', 'cuadro decorativo', 'espejo',
    'adorno decorativo', 'percha', 'perchero', 'balda',
    'estantería', 'estante', 'cesta de almacenaje',
    'cestas de', 'cestos',
    'pájaro decorativo', 'pajaro decorativo',
    'botes de almacenamiento', 'bote de almacenamiento',
    'tarros de especias', 'tarro de especias',
    'organizador de', 'organizador para',
    'estuche guardar', 'caja organizador', 'caja de accesorios',
    'abrelatas', 'tabla de cortar', 'tablas de cortar',
    'utensilios de cocina', 'utensilio de cocina',
    'quesera', 'set de pulverizadores', 'pulverizador',
    'muñeco', 'muñeca', 'peluche', 'piezas encajables',
    'juegos de madera', 'juego de madera', 'construcción',
    'de dinosaurio', 'de dinosaurios', 'encajable',
    'arenero', 'tobogán', 'tobogan', 'columpio',
    'set de pesca', 'caña de pescar', 'caña spinning', 'pesca spinning',
    'tren de madera', 'tren de juguete', 'tren de pasajeros',
    'disco de corte', 'disco corte', 'cepillos de alambre',
    'puntas de amolar', 'punta amolar',
    'tornillo', 'tuerca', 'arandela', 'destornillador',
    'taladro', 'broca', 'alicate', 'llave inglesa',
    'cable eléctrico', 'enchufe', 'alargador',
    'linterna',
    'plancha de vapor', 'aspirador', 'aspiradora',
    'picadora multifunción', 'robot aspirador',
    'cafetera superautomática', 'máquina de coser',
]

const ALCOHOL_KEYWORDS = [
    'cerveza', 'cervesa',
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
    'jerez fino', 'jerez oloroso', 'jerez amontillado',
    'champán', 'champagne',
    'sidra',
    'sangría', 'sangria',
    'tinto de verano',
    'bebida preparada de ron', 'bebida preparada de vodka', 'bebida preparada de gin',
]

const ALCOHOL_FOOD_EXCEPTIONS = [
    'al vino', 'en vino', 'con vino', 'estofado', 'guiso',
    'al licor', 'bombones', 'trufas',
    'al ron', 'flambead',
    'vinagre',
    'vitamina',
    'pasas',
    'uva moscatel', 'uvas moscatel',
]

const COMESTIBLE_EXCEPTIONS = [
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
    'spray para freidora', 'spray freidora', 'spray especial freidora',
    'aceite para freidora',
]

function esNoComestible(nombre: string): boolean {
    const lower = nombre.toLowerCase()
    const tieneVatios = /\d{3,}\s*w/i.test(lower) || /\(w\)/i.test(lower)
    if (tieneVatios) return true
    const matchKw = NO_COMESTIBLE_KEYWORDS.find(kw => lower.includes(kw))
    if (matchKw) {
        // Excepciones para dosificador + miel (la miel con dosificador es comida)
        if (matchKw.includes('dosificador') && lower.includes('miel')) return false
        // Excepciones para grill + brocheta/minigrill/tostadas/biscotes (comida a la plancha)
        if (matchKw === 'grill' && (lower.includes('brocheta') || lower.includes('minigrill')
            || lower.includes('tostada') || lower.includes('biscotes'))) return false
        // Excepción para vela + chorizo (chorizo extra vela dulce)
        if (matchKw.trim() === 'vela' && lower.includes('chorizo')) return false
        if ((matchKw.includes('freidora') || matchKw.includes('microondas'))
            && COMESTIBLE_EXCEPTIONS.some(ex => lower.includes(ex))) {
            return false
        }
        return true
    }
    const tieneExcepcion = ALCOHOL_FOOD_EXCEPTIONS.some(ex => lower.includes(ex))
    if (!tieneExcepcion && ALCOHOL_KEYWORDS.some(kw => lower.includes(kw))) return true
    return false
}

// ── MAIN ──────────────────────────────────────────────────────────

interface FalsoPositivo {
    id: string
    supermercado_nombre: string
    nombre_original: string
    keyword_match: string
    url?: string
    created_at: string
}

async function getAllProductos(supermercadoId: string): Promise<any[]> {
    const all: any[] = []
    let page = 0
    while (true) {
        const from = page * 1000
        const to = from + 999
        const { data } = await supabase
            .from('productos_supermercado')
            .select('id, nombre_original, url_producto, alimento_id, created_at, supermercado_id')
            .eq('supermercado_id', supermercadoId)
            .order('id')
            .range(from, to)
        if (!data || data.length === 0) break
        all.push(...data)
        page++
        if (data.length < 1000) break
    }
    return all
}

async function main() {
    console.log('\n╔═══════════════════════════════════════════════════╗')
    console.log('║  AUDITORÍA COMPLETA — SOLO ALIMENTOS              ║')
    console.log('╚═══════════════════════════════════════════════════╝')
    console.log(`Inicio: ${new Date().toLocaleString('es-ES')}\n`)

    const { data: supermercados } = await supabase
        .from('supermercados')
        .select('id, nombre, slug')
        .order('nombre')

    if (!supermercados?.length) { console.log('No hay supermercados en BD.'); return }

    console.log(`Supermercados: ${supermercados.length}\n`)

    let totalProductos = 0
    let totalFalsos = 0
    let totalSinAlimento = 0
    let totalDuplicados = 0
    const todosFalsos: FalsoPositivo[] = []

    for (const sm of supermercados) {
        const productos = await getAllProductos(sm.id)
        const countProd = productos.length
        totalProductos += countProd
        const indicator = countProd === 0 ? '📭' : '📦'
        console.log(`${indicator} ${sm.nombre}: ${countProd}`)

        if (!productos.length) continue

        for (const p of productos) {
            const nombre = p.nombre_original ?? ''
            if (esNoComestible(nombre)) {
                let kw = NO_COMESTIBLE_KEYWORDS.find(k => nombre.toLowerCase().includes(k))
                if (!kw) kw = ALCOHOL_KEYWORDS.find(k => nombre.toLowerCase().includes(k))
                todosFalsos.push({
                    id: p.id,
                    supermercado_nombre: sm.nombre,
                    nombre_original: nombre,
                    keyword_match: kw ?? '?',
                    url: p.url_producto,
                    created_at: p.created_at
                })
                totalFalsos++
            }
        }

        const sinAlimento = productos.filter(p => !p.alimento_id)
        if (sinAlimento.length > 0) {
            console.log(`       ⚠️  ${sinAlimento.length} sin alimento_id`)
            totalSinAlimento += sinAlimento.length
        }

        const groups = new Map<string, string[]>()
        for (const p of productos) {
            const key = (p.nombre_original ?? '').toLowerCase().trim()
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key)!.push(p.id)
        }
        const dups = Array.from(groups.entries()).filter(([, ids]) => ids.length > 1)
        if (dups.length > 0) {
            const extra = dups.reduce((s, [, ids]) => s + ids.length - 1, 0)
            console.log(`       🔄 ${extra} duplicados extra (${dups.length} nombres repetidos)`)
            totalDuplicados += extra
        }
    }

    console.log('\n╔═══════════════════════════════════════════════════╗')
    console.log('║  RESUMEN                                         ║')
    console.log('╚═══════════════════════════════════════════════════╝')
    console.log(`  Total:         ${totalProductos}`)
    console.log(`  No comestibles: ${totalFalsos}`)
    console.log(`  Sin alimento:   ${totalSinAlimento}`)
    console.log(`  Duplicados:     ${totalDuplicados}`)
    console.log('')

    if (todosFalsos.length > 0) {
        console.log('╔═══════════════════════════════════════════════════╗')
        console.log('║  POSIBLES NO-COMESTIBLES (revisar)               ║')
        console.log('╚═══════════════════════════════════════════════════╝')
        const bySm = new Map<string, FalsoPositivo[]>()
        for (const f of todosFalsos) {
            if (!bySm.has(f.supermercado_nombre)) bySm.set(f.supermercado_nombre, [])
            bySm.get(f.supermercado_nombre)!.push(f)
        }
        for (const [sm, fpos] of bySm) {
            console.log(`\n  ${sm} (${fpos.length}):`)
            for (const f of fpos) {
                console.log(`    [${f.keyword_match}] → ${f.nombre_original}`)
            }
        }
    }

    console.log(`\nFin: ${new Date().toLocaleString('es-ES')}`)
}

main().catch(console.error)
