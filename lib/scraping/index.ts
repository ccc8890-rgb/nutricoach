import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarProducto } from './normalizador'
import { matchAlimentoInMemory, cargarAlimentosMap, AlimentoRecord } from './matcher'
import { categorizarAlimento } from './categorizador'
import { scrapearMercadona } from './supermercados/mercadona'
import { scrapearCarrefour } from './supermercados/carrefour'
import { scrapearDia } from './supermercados/dia'
import { scrapearAlcampo } from './supermercados/alcampo'
import { scrapearConsum } from './supermercados/consum'
import { scrapearLidl } from './supermercados/lidl'
import { scrapearEroski } from './supermercados/eroski'
import { scrapearElCorteIngles } from './supermercados/el-corte-ingles'
import { scrapearHipercor } from './supermercados/hipercor'
import { scrapearBonpreu } from './supermercados/bonpreu'
import { scrapearEsclat } from './supermercados/esclat'
import type { ResultadoScraping } from '@/types'
import type { ProductoRaw } from './types'

// ── Filtro de productos no comestibles ──────────────────────────

// ✅ Script eliminar-no-alimentos.mjs eliminado — mantener solo aquí
const NO_COMESTIBLE_KEYWORDS = [
    // ── Higiene personal ────────────────────────────────────────
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
    // Cosmética / belleza (ampliado)
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
    // Sanidad / farmacia
    'apósitos', 'apositos', 'apòsits',
    'tiritas', 'vendas', 'venda ',
    'suero fisiológico', 'ampollas suero',
    'arcos dentales', 'irrigador dental',
    'laxante', 'laxforte',
    'solución única lentes', 'lentes de contacto',
    'lágrimas hidratantes', 'lagrimas hidratantes',
    'spray desinfectante antiséptico', 'clorhexidina spray', 'clorhexidina',
    // ── Limpieza hogar ──────────────────────────────────────────
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
    // Limpieza (ampliado)
    'absorbeolores', 'antipolilla', 'antipolillas',
    'repelente insectos', 'repelente mosquitos',
    'citronela colgador', 'pulsera citronela',
    'aditivo textil', 'quitamanchas prelavado', 'prelavado spray',
    'desinfectante textil', 'quitamanchas desinfectante',
    'limpia mopas', 'spray limpiamopas', 'recambio mopa',
    'gamuzas impregnadas', 'gamuzas atrapapolvo',
    'blanqueador juntas',
    // ── Menaje / descartables ───────────────────────────────────
    'cuaderno', 'bolígrafo', 'boligrafo', 'rotulador', 'subrayador',
    'pegamento', 'cinta adhesiva', 'tijeras', 'grapadora',
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
    // ── Mascotas ───────────────────────────────────────────────
    'comida para gato', 'comida para perro', 'pienso', 'arena para gato', 'arena gatos',
    'snack para perro', 'snack para gato', 'gatos adulto', 'caninos',
    'aritos perro', 'cepillo mascotas', 'toallitas mascotas',
    'empapadores mascotas', 'lecho mascotas', 'pinza animales',
    'recambio eléctrico mascotas', 'recambio ectrico mascotas',
    // ── Bebé (no alimenticio) ───────────────────────────────────
    'bañador desechable', 'banador desechable',
    'babero desechable', 'anillo denticion',
    // ── Electrónica / aparatos ──────────────────────────────────
    'aparato eléctrico', 'aparato ectrico', 'aparato ecttrico',
    'recambio eléctrico', 'recambio ectrico',
    // Electrodomésticos de cocina (Lidl mezcla con comida)
    'espumador de leche', 'cafetera', 'batidora', 'freidora de aceite', 'freidora eléctrica',
    'microondas con', 'microondas de', 'microondas digital', 'microondas integrado',
    'horno microondas', 'microondas grill',
    'hervidor de agua', 'licuadora', 'exprimidor',
    'máquina para hacer pasta', 'palomitero', 'cocedor de huevos',
    'cuecehuevos', 'grill', 'olla eléctrica', 'olla de cocción',
    'fuente de chocolate', 'fondue eléctrica',
    'herramienta multifunción', 'herramienta de diagnóstico',
    'mini nevera', 'mininevera',
    'hervidor ', // hervidor de agua
    // Juguetes (Lidl vende juguetes de comida)
    'juguete', 'de juguete', 'caja registradora',
    // Menaje no alimenticio
    'cuchillo de cocina', 'sartén ', 'set de cuencos',
    'bolsa térmica', 'bolsa para aparejos',
    'recipiente para alimentos', 'recipientes para alimentos',
    'recipientes con tapa', 'set de recipientes',
    'caja de accesorios para',
    'hervidor de agua con', 'hervidor de agua de',
    'hervidor de agua 3', 'hervidor de agua 2',
    // Potencia en vatios — Lidl incluye electrodomésticos en resultados de comida
    // Menaje extra que Lidl mezcla con comida
    'cubertería', 'cuberteria',
    'tazas', 'platillo', 'dosificador', 'dosificador de',
    'envasadora al vacío', 'envasadora al vacio',
    'máquina para pasta', 'maquina para pasta',
    'accesorios para manguera',
    // Plantas (Lidl vende plantas en la sección de hogar)
    'pachira', 'schefflera', 'drácena', 'anturio',
    'arbusto', 'bonsái', 'bonsai',
    'spa de pies', 'spa pies',
    // Mascotas — Lidl vende comida de mascota mezclada con comida humana
    'croquetas perro', 'croquetas gato', 'comida perro', 'comida gato',
    'snack para perro', 'snack para gato', 'pienso para',
    'cuenco', 'cuencos',
    'robot de cocina', 'monsieur cuisine', 'cuisine smart',
    'kitchen tools',
    // ── Ropa y textil (Lidl vende mucha ropa mezclada con comida) ──
    'calcetines', 'calcetín', 'chaqueta', 'edredón', 'edredon',
    'almohada', 'bufanda', 'gorro', 'guantes', 'vestido',
    'pantalón', 'pantalon', 'ropa de cama', 'funda nórdica',
    'cojín', 'cojin', 'sábanas', 'sabana', 'cortina', 'toalla',
    'toallas', 'camiseta', 'polar térmica', 'polar térmico',
    'abrigo', 'bañador', 'banador', 'bikini', 'piel de cordero',
    // ── Hogar / decoración ──
    'maceta', 'tierra para plantas', 'planta decorativa',
    'planta artificial', 'flor artificial', 'portavelas',
    'marco foto', 'cuadro decorativo', 'espejo',
    'adorno decorativo', 'percha', 'perchero', 'balda',
    'estantería', 'estante', 'cesta de almacenaje',
    'cestas de', 'cestos',
    'pájaro decorativo', 'pajaro decorativo',
    // ── Menaje no alimenticio ──
    'botes de almacenamiento', 'bote de almacenamiento',
    'tarros de especias', 'tarro de especias',
    'organizador de', 'organizador para',
    'estuche guardar', 'caja organizador', 'caja de accesorios',
    'abrelatas', 'tabla de cortar', 'tablas de cortar',
    'utensilios de cocina', 'utensilio de cocina',
    'quesera', 'set de pulverizadores', 'pulverizador',
    // ── Juguetes — NO confundir con alimentos ──
    'muñeco', 'muñeca', 'peluche', 'piezas encajables',
    'juegos de madera', 'juego de madera', 'construcción',
    'de dinosaurio', 'de dinosaurios', 'encajable',
    'arenero', 'tobogán', 'tobogan', 'columpio',
    'set de pesca', 'caña de pescar', 'caña spinning', 'pesca spinning',
    'tren de madera', 'tren de juguete', 'tren de pasajeros',
    // ── Ferretería / herramientas ──
    'disco de corte', 'disco corte', 'cepillos de alambre',
    'puntas de amolar', 'punta amolar',
    'tornillo', 'tuerca', 'arandela', 'destornillador',
    'taladro', 'broca', 'alicate', 'llave inglesa',
    'cable eléctrico', 'enchufe', 'alargador',
    'linterna', 'candado', 'cerradura', 'bombilla',
    // ── Electrodomésticos adicionales ──
    'plancha de vapor', 'aspirador', 'aspiradora',
    'picadora multifunción', 'robot aspirador',
    'cafetera superautomática', 'máquina de coser',
]

