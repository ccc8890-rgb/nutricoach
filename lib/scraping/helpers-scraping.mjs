/**
 * helpers-scraping.mjs
 *
 * Funciones compartidas entre ejecutar-scraping.mjs y consolidar-scraping.mjs
 */

// ── Config ────────────────────────────────────────────────────

export const RATE_LIMIT_MS = 200
export const TIMEOUT_MS = 8000

// ── Delay ─────────────────────────────────────────────────────

export function delay(ms) {
    return new Promise(r => setTimeout(r, ms))
}

// ── Fetch JSON ────────────────────────────────────────────────

export async function fetchJSON(url, headers = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                Accept: 'application/json',
                ...headers,
            },
        })
        const contentType = res.headers.get('content-type') || ''
        if (res.status === 403 || res.status === 429) {
            throw new Error(`CLOUDFLARE/BLOQUEO: HTTP ${res.status} en ${url}`)
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
        if (contentType.includes('text/html')) {
            throw new Error(`CLOUDFLARE: recibido HTML en vez de JSON (${url})`)
        }
        return res.json()
    } finally {
        clearTimeout(timer)
    }
}

// ── Filtro de comestibles ─────────────────────────────────────

export const CAT_NO_COMESTIBLE = [
    'champú', 'champu', 'acondicionador', 'mascarilla cabello', 'laca cabello', 'gel cabello',
    'espuma cabello', 'tinte cabello', 'coloración cabello', 'ampollas capilares',
    'protector térmico cabello', 'agua de peinado', 'spray cabello',
    'gel de baño', 'jabón de manos', 'esponja de baño', 'toalla turbante',
    'desodorante', 'colonia', 'eau de toilette', 'eau de parfum', 'fragancia',
    'body spray', 'lote hombre', 'lote mujer', 'lote infantil',
    'crema corporal', 'loción corporal', 'manteca corporal', 'aceite corporal',
    'exfoliante corporal', 'sorbete corporal', 'crema de manos', 'crema para pies',
    'gel refrescante', 'stick para pies',
    'crema facial', 'gel facial', 'sérum facial', 'contorno de ojos',
    'mascarilla facial', 'bruma facial', 'tónico facial', 'agua micelar',
    'leche facial', 'desmaquillador', 'discos desmaquillantes',
    'toallitas desmaquillantes', 'toallitas dermo', 'toallitas rostro',
    'exfoliante arcilla', 'tiras faciales', 'mousse facial',
    'bandas de cera', 'crema depilatoria', 'pinza de cejas',
    'maquillaje fluido', 'maquillaje serum', 'maquillaje mate',
    'corrector', 'prebase de maquillaje', 'iluminador facial',
    'colorete', 'polvo compacto', 'polvo suelto',
    'pintalabios', 'bálsamo labial', 'brillo de labios', 'vaselina perfumada',
    'perfilador de ojos', 'delineador de ojos', 'máscara de pestañas',
    'paleta sombras', 'kit de pinceles', 'kit de esponjas', 'kit esencial',
    'rizador de pestañas', 'sacapuntas doble',
    'gel de afeitar', 'espuma de afeitar', 'bálsamo after shave',
    'loción after shave', 'maquinillas de afeitar',
    'compresa', 'protegeslip', 'tampones', 'toallitas íntimas',
    'gel de higiene íntima',
    'dentífrico', 'cepillo dental', 'enjuague bucal', 'hilo dental',
    'cepillo interdental', 'crema adhesiva prótesis', 'spray bucal',
    'tabletas limpiadoras prótesis', 'arcos dentales', 'kit de viaje higiene dental',
    'laca de uñas', 'tratamiento para uñas', 'quitaesmalte',
    'cortaúñas', 'tijera uñas', 'alicate uñas', 'corta cutículas',
    'taco pulidor', 'piedra pómez',
    'protector solar', 'aceite bruma protectora', 'aftersun',
    'protector labial',
    'alcohol', 'povidona yodada', 'apósitos', 'esparadrapo',
    'tiras adhesivas', 'bandas adhesivas', 'algodón hidrófilo',
    'mascarillas quirúrgicas', 'preservativos',
    'comprimidos vitaminas', 'perlas omega', 'cápsulas', 'gominolas',
    'spray oral', 'sticks jalea real',
    'papilla', 'postre lácteo infantil', 'preparado lácteo crecimiento',
    'leche para lactantes', 'biberón', 'cepillo limpiabiberón',
    'chupete', 'gel corporal infantil', 'gel-champú bebé',
    'pomada del pañal', 'agua de colonia bebé', 'agua perfumada bebé',
    'solución fisiológica', 'gasas para bebé', 'esponja anatómica bebé',
    'polvos de talco', 'bastoncillos algodón bebé', 'toallitas infantiles',
    'toallitas bebé', 'cambiador multiusos', 'pañal bebé',
    'comida gato', 'comida perro', 'mousse con ternera', 'bocaditos en gelatina',
    'arena para gato', 'malta para gato', 'champú perros',
    'snack gato', 'snack perro', 'bolsas para residuos caninos',
    'alimento completo para periquitos',
    'detergente ropa', 'suavizante ropa', 'perfumador ropa',
    'lejía', 'amoníaco', 'quitagrasas', 'limpiacristales',
    'friegasuelos', 'limpiahogar', 'limpiador concentrado',
    'limpiador muebles', 'limpia tapicerías', 'limpia mopas',
    'desincrustante', 'multiusos ph neutro',
    'lavavajillas', 'lavaparabrisas', 'limpiagafas',
    'cera multisuperficies', 'abrillantador suelos',
    'desinfectante tejidos', 'eliminador de olores',
    'jabón blando', 'jabón con glicerina', 'disuelve manchas',
    'pastillas antical', 'activador quitamanchas', 'percarbonato',
    'planchado fácil', 'agua destilada',
    'colgador wc', 'limpiador wc', 'pastillas cisterna', 'discos wc',
    'papel higiénico', 'papel hogar', 'papel multiusos',
    'pañuelos de papel', 'servilleta papel',
    'insecticida', 'colgador antipolillas', 'bolsitas antipolillas',
    'trampa', 'espirales antimosquitos', 'vela citronela', 'raticida',
    'ambientador spray', 'difusor ambientador', 'recambio ambientador',
    'ambientador coche', 'ambientador varitas', 'ambientador perlas',
    'vela perfumada', 'ambientador spa', 'ambientador líquido',
    'absorbeolores', 'set antihumedad',
    'molde de aluminio', 'molde de papel', 'recipiente de plástico',
    'papel de aluminio', 'bolsas congelación', 'bolsa isotérmica',
    'bolsa de rafia', 'vaso mediano', 'plato llano', 'pajitas',
    'palillos redondos', 'bandeja de cartón',
    'velote rojo', 'fósforos', 'mini mechero', 'encendedor cocina',
    'pastillas enciende fuegos',
    'pila alcalina',
    'bolsas de basura', 'alguicida', 'cloro rápido', 'dosificador flotante',
    'kit analizador', 'cloro 5 acciones',
    'escoba', 'fregona', 'mopa atrapa polvo', 'gamuzas atrapa polvo',
    'recambio mopa', 'recogedor', 'palo extensible', 'barreño',
    'cubo con ruedas', 'escurridor', 'pinzas de ropa',
    'rodillo quitapelusas', 'cepillo para lavar',
    'recambios plumero', 'plumero de avestruz',
    'esponja de calzado', 'estropajo', 'borrador mágico',
    'bayeta', 'posavajillas', 'guantes de látex',
    'protector cama', 'compresa de incontinencia',
    'compresa incontinencia', 'protector cama',
]

