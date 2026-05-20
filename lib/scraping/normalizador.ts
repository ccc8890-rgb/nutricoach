import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Constantes ────────────────────────────────────────────────────────────

/** Marcas conocidas → se eliminan del inicio/final del nombre */
const MARCAS = [
    // Mercadona
    'Hacendado', 'Bosque Verde', 'Deliplus', 'Bellsola',
    // Carrefour
    'Carrefour Bio', 'Carrefour Discount', 'Carrefour Classic', 'Carrefour Sensation',
    'Carrefour Kids', 'Carrefour Baby', 'Carrefour',
    // Lidl
    'Milbona', 'Cien', 'Lidl', 'Alesto', 'Favorina', 'Sondey',
    'Crownfield', 'Or Noir', 'Dulcinea', 'Parmareggio', 'Pizzella',
    'Isoflakes', 'Erlen', 'Cien Nature', 'Spectrum', 'Bellarom',
    'Mister Choc', 'Fit&Active', 'Freshona', 'Vemina', 'D’or',
    // Día
    'Día', 'Dia', 'Asdecom', 'Bonté', 'Junior', 'Dely', 'Chef Select',
    // Alcampo
    'Alcampo', 'Auchan', 'Bouquet d\'Or', 'Nuestra Cosecha', 'Nos Regions ont du Talent',
    // ECI / Hipercor
    'El Corte Inglés', 'El Corte Ingles', 'Hipercor', 'Senda', 'Aliada',
    // Consum
    'Consum', 'Konsum', 'Eroski', 'Basic',
    // Bonpreu / Esclat
    'Bonpreu', 'Esclat', 'Bonpreu Esclat',
    // Otras marcas blancas/nacionales
    'Gallo', 'Gallina Blanca', 'Knorr', 'Pescanova', 'Nestlé', 'Danone',
    'Puleva', 'Central Lechera', 'Coca-Cola', 'Pepsi', 'Noel', 'Campofrío',
    'ElPozo', 'Casa Tarradellas', 'La Cocinera', 'Findus', 'Pastas Gallo',
    'Borges', 'Carbonell', 'La Española', 'Ybarra', 'SOS', 'Arroz SOS',
    'ColaCao', 'Nesquik', 'Kellogg\'s', 'Chiquilin', 'Nutella', 'Nocilla',
    'Lletges', 'Cacique',
]

/** Marcas a eliminar solo del inicio (evita falsos positpos en medio) */
const MARCAS_INICIO = [
    'Gallo', 'Pescanova', 'Danone', 'Puleva', 'Campofrío', 'ElPozo',
    'ColaCao', 'Nesquik', 'Kellogg\'s', 'Borges', 'Carbonell', 'SOS',
]

/** Palabras de preparación/descripción que se eliminan */
const DESCRIPTORES = [
    // Preparación
    'freír', 'freir', 'asar', 'cocinar', 'horno', 'plancha', 'vapor',
    'microondas', 'sartén', 'sarten', 'parrilla', 'brasa',
    // Corte/formato
    'troceado', 'fileteado', 'cortado', 'loncheado', 'picado', 'rallado',
    'laminado', 'machacado', 'triturado', 'molido', 'partido',
    'deshuesado', 'desespinado', 'pelado', 'mondado', 'sin espina',
    'sin piel', 'sin hueso', 'sin grasa', 'sin sal',
    // Estado
    'entero', 'natural', 'ecológico', 'ecologica', 'tradicional',
    'congelado', 'fresco', 'fresca', 'refrigerado', 'envasado',
    'ahumado', 'curado', 'madurado', 'rebozado', 'empanado',
    'deshidratado', 'liofilizado', 'pasteurizado', 'esterilizado',
    'refinado', 'hidrogenado', 'clarificado', 'batido',
    'desnatado', 'semidesnatado', 'entero (leche)', 'deslactosado',
    'sin lactosa', 'sin gluten', 'vegano', 'vegetal', 'light', 'zero',
    '0%', '0,0%', 'bajo en grasa', 'sin azúcar', 'sin azucar',
    'sin cafeína', 'descafeinado', 'suave', 'intenso',
    // Calidad
    'gourmet', 'deluxe', 'premium', 'selección', 'seleccion',
    'artesano', 'artesana', 'casero', 'casera', 'extra', 'supremo',
    'primera calidad', 'primera', 'segunda', 'tercera',
    // Formato en inglés
    'ready to eat', 'frozen', 'fresh', 'organic', 'bio', 'eco',
    'whole', 'sliced', 'diced', 'ground', 'minced', 'smoked',
    'skinless', 'boneless', 'low fat', 'fat free', 'sugar free',
]