// ── Bebidas energéticas y no saludables ────────────────────────────
const BEBIDAS_NO_SALUDABLES_KEYWORDS = [
    // Bebidas energéticas
    'monster energy', 'monster ',  // trailing space to avoid "monstera"
    'red bull', 'redbull',
    'burn energy', 'burn ',
    'rockstar energy',
    'hell energy',
    'boost energy',
    'te Energy',  // marca española
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
    // Bebidas alcohólicas — formato RTD (ready to drink)
    'calipo ',
    'cubata ',
    'destornillador ',
    // Otras bebidas no aptas
    'zumo fermentado',
    'hidromiel',
]

// Bebidas alcohólicas — rechazadas antes de entrar en BD
const ALCOHOL_KEYWORDS = [
    'cerveza', 'cervesa', 'cerveza sin', 'cerveza 0,0',
    // Vinos
    'vino tinto', 'vino blanco', 'vino rosado', 'vino espumoso', 'vino dulce',
    'vino de jerez', 'vino generoso', 'vino ecologico', 'vino ecológico',
    'vi negre', 'vi blanc', 'vi rosat', 'vi escumós', 'vi dolc', 'vi ranci',
    'caixa vi ',
    // Cava / espumosos
    'cava brut', 'cava semi', 'cava rosado', 'cava rosat', 'cava nature',
    'cava benjamín', 'cava pack',
    // Destilados
    'whisky', 'whiskey', 'bourbon',
    'vodka',
    'ginebra', ' gin ',
    'tequila', 'mezcal',
    'brandy', 'coñac', 'cognac',
    'amaretto', 'absenta', 'absinthe',
    'ron añejo', 'ron blanco', 'ron negro', 'ron dorado', 'ron de caña',
    // Licores
    'licor de café', 'licor de menta', 'licor de hierbas', 'licor de naranja',
    'licor de almendra', 'licor de anís', 'aperitivo licor',
    'anís seco', 'anís dulce', 'anisete',
    // Vinos fortificados / aperitivos
    'vermut', 'vermouth',
    'moscatel',
    'jerez fino', 'jerez oloroso', 'jerez amontillado',
    'oporto',
    // Champagne / espumosos
    'champán', 'champagne',
    // Sidra
    'sidra',
    // Combinados / RTD
    'sangría', 'sangria',
    'tinto de verano',
    'bebida preparada de ron', 'bebida preparada de vodka', 'bebida preparada de gin',
    'carajillo de ron',
    // Más alcohol
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
    'mosto de uva',  // en España el mosto de uva es no alcohólico, pero SIEMPRE revisar
    'vinagre de vino',  // esto es vinagre, se maneja con excepción
    // Cervezas sin alcohol (también se filtran, no aplican)
    'cerveza 0.0', 'cerveza 0,0%', 'cerveza 0.0%',
]