export function esComestible(categoria) {
    if (!categoria) return true
    const cat = categoria.toLowerCase().trim()
    return !CAT_NO_COMESTIBLE.some(kw => cat.includes(kw))
}

// ── Normalización de nombre ───────────────────────────────────

export function limpiarNombre(nombre) {
    try {
        if (typeof nombre !== 'string' || !nombre) return ''
        let limpio = nombre
        limpio = limpio.replace(/\([^)]*\)/g, '')
        limpio = limpio.replace(/\d+\s*(kg|g|ml|l|litro|unidad(?:es)?|pack|ud|uds|unid|pieza(?:s)?)/gi, '')
        limpio = limpio.replace(/^(Hacendado|Bosque Verde|Deliplus|Carrefour|Carrefour Bio|Carrefour Discount|Milbona|Cien|Lidl|Bellsola)\s*/i, '')
        limpio = limpio.replace(/\s*(Hacendado|Bosque Verde|Deliplus|Carrefour|Carrefour Bio|Carrefour Discount|Milbona|Cien|Lidl|Bellsola)$/i, '')
        limpio = limpio.replace(/\b(para\s+)?(freír|asar|cocinar|horno|plancha|vapor|microondas|troceado|fileteado|cortado|entero|natural|ecológico|tradicional)\b/gi, '')
        limpio = limpio.replace(/\s+/g, ' ').trim()
        return limpio
    } catch {
        return nombre || ''
    }
}