/** Stop words a eliminar (no afectan la identidad del alimento) */
const STOP_WORDS = /\b(de|del|la|las|los|el|en|con|sin|y|e|o|a|para|por|al|un|una|su|que)\b/gi

/** Mapa de sinónimos: normaliza variaciones de nombres de alimentos */
const SINONIMOS: Record<string, string> = {
    // Yogur
    'yogurt': 'yogur',
    'yoghurt': 'yogur',
    'yogures': 'yogur',
    // Aceite
    'aove': 'aceite de oliva virgen extra',
    'aceite oliva virgen extra': 'aceite de oliva',
    'aceite oliva virgen': 'aceite de oliva',
    'aceite oliva': 'aceite de oliva',
    'aceite girasol': 'aceite de girasol',
    // Leche
    'leche entera': 'leche',
    'leche semidesnatada': 'leche',
    'leche desnatada': 'leche desnatada',
    'leche sin lactosa': 'leche sin lactosa',
    'leche deslactosada': 'leche sin lactosa',
    // Carne
    'ternera': 'ternera',
    'tenera': 'ternera',
    'carne picada': 'carne picada',
    'carne molida': 'carne picada',
    'pollo': 'pollo',
    'pollo entero': 'pollo',
    'pechuga pollo': 'pollo',
    'pechuga de pollo': 'pollo',
    'muslo pollo': 'pollo',
    'muslo de pollo': 'pollo',
    'contramuslo': 'pollo',
    'contramuslos pollo': 'pollo',
    'ala pollo': 'pollo',
    'ala de pollo': 'pollo',
    // Cerdo
    'lomo cerdo': 'lomo de cerdo',
    'lomo de cerdo': 'lomo de cerdo',
    'solomillo cerdo': 'solomillo de cerdo',
    'solomillo de cerdo': 'solomillo de cerdo',
    // Pescado
    'merluza': 'merluza',
    'merluza del sur': 'merluza',
    'merluza de alaska': 'merluza de alaska',
    'bacalao': 'bacalao',
    'bacalao salado': 'bacalao salado',
    'bacalao desalado': 'bacalao',
    'salmón': 'salmón',
    'salmon': 'salmón',
    'atún': 'atún',
    'atun': 'atún',
    'atún claro': 'atún',
    'atún en aceite': 'atún',
    'atún en aceite oliva': 'atún',
    'atún en conserva': 'atún',
    'atún en escabeche': 'atún en escabeche',
    'atún natural': 'atún',
    // Huevos
    'huevos': 'huevo',
    // Frutas
    'plátano': 'plátano',
    'platano': 'plátano',
    'banana': 'plátano',
    'fresas': 'fresa',
    'fresón': 'fresa',
    'fresones': 'fresa',
    'arándanos': 'arándano',
    'uvas': 'uva',
    'manzanas': 'manzana',
    'peras': 'pera',
    'naranjas': 'naranja',
    // Verduras / hortalizas
    'tomates': 'tomate',
    'tomate pera': 'tomate',
    'tomate ensalada': 'tomate',
    'tomate cherry': 'tomate cherry',
    'tomates cherry': 'tomate cherry',
    'tomate frito': 'tomate',
    'tomate natural triturado': 'tomate',
    'cebollas': 'cebolla',
    'patatas': 'patata',
    'papas': 'patata',
    'zanahorias': 'zanahoria',
    'pimientos': 'pimiento',
    'pimiento rojo': 'pimiento rojo',
    'pimiento verde': 'pimiento verde',
    'pimiento amarillo': 'pimiento amarillo',
    'calabacín': 'calabacín',
    'calabacin': 'calabacín',
    'berenjena': 'berenjena',
    'brócoli': 'brócoli',
    'brocoli': 'brócoli',
    'coliflor': 'coliflor',
    'lechuga': 'lechuga',
    'lechuga iceberg': 'lechuga',
    'lechuga romana': 'lechuga',
    'espinacas': 'espinaca',
    'acelgas': 'acelga',
    // Legumbres
    'lentejas': 'lenteja',
    'garbanzos': 'garbanzo',
    'alubias': 'alubia',
    'judías': 'judía',
    'judias': 'judía',
    'frijoles': 'alubia',
    'porotos': 'alubia',
    // Harinas
    'harina de trigo': 'harina',
    'harina de avena': 'harina de avena',
    'harina de almendra': 'harina de almendra',
    'harina de coco': 'harina de coco',
    // Arroz
    'arroz redondo': 'arroz',
    'arroz bomba': 'arroz',
    'arroz basmati': 'arroz basmati',
    'arroz integral': 'arroz integral',
    'arroz vaporizado': 'arroz',
    'arroz largo': 'arroz',
    // Pasta
    'macarrones': 'macarrón',
    'espaguetis': 'espagueti',
    'spaghetti': 'espagueti',
    'spaguetti': 'espagueti',
    'fideos': 'fideo',
    'tallarines': 'tallarín',
    'lacitos': 'lacito',
    'helicópteros': 'helicóptero',
    // Lácteos
    'queso curado': 'queso curado',
    'queso semicurado': 'queso semicurado',
    'queso tierno': 'queso tierno',
    'queso fresco': 'queso fresco',
    'queso rallado': 'queso rallado',
    'queso en lonchas': 'queso lonchas',
    'queso crema': 'queso crema',
    'requesón': 'requesón',
    'requeson': 'requesón',
    'nata líquida': 'nata líquida',
    'nata para montar': 'nata para montar',
    'nata montar': 'nata para montar',
    'crema de leche': 'nata líquida',
    // Embutidos / fiambres
    'jamón serrano': 'jamón serrano',
    'jamon serrano': 'jamón serrano',
    'jamón cocido': 'jamón cocido',
    'jamon cocido': 'jamón cocido',
    'jamon york': 'jamón cocido',
    'jamón de york': 'jamón cocido',
    'pechuga pavo': 'pechuga de pavo',
    'pechuga de pavo': 'pechuga de pavo',
    'salchichón': 'salchichón',
    'salchichon': 'salchichón',
    'chorizo': 'chorizo',
    'lomo embuchado': 'lomo embuchado',
    'lomo adobado': 'lomo adobado',
    'mortadela': 'mortadela',
    'fuet': 'fuet',
    // Conservas
    'atún claro en aceite oliva': 'atún en aceite de oliva',
    'atun claro en aceite oliva': 'atún en aceite de oliva',
    'sardinas en aceite': 'sardinas en aceite',
    'sardinas en escabeche': 'sardinas en escabeche',
    'mejillones en escabeche': 'mejillones en escabeche',
    'mejillones al natural': 'mejillones al natural',
    // Bebidas
    'coca cola': 'cola',
    'coca-cola': 'cola',
    'cola light': 'cola light',
    'cola zero': 'cola zero',
    'cola zero azucar': 'cola zero',
    'agua mineral': 'agua',
    'agua con gas': 'agua con gas',
    'cerveza': 'cerveza',
    'cerveza sin alcohol': 'cerveza sin alcohol',
    'vino tinto': 'vino tinto',
    'vino blanco': 'vino blanco',
    'vino rosado': 'vino rosado',
    // Pan
    'pan de molde': 'pan de molde',
    'pan molde': 'pan de molde',
    'pan integral': 'pan integral',
    'pan blanco': 'pan',
    'pan barra': 'pan',
    'pan chapata': 'pan chapata',
    'ciabatta': 'pan chapata',
    'pan de pueblo': 'pan',
    'pan rustico': 'pan rústico',
    // Sal / especias
    'sal marina': 'sal',
    'sal del himalaya': 'sal',
    'sal rosa': 'sal',
    'pimienta negra molida': 'pimienta',
    'pimienta blanca molida': 'pimienta',
    // Azúcares
    'azucar blanca': 'azúcar',
    'azúcar blanco': 'azúcar',
    'azucar moreno': 'azúcar moreno',
    'azúcar moreno': 'azúcar moreno',
    'azucar integral': 'azúcar moreno',
    'azucar de coco': 'azúcar de coco',
}