// Si el nombre contiene estas frases, el producto NO se filtra aunque tenga keyword de alcohol
// (platos cocinados o alimentos que usan alcohol como ingrediente)
const ALCOHOL_FOOD_EXCEPTIONS = [
    'al vino', 'en vino', 'con vino', 'estofado', 'guiso',
    'al licor', 'bombones', 'trufas', 'pralinés',
    'al ron', 'flambead',
    'vinagre',
    'vitamina',
    'pasas',
    'uva moscatel', 'uvas moscatel',
]

// Si el nombre contiene estas frases, el producto NO se filtra aunque tenga keyword
// de electrodoméstico (ej: "palomitas microondas" = comida, no microondas)
const COMESTIBLE_EXCEPTIONS = [
    // Jabón con glicerina — ingrediente alimentario (no producto de higiene)
    'jabón con glicerina',
    // Microondas — productos que se cocinan EN microondas (no el electrodoméstico)
    'palomitas microondas', 'palomitas para microondas',
    'para microondas',  // "brócoli para microondas", "patatas para microondas"
    'brócoli microondas', 'brocoli microondas',
    'coliflor microondas',
    'verduras microondas',
    'patatas microondas', 'batatas microondas',
    'patata microondas', 'batata microondas',   // singular
    'verdura microondas',
    'vegetales microondas',                      // "3 Vegetales Microondas"
    'sazonador ',
    'coliflor-brócoli-zanahoria microondas',
    'floretas de',
    // Freidora — productos que son COMIDA (aceites/sprays para freidora)
    'spray para freidora', 'spray freidora',
    'spray especial freidora',
    'aceite para freidora',
]

