/**
 * Script para re-ejecutar el scraper de Mercadona y guardar en Supabase
 * usando service_role key (bypass RLS).
 * Solo guarda productos alimenticios (comestibles).
 *
 * USO: node scripts/re-scrapear-mercadona.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// Leer .env.local
const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

console.log('🚀 Re-scrapeando Mercadona con service_role...\n')

// ─── Categorías NO comestibles (todo lo demás se considera comida) ───
const CAT_NO_COMESTIBLE = new Set([
    // Higiene y cuidado personal
    'champú', 'acondicionador', 'mascarilla cabello', 'laca cabello', 'gel cabello',
    'espuma cabello', 'tinte cabello', 'coloración cabello', 'ampollas capilares',
    'protector térmico cabello', 'agua de peinado', 'spray cabello',
    'gel de baño', 'jabón de manos', 'esponja de baño', 'toalla turbante',
    'desodorante', 'colonia', 'eau de toilette', 'eau de parfum', 'fragancia',
    'body spray', 'lote hombre', 'lote mujer', 'lote infantil',
    'crema corporal', 'loción corporal', 'manteca corporal', 'aceite corporal',
    'exfoliante corporal', 'sorbete corporal', 'crema de manos', 'crema para pies',
    'gel refrescante', 'stick para pies',
    // Cuidado facial
    'crema facial', 'gel facial', 'sérum facial', 'contorno de ojos',
    'mascarilla facial', 'bruma facial', 'tónico facial', 'agua micelar',
    'leche facial', 'desmaquillador', 'discos desmaquillantes',
    'toallitas desmaquillantes', 'toallitas dermo', 'toallitas rostro',
    'exfoliante arcilla', 'tiras faciales', 'mousse facial',
    'bandas de cera', 'crema depilatoria', 'pinza de cejas',
    // Maquillaje
    'maquillaje fluido', 'maquillaje serum', 'maquillaje mate',
    'corrector', 'prebase de maquillaje', 'iluminador facial',
    'colorete', 'polvo compacto', 'polvo suelto',
    'pintalabios', 'bálsamo labial', 'brillo de labios', 'vaselina perfumada',
    'perfilador de ojos', 'delineador de ojos', 'máscara de pestañas',
    'paleta sombras', 'kit de pinceles', 'kit de esponjas', 'kit esencial',
    'rizador de pestañas', 'sacapuntas doble',
    // Afeitado
    'gel de afeitar', 'espuma de afeitar', 'bálsamo after shave',
    'loción after shave', 'maquinillas de afeitar',
    // Higiene femenina e íntima
    'compresa', 'protegeslip', 'tampones', 'toallitas íntimas',
    'gel de higiene íntima',
    // Odontología
    'dentífrico', 'cepillo dental', 'enjuague bucal', 'hilo dental',
    'cepillo interdental', 'crema adhesiva prótesis', 'spray bucal',
    'tabletas limpiadoras prótesis', 'arcos dentales', 'kit de viaje higiene dental',
    // Uñas
    'laca de uñas', 'tratamiento para uñas', 'quitaesmalte',
    'cortaúñas', 'tijera uñas', 'alicate uñas', 'corta cutículas',
    'taco pulidor', 'piedra pómez',
    // Protección solar
    'protector solar', 'aceite bruma protectora', 'aftersun',
    'protector labial',
    // Farmacia y parafarmacia
    'alcohol', 'povidona yodada', 'apósitos', 'esparadrapo',
    'tiras adhesivas', 'bandas adhesivas', 'algodón hidrófilo',
    'roll-on alivio picor', 'bálsamo oriental', 'pulsera citronela',
    'protectores oídos', 'lágrimas hidratantes', 'spray desinfectante',
    'mascarillas quirúrgicas', 'preservativos',
    'comprimidos vitaminas', 'perlas omega', 'cápsulas', 'gominolas',
    'spray oral', 'sticks jalea real',
    // Bebés
    'papilla', 'postre lácteo infantil', 'preparado lácteo crecimiento',
    'leche para lactantes', 'biberón', 'cepillo limpiabiberón',
    'chupete', 'gel corporal infantil', 'gel-champú bebé',
    'pomada del pañal', 'agua de colonia bebé', 'agua perfumada bebé',
    'solución fisiológica', 'gasas para bebé', 'esponja anatómica bebé',
    'polvos de talco', 'bastoncillos algodón bebé', 'toallitas infantiles',
    'toallitas bebé', 'cambiador multiusos', 'pañal bebé',
    // Mascotas
    'comida gato', 'comida perro', 'mousse con ternera', 'bocaditos en gelatina',
    'arena para gato', 'malta para gato', 'champú perros',
    'snack gato', 'snack perro', 'bolsas para residuos caninos',
    'alimento completo para periquitos',
    // Hogar - Limpieza
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
    // Hogar - WC
    'colgador wc', 'limpiador wc', 'pastillas cisterna', 'discos wc',
    'papel higiénico', 'papel hogar', 'papel multiusos',
    'pañuelos de papel', 'servilleta papel',
    // Hogar - Insecticidas
    'insecticida', 'colgador antipolillas', 'bolsitas antipolillas',
    'trampa', 'espirales antimosquitos', 'vela citronela', 'raticida',
    // Hogar - Ambientadores
    'ambientador spray', 'difusor ambientador', 'recambio ambientador',
    'ambientador coche', 'ambientador varitas', 'ambientador perlas',
    'vela perfumada', 'ambientador spa', 'ambientador líquido',
    'absorbeolores', 'set antihumedad',
    // Hogar - Menaje
    'molde de aluminio', 'molde de papel', 'recipiente de plástico',
    'papel de aluminio', 'bolsas congelación', 'bolsa isotérmica',
    'bolsa de rafia', 'vaso mediano', 'plato llano', 'pajitas',
    'palillos redondos', 'bandeja de cartón',
    // Hogar - Ferretería
    'velote rojo', 'fósforos', 'mini mechero', 'encendedor cocina',
    'pastillas enciende fuegos',
    // Hogar - Pilas
    'pila alcalina',
    // Hogar - Limpieza exterior
    'bolsas de basura', 'alguicida', 'cloro rápido', 'dosificador flotante',
    'kit analizador', 'cloro 5 acciones',
    // Hogar - Útiles limpieza
    'escoba', 'fregona', 'mopa atrapa polvo', 'gamuzas atrapa polvo',
    'recambio mopa', 'recogedor', 'palo extensible', 'barreño',
    'cubo con ruedas', 'escurridor', 'pinzas de ropa',
    'rodillo quitapelusas', 'cepillo para lavar',
    'recambios plumero', 'plumero de avestruz',
    'esponja de calzado', 'estropajo', 'borrador mágico',
    'bayeta', 'posavajillas', 'guantes de látex',
    // Incontinencia
    'protector cama', 'compresa de incontinencia',
])

function esComestible(categoria) {
    if (!categoria) return false
    const cat = categoria.toLowerCase().trim()
    return !CAT_NO_COMESTIBLE.has(cat)
}

// 1. Obtener el supermercado Mercadona de la BD
const { data: sm, error: smErr } = await supabase
    .from('supermercados')
    .select('*')
    .eq('slug', 'mercadona')
    .single()

if (smErr || !sm) {
    console.error('❌ Error al obtener supermercado Mercadona:', smErr?.message || 'no encontrado')
    process.exit(1)
}

console.log(`✅ Supermercado encontrado: ${sm.nombre} (${sm.id})`)

// 2. Ejecutar el scraper
const { scrapearMercadona } = await import('../lib/scraping/supermercados/mercadona.js')
const resultado = await scrapearMercadona()

console.log(`📦 Productos extraídos (bruto): ${resultado.productos.length}`)
console.log(`⚠️  Errores: ${resultado.errores.length}`)
console.log(`⏱️  Duración: ${(resultado.duracion_ms / 1000).toFixed(1)}s\n`)

if (resultado.errores.length > 0) {
    resultado.errores.forEach(e => console.log(`  ⚠️  ${e}`))
}

// 2b. Filtrar solo productos comestibles
const comestibles = resultado.productos.filter(p => esComestible(p.categoria))
const descartados = resultado.productos.length - comestibles.length
console.log(`🍽️  Productos comestibles: ${comestibles.length}`)
console.log(`🚫  Descartados (no comestibles): ${descartados}\n`)

// 3. Normalizar y guardar
const { normalizarProducto, buscarAlimento, crearAlimentoSiNoExiste } = await import('../lib/scraping/normalizador.js')

let nuevos = 0, actualizados = 0, noEncontrados = 0, errores = 0

for (const raw of comestibles) {
    const nombreNormalizado = normalizarProducto(raw.nombre)

    // Buscar alimento en BD
    const match = await buscarAlimento(nombreNormalizado, supabase)
    let alimentoId = match.alimento_id

    if (!alimentoId) {
        // No encontrado → intentar crear un nuevo alimento
        alimentoId = await crearAlimentoSiNoExiste(nombreNormalizado, supabase)
        if (alimentoId) {
            nuevos++
        } else {
            noEncontrados++
            continue
        }
    } else {
        actualizados++
    }

    // Guardar en productos_supermercado
    const { error: upsertError } = await supabase
        .from('productos_supermercado')
        .upsert({
            supermercado_id: sm.id,
            alimento_id: alimentoId,
            precio_por_kg: raw.precio_por_kg || raw.precio_actual,
            precio_unidad: raw.precio_actual !== (raw.precio_por_kg || raw.precio_actual) ? raw.precio_actual : null,
            unidad: raw.unidad || 'kg',
            url_producto: raw.url_producto,
            fecha_precio: new Date().toISOString().split('T')[0],
        }, {
            onConflict: 'supermercado_id, alimento_id',
        })

    if (upsertError) {
        console.error(`  ❌ Error al guardar ${raw.nombre}: ${upsertError.message}`)
        errores++
    }

    // Guardar en histórico (try/catch porque Supabase JS v2 no tiene .catch())
    try {
        await supabase
            .from('precios_historico')
            .insert({
                supermercado_id: sm.id,
                alimento_id: alimentoId,
                nombre_producto: raw.nombre,
                precio_por_kg: raw.precio_por_kg || raw.precio_actual,
                precio_unidad: raw.precio_actual !== (raw.precio_por_kg || raw.precio_actual) ? raw.precio_actual : null,
                url_producto: raw.url_producto,
                fuente: 'scraping_http',
                metadatos: {
                    marca: raw.marca,
                    cantidad: raw.cantidad,
                    disponible: raw.disponible,
                    imagen_url: raw.imagen_url,
                },
            })
    } catch (_) {
        // Ignorar errores de histórico (duplicados, etc.)
    }
}

console.log(`\n📊 Resumen:`)
console.log(`  🆕 Nuevos alimentos creados: ${nuevos}`)
console.log(`  🔄 Actualizados (coinciden): ${actualizados}`)
console.log(`  ❓ No encontrados: ${noEncontrados}`)
console.log(`  ❌ Errores al guardar: ${errores}`)
console.log(`  🍽️  Productos comestibles: ${comestibles.length}`)
console.log(`  🚫 Descartados (no comestibles): ${descartados}`)
console.log(`  ⏱️  Duración scraping: ${(resultado.duracion_ms / 1000).toFixed(1)}s`)

console.log(`\n✅ Scraping de Mercadona completado.`)