/** Caracteres acentuados → su equivalente sin acento */
const ACENTOS: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
    'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
    'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
    'ñ': 'n', 'ç': 'c',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
    'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U',
    'Ä': 'A', 'Ë': 'E', 'Ï': 'I', 'Ö': 'O', 'Ü': 'U',
    'Ñ': 'N', 'Ç': 'C',
}

// ─── Funciones de limpieza ─────────────────────────────────────────────────

/** Elimina acentos y diacríticos */
function quitarAcentos(texto: string): string {
    return texto.replace(/[áéíóúàèìòùâêîôûäëïöüñçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÇ]/g, c => ACENTOS[c] || c)
}

/** Aplica el mapa de sinónimos sobre el nombre completo (prioriza coincidencias largas) */
function aplicarSinonimos(nombre: string): string {
    const lower = nombre.toLowerCase().trim()
    // Intentar coincidencia exacta primero
    if (SINONIMOS[lower]) return SINONIMOS[lower]
    // Luego intentar substring comenzando por las más largas
    const entries = Object.entries(SINONIMOS).sort((a, b) => b[0].length - a[0].length)
    for (const [original, normalizado] of entries) {
        // Reemplazar solo palabras completas, no substrings parciales
        const regex = new RegExp(`\\b${escapeRegex(original)}\\b`, 'gi')
        if (regex.test(lower)) {
            return lower.replace(regex, normalizado)
        }
    }
    return nombre
}