/** Devuelve true si el nombre del producto indica que NO es comestible por humanos */
function esNoComestible(nombre: string): boolean {
    const lower = nombre.toLowerCase()

    // Primero, detectar potencia en vatios (electrodomésticos)
    // Patrones: "500 w", "200w", "1500 w", "(W)", etc.
    // Mínimo 3 dígitos para evitar "1 Wrap" en nombres de sushi
    const tieneVatios = /\d{3,}\s*w/i.test(lower) || /\(w\)/i.test(lower)
    if (tieneVatios) return true

    // Verificar NO_COMESTIBLE_KEYWORDS con excepciones
    const matchKw = NO_COMESTIBLE_KEYWORDS.find(kw => lower.includes(kw))
    if (matchKw) {
        // Excepciones para dosificador + miel (la miel con dosificador es comida)
        if (matchKw.includes('dosificador') && lower.includes('miel')) return false
        // Excepciones para grill + brocheta/minigrill/tostadas/biscotes (comida a la plancha)
        if (matchKw === 'grill' && (lower.includes('brocheta') || lower.includes('minigrill')
            || lower.includes('tostada') || lower.includes('biscotes'))) return false
        // Excepción para vela + chorizo (chorizo extra vela dulce)
        if (matchKw.trim() === 'vela' && lower.includes('chorizo')) return false
        // Excepción para jabón de manos + glicerina (jabón con glicerina es ingrediente alimentario)
        if (matchKw.includes('jabón') && lower.includes('glicerina')) return false
        // Si el keyword es "freidora" o "microondas", verificar excepciones
        if ((matchKw.includes('freidora') || matchKw.includes('microondas'))
            && COMESTIBLE_EXCEPTIONS.some(ex => lower.includes(ex))) {
            return false
        }
        return true
    }

    // Verificar alcohol (con excepciones)
    const tieneExcepcion = ALCOHOL_FOOD_EXCEPTIONS.some(ex => lower.includes(ex))
    if (!tieneExcepcion && ALCOHOL_KEYWORDS.some(kw => lower.includes(kw))) return true

    // Verificar bebidas energéticas / no saludables (sin excepciones)
    if (BEBIDAS_NO_SALUDABLES_KEYWORDS.some(kw => lower.includes(kw))) return true

    return false
}

/** Mapa de slug → función scraper */
const SCRAPERS: Record<string, () => Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}>> = {
    mercadona: scrapearMercadona,
    carrefour: scrapearCarrefour,
    dia: scrapearDia,
    alcampo: scrapearAlcampo,
    consum: scrapearConsum,
    lidl: scrapearLidl,
    eroski: scrapearEroski,
    'el-corte-ingles': scrapearElCorteIngles,
    hipercor: scrapearHipercor,
    bonpreu: scrapearBonpreu,
    esclat: scrapearEsclat,
}

/** Slugs de supermercados que tienen scraper implementado */
export const SLUGS_SCRAPERS_DISPONIBLES: string[] = Object.keys(SCRAPERS)


/**
 * Pre-carga los productos_supermercado existentes para un supermercado.
 */