/** Escapa caracteres especiales para regex */
function escapeRegex(texto: string): string {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Elimina stop words del nombre */
function quitarStopWords(nombre: string): string {
    return nombre.replace(STOP_WORDS, '').replace(/\s+/g, ' ').trim()
}

/**
 * Pipeline completo de limpieza de nombres de productos.
 * Orden: marcas → paréntesis → cantidades → descriptores → sinónimos → stop words → acentos → espacios
 */
function limpiarNombre(nombre: string): string {
    let limpio = nombre.trim()

    if (!limpio) return ''

    // 1. Quitar marcas al inicio (lista exhaustiva)
    for (const marca of MARCAS_INICIO) {
        const regexIni = new RegExp(`^${escapeRegex(marca)}\\s+`, 'i')
        limpio = limpio.replace(regexIni, '')
    }

    // 2. Quitar marcas al inicio/final (lista general)
    for (const marca of MARCAS) {
        const regexIni = new RegExp(`^${escapeRegex(marca)}\\s+`, 'i')
        const regexFin = new RegExp(`\\s+${escapeRegex(marca)}$`, 'i')
        limpio = limpio.replace(regexIni, '').replace(regexFin, '')
    }

    // 3. Quitar contenido entre paréntesis (marcas, variantes)
    limpio = limpio.replace(/\([^)]*\)/g, '')

    // 4. Quitar cantidades y pesos (ej: "1 kg", "500 g", "6 unidades", "pack 3")
    limpio = limpio.replace(/\d+\s*(kg|g|ml|l|litro|litros|unidad(?:es)?|pack|ud|uds|unid|pieza(?:s)?|cl|dl|mg|µg)/gi, '')

    // 5. Quitar "pack", "lote", "caja" con número
    limpio = limpio.replace(/(pack|lote|caja|kit)\s*\d+/gi, '')
    limpio = limpio.replace(/\d+\s*(pack|lote|caja|kit)/gi, '')

    // 6. Quitar palabras descriptor
    for (const desc of DESCRIPTORES) {
        const regex = new RegExp(`\\b${escapeRegex(desc)}\\b`, 'gi')
        limpio = limpio.replace(regex, '')
    }

    // 7. Normalizar espacios (pre-sinónimos)
    limpio = limpio.replace(/\s+/g, ' ').trim()

    // 8. Aplicar sinónimos
    limpio = aplicarSinonimos(limpio)

    // 9. Quitar stop words
    limpio = quitarStopWords(limpio)

    // 10. Quitar acentos
    limpio = quitarAcentos(limpio)

    // 11. Normalizar espacios final
    limpio = limpio.replace(/\s+/g, ' ').trim()

    // 12. Si después de todo queda vacío o muy corto, devolver el original limpio básico
    if (limpio.length < 2) {
        limpio = nombre.trim().toLowerCase()
        limpio = quitarAcentos(limpio)
        limpio = limpio.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
    }

    return limpio
}