async function cargarProductosExistentes(
    supabase: SupabaseClient,
    supermercadoId: string
): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const PAGE_SIZE = 1000
    let desde = 0
    let hayMas = true

    while (hayMas) {
        const { data, error } = await supabase
            .from('productos_supermercado')
            .select('id, nombre_original')
            .eq('supermercado_id', supermercadoId)
            .range(desde, desde + PAGE_SIZE - 1)
            .order('id')

        if (error || !data || data.length === 0) {
            hayMas = false
            break
        }

        for (const p of data) {
            map.set(p.nombre_original, p.id)
        }

        if (data.length < PAGE_SIZE) hayMas = false
        else desde += PAGE_SIZE
    }

    console.log(`[Batch] Cargados ${map.size} productos existentes para supermercado`)
    return map
}

const MARCAS_CONOCIDAS = [
    'hacendado', 'carrefour', 'milbona', 'bosque verde', 'deliplus',
    'lidl', 'aldi', 'dia', 'alcampo', 'auchan', 'el corte ingles',
    'hipercor', 'bonpreu', 'esclat', 'eroski', 'consum', 'konsum',
]

/**
 * Orquestrador principal de scraping — VERSIÓN BATCH OPTIMIZADA.
 *
 * Antes: ~5-10 queries Supabase por producto → ~23,000-46,000 queries para Mercadona
 * Ahora: 1 query (cargar alimentos) + 1 query (cargar existentes) + N queries batch
 */