// ─── API pública ───────────────────────────────────────────────────────────

/** Normaliza un nombre de producto para buscar en la BD */
export function normalizarProducto(nombre: string): string {
    return limpiarNombre(nombre)
}

export interface MatchResult {
    alimento_id: string | null
    confianza: 'exacta' | 'fuzzy' | 'parcial' | 'no_encontrado'
}

/**
 * Busca un alimento en la BD por nombre normalizado.
 * Estrategia multi-nivel con prioridad:
 *   1. Coincidencia exacta (ilike)
 *   2. Coincidencia exacta sin acentos
 *   3. Contiene bidireccional (que alimento contenga nombre, o viceversa)
 *   4. Coincidencia por palabra clave (split de términos, match individual)
 *   5. Fuzzy matching con pg_trgm (vía RPC match_alimento)
 */
export async function buscarAlimento(
    nombre: string,
    supabase: SupabaseClient
): Promise<MatchResult> {
    const nombreLimpio = limpiarNombre(nombre)

    if (!nombreLimpio || nombreLimpio.length < 2) {
        return { alimento_id: null, confianza: 'no_encontrado' }
    }

    // 1. Coincidencia exacta
    const { data: exacto } = await supabase
        .from('alimentos')
        .select('id')
        .eq('es_comestible', true)
        .ilike('nombre', nombreLimpio)
        .maybeSingle()

    if (exacto) {
        return { alimento_id: exacto.id, confianza: 'exacta' }
    }

    // 2. Coincidencia exacta sin acentos (por si la BD tiene acentos distintos)
    //    Buscamos primero un alimento que tenga el mismo nombre sin acentos
    const { data: alimentos } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .eq('es_comestible', true)
        .limit(50)

    if (alimentos && alimentos.length > 0) {
        const nombreSinAcentos = quitarAcentos(nombreLimpio.toLowerCase())
        for (const a of alimentos) {
            if (quitarAcentos(a.nombre.toLowerCase()) === nombreSinAcentos) {
                return { alimento_id: a.id, confianza: 'exacta' }
            }
        }
    }

    // 3. Contiene bidireccional
    const { data: contains } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .eq('es_comestible', true)
        .or(`nombre.ilike.%${nombreLimpio}%,nombre.ilike.${nombreLimpio}%`)
        .limit(5)

    if (contains && contains.length > 0) {
        // Elegir el más corto (suele ser el más genérico = mejor match)
        const mejor = contains.sort((a, b) => a.nombre.length - b.nombre.length)[0]
        return { alimento_id: mejor.id, confianza: 'fuzzy' }
    }

    // 4. Coincidencia por palabra clave
    //    Divide el nombre en palabras y busca coincidencias individuales
    const palabras = nombreLimpio.split(/\s+/).filter(p => p.length > 2)
    if (palabras.length > 0) {
        // Probar con la palabra más significativa (la más larga suele ser la clave)
        const palabraClave = [...palabras].sort((a, b) => b.length - a.length)[0]
        const { data: porPalabra } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .eq('es_comestible', true)
            .ilike('nombre', `%${palabraClave}%`)
            .limit(5)

        if (porPalabra && porPalabra.length > 0) {
            // Filtrar: el nombre del alimento debe contener AL MENOS 2 palabras del producto buscado
            const conMatch = porPalabra.filter(a => {
                const palabrasAlimento = a.nombre.toLowerCase().split(/\s+/)
                const coincidencias = palabras.filter((p: string) =>
                    palabrasAlimento.some((pa: string) => pa.includes(p) || p.includes(pa))
                )
                return coincidencias.length >= 2 || coincidencias.length === palabras.length
            })
            if (conMatch.length > 0) {
                const mejor = conMatch.sort((a, b) => a.nombre.length - b.nombre.length)[0]
                return { alimento_id: mejor.id, confianza: 'parcial' }
            }
        }
    }

    // 5. Fuzzy matching con la función SQL (pg_trgm)
    const { data: fuzzyId } = await supabase.rpc('match_alimento', {
        p_nombre: nombreLimpio,
    })

    if (fuzzyId) {
        return { alimento_id: fuzzyId as string, confianza: 'fuzzy' }
    }

    // 6. Último recurso: buscar por cualquier palabra individual
    for (const palabra of palabras.sort((a, b) => b.length - a.length)) {
        const { data: porPalabraUnica } = await supabase
            .from('alimentos')
            .select('id')
            .eq('es_comestible', true)
            .ilike('nombre', `%${palabra}%`)
            .limit(1)
            .maybeSingle()

        if (porPalabraUnica) {
            return { alimento_id: porPalabraUnica.id, confianza: 'parcial' }
        }
    }

    return { alimento_id: null, confianza: 'no_encontrado' }
}