export async function scrapearSupermercado(
    supermercadoId: string,
    supermercadoSlug: string,
    supabase: SupabaseClient
): Promise<ResultadoScraping> {
    const inicio = Date.now()
    const errores: string[] = []

    try {
        // 1. Ejecutar scraper
        const scraperFn = SCRAPERS[supermercadoSlug]
        if (!scraperFn) {
            errores.push(`Supermercado "${supermercadoSlug}" no tiene scraper implementado aún`)
            return {
                supermercado_id: supermercadoId,
                supermercado_nombre: supermercadoSlug,
                productos: [],
                fecha_scraping: new Date().toISOString(),
                duracion_ms: Date.now() - inicio,
                errores,
                total_procesados: 0,
                nuevos_productos: 0,
                actualizados: 0,
                no_encontrados: 0,
            }
        }

        console.log(`[Batch] Scrapeando ${supermercadoSlug}...`)
        const result = await scraperFn()
        const productosRaw = result.productos
        errores.push(...result.errores)
        console.log(`[Batch] ${supermercadoSlug}: ${productosRaw.length} productos scrapeados`)

        // 2. Pre-cargar datos en memoria
        console.log(`[Batch] Cargando datos en memoria...`)
        const [alimentosMap, productosExistentes] = await Promise.all([
            cargarAlimentosMap(supabase),
            cargarProductosExistentes(supabase, supermercadoId),
        ])

        // 3. Procesar cada producto (TODO en memoria)
        const alimentosACrear: Array<{ nombre: string; nombreLimpio: string }> = []
        const productosAUpsert: Array<{
            nombre_original: string
            alimento_id: string
            marca: string | null
            precio_por_kg: number | null
            precio_unidad: number | null
            unidad: string
            url_producto: string | null
            url_imagen: string | null
        }> = []
        const historicoAInsertar: Array<{
            supermercado_id: string
            alimento_id: string
            nombre_producto: string
            precio_por_kg: number | null
            precio_unidad: number | null
            url_producto: string | null
            fuente: string
            metadatos: Record<string, unknown>
        }> = []

        let filtrados = 0
        let nuevos = 0
        let actualizados = 0
        let noEncontrados = 0

        const fechaHoy = new Date().toISOString().split('T')[0]

        for (const raw of productosRaw) {
            // Filtrar no-comestibles
            if (esNoComestible(raw.nombre)) {
                filtrados++
                continue
            }

            const nombreNormalizado = normalizarProducto(raw.nombre)
            const nombreLower = nombreNormalizado.toLowerCase()

            // Buscar alimento en el Map in-memory
            let alimentoId = matchAlimentoInMemory(nombreNormalizado, alimentosMap)

            if (!alimentoId) {
                // Marcar para crear (en batch después)
                alimentosACrear.push({ nombre: nombreNormalizado, nombreLimpio: nombreLower })
                nuevos++
            } else {
                actualizados++
            }

            // Guardamos el producto para upsert batch después
            // (alimentoId puede ser null si aún no se ha creado — lo resolveremos en batch)
            productosAUpsert.push({
                nombre_original: raw.nombre,
                alimento_id: alimentoId || '__PENDING__', // placeholder
                marca: raw.marca || null,
                precio_unidad: raw.precio_actual > 0 ? raw.precio_actual : null,
                precio_por_kg: (raw.precio_por_kg && raw.precio_por_kg > 0) ? raw.precio_por_kg : null,
                unidad: raw.unidad || 'kg',
                url_producto: raw.url_producto || null,
                url_imagen: raw.imagen_url || null,
            })

            // Guardar histórico (con placeholder de alimento_id)
            historicoAInsertar.push({
                supermercado_id: supermercadoId,
                alimento_id: alimentoId || '__PENDING__',
                nombre_producto: raw.nombre,
                precio_unidad: raw.precio_actual > 0 ? raw.precio_actual : null,
                precio_por_kg: (raw.precio_por_kg && raw.precio_por_kg > 0) ? raw.precio_por_kg : null,
                url_producto: raw.url_producto,
                fuente: 'scraping_http',
                metadatos: {
                    marca: raw.marca,
                    cantidad: raw.cantidad,
                    disponible: raw.disponible,
                    imagen_url: raw.imagen_url,
                },
            })
        }

        // 4. Crear alimentos nuevos en BATCH
        const alimentosIdMap = new Map<string, string>() // nombreLower → id
        if (alimentosACrear.length > 0) {
            console.log(`[Batch] Creando ${alimentosACrear.length} alimentos nuevos en batch...`)

            // Crear en lotes de 100 para evitar payloads enormes
            const LOTE = 100
            for (let i = 0; i < alimentosACrear.length; i += LOTE) {
                const lote = alimentosACrear.slice(i, i + LOTE)
                const inserts = lote.map(a => {
                    const nombreLower = a.nombreLimpio
                    const tieneMarca = MARCAS_CONOCIDAS.some(m => nombreLower.includes(m))
                    const categoriaNutricional = categorizarAlimento(a.nombre)
                    return {
                        nombre: a.nombre,
                        categoria: categoriaNutricional || 'Supermercado',
                        calorias: 0,
                        proteinas: 0,
                        carbohidratos: 0,
                        grasas: 0,
                        es_generico: !tieneMarca,
                        es_comestible: true,
                        fuente_nutricional: 'scraping_default',
                        ultima_actualizacion_nutricional: new Date().toISOString(),
                    }
                })

                const { data: creados, error } = await supabase
                    .from('alimentos')
                    .insert(inserts)
                    .select('id, nombre')

                if (error) {
                    // Si falla el batch, reintentar uno por uno (por si hay conflictos de unique)
                    console.warn(`[Batch] Error en batch insert (${error.message}), reintentando individual...`)
                    for (const a of lote) {
                        const categoriaNutricional = categorizarAlimento(a.nombre)
                        const { data: single } = await supabase
                            .from('alimentos')
                            .insert({
                                nombre: a.nombre,
                                categoria: categoriaNutricional || 'Supermercado',
                                calorias: 0,
                                proteinas: 0,
                                carbohidratos: 0,
                                grasas: 0,
                                es_generico: true,
                                es_comestible: true,
                                fuente_nutricional: 'scraping_default',
                                ultima_actualizacion_nutricional: new Date().toISOString(),
                            })
                            .select('id, nombre')
                            .maybeSingle()

                        if (single) {
                            alimentosIdMap.set(a.nombreLimpio, single.id)
                            console.log(`[Batch] Alimento creado (individual): "${a.nombre}" (${single.id})`)
                        } else {
                            // Podría ser duplicado, intentar buscar
                            const { data: existente } = await supabase
                                .from('alimentos')
                                .select('id')
                                .ilike('nombre', a.nombre)
                                .maybeSingle()
                            if (existente) {
                                alimentosIdMap.set(a.nombreLimpio, existente.id)
                            } else {
                                console.warn(`[Batch] No se pudo crear alimento: "${a.nombre}"`)
                                noEncontrados++
                            }
                        }
                    }
                } else if (creados) {
                    for (const c of creados) {
                        const key = c.nombre.toLowerCase()
                        alimentosIdMap.set(key, c.id)
                        // Añadir al map global también
                        alimentosMap.set(key, {
                            id: c.id,
                            nombre: c.nombre,
                            nombreLower: key,
                        })
                    }
                }
            }
            console.log(`[Batch] Creados ${alimentosIdMap.size} alimentos nuevos`)
        }

        // 5. Reemplazar placeholders de alimento_id y separar inserts de updates
        const productosInsert: typeof productosAUpsert = []
        const productosUpdate: Array<{ id: string; data: typeof productosAUpsert[0] }> = []

        for (const p of productosAUpsert) {
            let alimentoId: string | null = p.alimento_id
            if (alimentoId === '__PENDING__') {
                // Buscar en los recién creados
                const nombreLower = normalizarProducto(p.nombre_original).toLowerCase()
                alimentoId = alimentosIdMap.get(nombreLower) || matchAlimentoInMemory(normalizarProducto(p.nombre_original), alimentosMap) || null
            }

            if (!alimentoId) {
                noEncontrados++
                continue
            }

            p.alimento_id = alimentoId
            const existenteId = productosExistentes.get(p.nombre_original)

            if (existenteId) {
                productosUpdate.push({ id: existenteId, data: p })
            } else {
                productosInsert.push(p)
            }
        }

        // 6. Batch UPSERT productos_supermercado
        if (productosUpdate.length > 0) {
            console.log(`[Batch] Actualizando ${productosUpdate.length} productos existentes...`)
            const LOTE = 100
            for (let i = 0; i < productosUpdate.length; i += LOTE) {
                const lote = productosUpdate.slice(i, i + LOTE)
                await Promise.all(lote.map(({ id, data }) =>
                    supabase
                        .from('productos_supermercado')
                        .update({
                            alimento_id: data.alimento_id,
                            nombre_original: data.nombre_original,
                            marca: data.marca,
                            precio_por_kg: data.precio_por_kg,
                            precio_unidad: data.precio_unidad,
                            unidad: data.unidad,
                            url_producto: data.url_producto,
                            fecha_precio: fechaHoy,
                        })
                        .eq('id', id)
                ))
            }
        }

        if (productosInsert.length > 0) {
            // Deduplicar por alimento_id (constraint unique supermercado_id + alimento_id)
            const vistos = new Set<string>()
            const dedupProducts: typeof productosInsert = []
            for (const p of productosInsert) {
                const key = p.alimento_id
                if (!vistos.has(key)) {
                    vistos.add(key)
                    dedupProducts.push(p)
                }
            }
            const dedupCount = productosInsert.length - dedupProducts.length
            if (dedupCount > 0) {
                console.log(`[Batch] Eliminados ${dedupCount} duplicados por alimento_id`)
            }
            console.log(`[Batch] Insertando ${dedupProducts.length} productos nuevos...`)
            const LOTE = 100
            for (let i = 0; i < dedupProducts.length; i += LOTE) {
                const lote = dedupProducts.slice(i, i + LOTE)
                const { error } = await supabase
                    .from('productos_supermercado')
                    .insert(lote.map(p => ({
                        supermercado_id: supermercadoId,
                        alimento_id: p.alimento_id,
                        nombre_original: p.nombre_original,
                        marca: p.marca,
                        precio_por_kg: p.precio_por_kg,
                        precio_unidad: p.precio_unidad,
                        unidad: p.unidad,
                        url_producto: p.url_producto,
                        fecha_precio: fechaHoy,
                    })))
                if (error) {
                    errores.push(`Error batch insert productos: ${error.message}`)
                }
            }
        }

        // 7. Batch INSERT precios_historico
        const historicoValidos = historicoAInsertar.filter(h => {
            if (h.alimento_id === '__PENDING__') {
                const nombreNormalizado = normalizarProducto(h.nombre_producto)
                const nombreLower = nombreNormalizado.toLowerCase()
                const id = alimentosIdMap.get(nombreLower) || matchAlimentoInMemory(nombreNormalizado, alimentosMap)
                if (id) {
                    h.alimento_id = id
                    return true
                }
                return false
            }
            return true
        })

        if (historicoValidos.length > 0) {
            console.log(`[Batch] Insertando ${historicoValidos.length} registros en precios_historico...`)
            const LOTE = 200
            for (let i = 0; i < historicoValidos.length; i += LOTE) {
                const lote = historicoValidos.slice(i, i + LOTE)
                const { error } = await supabase
                    .from('precios_historico')
                    .insert(lote)
                if (error) {
                    errores.push(`Error batch insert histórico: ${error.message}`)
                }
            }
        }

        // 8. Construir respuesta
        const totalProcesados = productosRaw.length
        const duracion = Date.now() - inicio
        console.log(`[Batch] ${supermercadoSlug} completado en ${(duracion / 1000).toFixed(1)}s`)
        console.log(`  Total: ${totalProcesados} | Filtrados: ${filtrados} | Nuevos: ${nuevos} | Actualizados: ${actualizados} | No encontrados: ${noEncontrados}`)

        // Ajustar stats: actualizados cuenta los que tenían match en alimentos (no necesariamente en productos_supermercado)
        const statsActualizados = productosUpdate.length
        const statsNuevos = productosInsert.length

        const productosFinales = productosRaw
            .filter(r => !esNoComestible(r.nombre))
            .map(r => ({
                nombre: r.nombre,
                nombre_normalizado: normalizarProducto(r.nombre),
                precio_actual: r.precio_actual,
                precio_por_kg: r.precio_por_kg,
                unidad: r.unidad,
                url_producto: r.url_producto,
                imagen_url: r.imagen_url,
                marca: r.marca,
                cantidad: r.cantidad,
                disponible: r.disponible,
            }))

        return {
            supermercado_id: supermercadoId,
            supermercado_nombre: configNombre(supermercadoSlug),
            productos: productosFinales,
            fecha_scraping: new Date().toISOString(),
            duracion_ms: duracion,
            errores,
            total_procesados: totalProcesados,
            nuevos_productos: statsNuevos,
            actualizados: statsActualizados,
            no_encontrados: noEncontrados,
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error inesperado: ${msg}`)

        return {
            supermercado_id: supermercadoId,
            supermercado_nombre: configNombre(supermercadoSlug),
            productos: [],
            fecha_scraping: new Date().toISOString(),
            duracion_ms: Date.now() - inicio,
            errores,
            total_procesados: 0,
            nuevos_productos: 0,
            actualizados: 0,
            no_encontrados: 0,
        }
    }
}

function configNombre(slug: string): string {
    const mapa: Record<string, string> = {
        mercadona: 'Mercadona',
        carrefour: 'Carrefour',
        consum: 'Consum',
        aldi: 'Aldi',
        lidl: 'Lidl',
        alcampo: 'Alcampo',
        dia: 'Día',
        'el-corte-ingles': 'El Corte Inglés',
        hipercor: 'Hipercor',
        bonpreu: 'Bonpreu',
        esclat: 'Esclat',
        eroski: 'Eroski',
    }
    return mapa[slug] || slug
}

/**
 * Scrapea todos los supermercados que tengan scraper implementado.
 * @param supabase - Cliente Supabase (service_role para API routes, browser para client)
 */
export async function scrapearTodosLosSupermercados(
    supabase: SupabaseClient
): Promise<ResultadoScraping[]> {
    const { data: supermercados } = await supabase
        .from('supermercados')
        .select('*')
        .eq('activo', true)

    if (!supermercados) return []

    const resultados: ResultadoScraping[] = []

    for (const sm of supermercados) {
        // Solo ejecutar scraper si tenemos implementación para ese slug
        const scrapersDisponibles = Object.keys(SCRAPERS)
        if (!scrapersDisponibles.includes(sm.slug)) continue

        const resultado = await scrapearSupermercado(sm.id, sm.slug, supabase)
        resultados.push(resultado)
    }

    return resultados
}