// ── Guard: detectar productos no comestibles (mascotas, cosmética, higiene) ──
const PATRONES_NO_COMESTIBLE = [
    /comida (gato|gatos|perro|perros|perr[oa])/i,
    /comida (seca|humeda) (gatos|perros)/i,
    /barra labial|barra labios|labial (limitless|glass shine|ink matte)/i,
    /pasta encias/i,
    /superstay|limitless matte|glass shine/i,
]

function esProductoNoComestible(nombre: string): boolean {
    const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return PATRONES_NO_COMESTIBLE.some(p => p.test(n))
}

/**
 * Intenta crear un nuevo alimento si no existe.
 * Útil para productos que no están en tu BD pero aparecen en el supermercado.
 */
export async function crearAlimentoSiNoExiste(
    nombre: string,
    supabase: SupabaseClient,
    categoria?: string,
    esGenerico?: boolean
): Promise<string | null> {
    const nombreLimpio = limpiarNombre(nombre)
    if (!nombreLimpio || nombreLimpio.length < 2) return null

    // 🚫 Rechazar productos no comestibles (comida mascotas, cosmética, higiene)
    if (esProductoNoComestible(nombreLimpio)) {
        console.log(`[Normalizador] 🚫 Rechazado producto no comestible: "${nombreLimpio}"`)
        return null
    }

    // Inferir si es genérico por el nombre si no se especifica
    const MARCAS_CONOCIDAS = [
        'hacendado', 'carrefour', 'milbona', 'bosque verde', 'deliplus',
        'lidl', 'aldi', 'dia', 'alcampo', 'auchan', 'el corte ingles',
        'hipercor', 'bonpreu', 'esclat', 'eroski', 'consum', 'konsum',
    ]
    const nombreLower = nombreLimpio.toLowerCase()
    const tieneMarco = MARCAS_CONOCIDAS.some(m => nombreLower.includes(m))
    const inferidoGenerico = esGenerico ?? !tieneMarco

    const { data, error } = await supabase
        .from('alimentos')
        .insert({
            nombre: nombreLimpio,
            categoria: categoria || 'Supermercado',
            calorias: 0,
            proteinas: 0,
            carbohidratos: 0,
            grasas: 0,
            es_generico: inferidoGenerico,
        })
        .select('id')
        .single()

    if (error) {
        // Si el error es por duplicado (unique constraint), intentar buscar el existente
        if (error.code === '23505') {
            const { data: existente } = await supabase
                .from('alimentos')
                .select('id')
                .ilike('nombre', nombreLimpio)
                .maybeSingle()
            if (existente) return existente.id
        }
        console.error('[Normalizador] Error al crear alimento:', error.message)
        return null
    }

    console.log(`[Normalizador] Alimento creado: "${nombreLimpio}" (genérico: ${inferidoGenerico}, ${data.id})`)
    return data.id
}
