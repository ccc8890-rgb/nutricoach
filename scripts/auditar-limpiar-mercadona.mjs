/**
 * Auditoría y limpieza de la base de datos de alimentos — productos Mercadona
 *
 * USO:
 *   node scripts/auditar-limpiar-mercadona.mjs            → auditoría (solo lectura)
 *   node scripts/auditar-limpiar-mercadona.mjs --delete   → elimina no comestibles
 *   node scripts/auditar-limpiar-mercadona.mjs --export   → exporta listas a JSON
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
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

const BORRAR = process.argv.includes('--delete')
const EXPORTAR = process.argv.includes('--export')

// ─── Normalizar texto para comparación (quita acentos, minúsculas) ────────────
function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
}

// ─── Nombres/fragmentos que SIEMPRE son comestibles (whitelist) ────────────────
// Evita falsos positivos cuando un keyword aparece en contexto alimentario
const WHITELIST_COMESTIBLES = [
    'cabello de angel',   // pasta/dulce español
    'fideo cabello',      // variante
    'cheveux d\'ange',    // nombre francés
]

// ─── Palabras clave en NOMBRE de producto que indican NO comestible ───────────
const KEYWORDS_NO_COMESTIBLE = [
    // Higiene corporal
    'champu', 'acondicionador', 'gel de bano', 'gel de ducha', 'jabon de manos',
    'jabon corporal', 'esponja de bano', 'toalla turbante', 'desodorante', 'colonia',
    'eau de toilette', 'eau de parfum', 'body spray', 'body lotion', 'crema corporal',
    'locion corporal', 'manteca corporal', 'aceite corporal', 'exfoliante corporal',
    'gel corporal', 'crema de manos', 'crema para pies', 'gel refrescante',
    'lote regalo', 'lote mujer', 'lote hombre', 'lote infantil',
    // Cuidado capilar
    'cabello', 'capilar', 'laca pelo', 'gel pelo', 'espuma pelo', 'tinte pelo',
    'tinte cabello', 'coloracion permanente', 'color mask', 'laca cabello',
    'ampollas concentradas', 'ampollas tratamiento', 'ampollas reparacion',
    'anticaida', 'anti caida', 'rizos definidos', 'activador de rizos',
    'agua de peinado', 'spray capilar', 'hidrocrema', 'retoca raices', 'magic retouch',
    // Cuidado facial
    'crema facial', 'gel facial', 'serum facial', 'contorno de ojos',
    'mascarilla facial', 'bruma facial', 'tonico facial', 'agua micelar',
    'leche limpiadora', 'desmaquillador', 'disco desmaquillante', 'toallita desmaquillante',
    'esponja desmaquillante', 'esponja facial', 'exfoliante arcilla', 'mousse facial',
    'banda de cera', 'crema depilatoria', 'serum facial', 'sebo-regulador',
    'hidratante hombre', 'men expert', 'hydra energetic', 'regen skin',
    // Maquillaje
    'maquillaje fluido', 'corrector ojeras', 'prebase', 'iluminador facial',
    'colorete', 'polvo compacto', 'pintalabios', 'balsamo labial', 'brillo de labios',
    'vaselina perfumada', 'perfilador de ojos', 'delineador', 'mascara de pestanas',
    'paleta sombras', 'kit de pinceles', 'esponjas maquillaje', 'rizador de pestanas',
    // Afeitado / depilación
    'gel de afeitar', 'espuma de afeitar', 'after shave', 'aftershave', 'maquinilla de afeitar',
    'precision system', 'hojas de afeitar',
    // Higiene íntima / femenina
    'compresas', 'protegeslip', 'tampon', 'copa menstrual',
    'toallitas intimas', 'gel intimo', 'higiene intima',
    // Dental
    'dentifrico', 'pasta de dientes', 'cepillo dental', 'enjuague bucal', 'colutorio',
    'hilo dental', 'cepillo interdental', 'protesis dental', 'tabletas limpiadoras protesis',
    // Uñas
    'laca de unas', 'esmalte de unas', 'quitaesmalte', 'cortaunas', 'alicate unas',
    'taco pulidor unas', 'piedra pomez',
    // Protección solar
    'protector solar', 'factor proteccion', 'spf', 'aftersun', 'after sun',
    // Farmacia / parafarmacia
    'povidona yodada', 'aposito', 'esparadrapo', 'algodon hidrofilo',
    'roll-on picor', 'pulsera citronela', 'protectores oidos',
    'lagrimas artificiales', 'spray desinfectante', 'mascarilla quirurgica', 'mascarilla ffp',
    'preservativo', 'condon', 'solucion fisiologica', 'gasas esteriles', 'gasas bebé',
    'gasas no tejidas', 'liendres', 'piojos',
    // Bastoncillos
    'bastoncillo', 'bastoncilos', 'baston oidos', 'hisopo',
    // Bebés (no comestibles)
    'biberon', 'cepillo limpibiberon', 'chupete', 'gel champu bebe',
    'pomada del panal', 'agua perfumada bebe', 'agua de colonia bebe',
    'esponja anatomica', 'polvos de talco', 'bastoncillos bebe',
    'toallitas bebe', 'toallitas infantiles', 'panal bebe', 'panales',
    'cambiador multiusos', 'locion infantil',
    // Mascotas
    'comida para gato', 'comida para perro', 'pienso gato', 'pienso perro',
    'arena para gato', 'malta para gato', 'champu perros', 'snack gato',
    'snack perro', 'bolsas residuos caninos',
    // Limpieza del hogar
    'detergente ropa', 'suavizante ropa', 'perfumador ropa', 'lejia',
    'amoniaco', 'quitagrasas', 'limpiacristales', 'friegasuelos', 'limpiahogar',
    'limpiador concentrado', 'limpiador muebles', 'limpia tapicerias',
    'lavavajillas', 'desincrustante', 'multiusos limpieza', 'cera multisuperficies',
    'abrillantador', 'desinfectante tejidos', 'eliminador de olores', 'jabon blando',
    'jabon glicerina', 'percarbonato', 'quitamanchas', 'pastillas antical',
    'planchado facil', 'agua destilada plancha',
    // WC y papel
    'colgador wc', 'limpiador wc', 'pastillas cisterna', 'discos wc',
    'papel higienico', 'papel de cocina', 'papel multiusos', 'panuelos de papel',
    // Insecticidas
    'insecticida', 'antipolillas', 'trampa mosquitos', 'espirales antimosquitos',
    'vela citronela', 'raticida', 'trampa cucarachas',
    // Ambientadores
    'ambientador spray', 'difusor ambientador', 'recambio ambientador',
    'ambientador coche', 'ambientador varitas', 'ambientador perlas',
    'vela perfumada', 'absorbeolores', 'antihumedad',
    // Menaje / accesorios de cocina no comestibles
    'molde de aluminio', 'papel de aluminio', 'film transparente', 'bolsa congelacion',
    'bolsa isotermica', 'bolsa de rafia', 'bolsa basura', 'pajitas plastico',
    'bandeja carton', 'filtros de cafe para', 'brochetas de madera',
    'envase rellenable', 'tartera', 'fiambrera',
    // Ferretería
    'mechero', 'fosforos', 'encendedor cocina', 'pastillas encender fuego',
    // Pilas
    'pila alcalina', 'pilas aa', 'pilas aaa',
    // Piscina
    'cloro piscina', 'alguicida', 'dosificador flotante', 'kit analizador piscina',
    // Útiles de limpieza
    'escoba', 'fregona', 'mopa atrapa', 'recogedor', 'cubo fregado', 'barreno',
    'escurridor', 'pinzas de ropa', 'rodillo quitapelusas', 'estropajo',
    'borrador magico', 'bayeta microfibra', 'guantes limpieza', 'guantes latex',
    'plumero',
    // Incontinencia
    'incontinencia', 'protector de cama',
    // Plurales y formas alternativas no cubiertas arriba
    'esponjas de bano', 'esponjas de ducha', 'desmaquillante', 'desmaquillantes',
    'bandas de cera', 'bandas de pelo', 'pinza de cejas', 'pinzas de cejas',
    'lote corporal', 'lote facial',
    'hidrogel', 'parches ojos', 'parches hidro',
    'higiene dental', 'arcos dentales', 'cortacuticulas', 'corta cuticulas',
    'fragancia', 'fragance', 'perfume', 'fps', 'factor de proteccion',
    'arbol del te', 'tea tree',
    'nivea men', 'axe dark', 'axe ice',
    'gel aceite de bano', 'piel atopica', 'piel sensible crema',
    'gasas para bebe', 'gasas esteriles',
    // Accesorios y útiles no comestibles
    'brocheta', 'brochetas', 'palillo chino', 'palillos chinos',
    'filtros cafe', 'filtro cafe', 'capsula cafe', 'capsulas cafe',
    'papel de horno', 'manga pastelera', 'brocha cocina',
]

// Categorías que indican que un item es SIEMPRE comida (ignora keywords)
const CATEGORIAS_SIEMPRE_COMESTIBLES = new Set([
    'arroces y pastas', 'bebidas', 'frutas', 'verduras', 'carnes', 'pescados',
    'lacteos', 'lacteos y huevos', 'legumbres', 'cereales', 'frutos secos',
    'pan y bolleria', 'pan', 'aceites', 'salsas y condimentos', 'conservas',
    'congelados', 'snacks', 'dulces', 'postres', 'embutidos', 'quesos',
    'huevos', 'sopas y caldos',
])

function esNoComestiblePorNombre(nombre, categoria) {
    const n = normalizar(nombre)

    // 1. Whitelist — siempre comestible
    if (WHITELIST_COMESTIBLES.some(w => n.includes(normalizar(w)))) return false

    // 2. Categoría explícitamente comestible — no borrar
    if (categoria) {
        const cat = normalizar(categoria)
        if ([...CATEGORIAS_SIEMPRE_COMESTIBLES].some(c => cat.includes(c))) return false
    }

    // 3. Keyword matching
    return KEYWORDS_NO_COMESTIBLE.some(kw => n.includes(normalizar(kw)))
}

// ─── Main ──────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════')
console.log('   AUDITORÍA DE BASE DE DATOS — ALIMENTOS MERCADONA    ')
console.log('═══════════════════════════════════════════════════════\n')

// 1. Obtener supermercado Mercadona
const { data: sm, error: smErr } = await supabase
    .from('supermercados')
    .select('*')
    .eq('slug', 'mercadona')
    .single()

if (smErr || !sm) {
    console.error('❌ No se encontró el supermercado Mercadona en BD.')
    console.log('   Comprueba que existe en la tabla supermercados con slug="mercadona"')
    process.exit(1)
}

console.log(`✅ Supermercado: ${sm.nombre} (${sm.id})\n`)

// 2. Obtener TODOS los alimentos de Mercadona via productos_supermercado
let allProducts = []
const PAGE_SIZE = 1000
let from = 0

while (true) {
    const { data, error } = await supabase
        .from('productos_supermercado')
        .select('alimento_id, alimentos(id, nombre, calorias, proteinas, carbohidratos, grasas, fibra, categoria, fuente, created_at)')
        .eq('supermercado_id', sm.id)
        .range(from, from + PAGE_SIZE - 1)

    if (error) {
        console.error('❌ Error al obtener productos:', error.message)
        process.exit(1)
    }

    if (!data || data.length === 0) break
    allProducts = allProducts.concat(data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
}

const alimentos = allProducts
    .map(p => p.alimentos)
    .filter(Boolean)

console.log(`📦 Total alimentos vinculados a Mercadona: ${alimentos.length}\n`)

// 3. Clasificar
const noComestibles = alimentos.filter(a => esNoComestiblePorNombre(a.nombre, a.categoria))
const comestibles = alimentos.filter(a => !esNoComestiblePorNombre(a.nombre, a.categoria))
const sinMacros = comestibles.filter(a => a.calorias === 0 || a.calorias === null)
const conMacros = comestibles.filter(a => a.calorias > 0)

// ─── Estadísticas ─────────────────────────────────────────────────────────────
console.log('─── ESTADÍSTICAS ────────────────────────────────────────')
console.log(`🍽️  Comestibles:         ${comestibles.length}`)
console.log(`   ✅ Con macros:        ${conMacros.length}`)
console.log(`   ⚠️  Sin macros (→IA): ${sinMacros.length}`)
console.log(`🚫 No comestibles:       ${noComestibles.length}`)
console.log(`   (${((noComestibles.length / alimentos.length) * 100).toFixed(1)}% del total vinculado a Mercadona)\n`)

// ─── Muestra de no comestibles ────────────────────────────────────────────────
console.log('─── NO COMESTIBLES DETECTADOS (muestra) ────────────────')
const muestra = noComestibles.slice(0, 30)
for (const a of muestra) {
    console.log(`  🚫 [${a.categoria || '?'}] ${a.nombre}`)
}
if (noComestibles.length > 30) {
    console.log(`  ... y ${noComestibles.length - 30} más`)
}

// ─── Muestra de comestibles sin macros ────────────────────────────────────────
console.log('\n─── COMESTIBLES SIN MACROS (pendiente DeepSeek) ────────')
const muestraSinMacros = sinMacros.slice(0, 30)
for (const a of muestraSinMacros) {
    console.log(`  ⚠️  [${a.categoria || '?'}] ${a.nombre}`)
}
if (sinMacros.length > 30) {
    console.log(`  ... y ${sinMacros.length - 30} más`)
}

// ─── Muestra de comestibles con macros ────────────────────────────────────────
console.log('\n─── COMESTIBLES CON MACROS (✅ correctos) ───────────────')
const muestraConMacros = conMacros.slice(0, 10)
for (const a of muestraConMacros) {
    console.log(`  ✅ ${a.nombre} — ${a.calorias}kcal | P:${a.proteinas}g C:${a.carbohidratos}g G:${a.grasas}g`)
}
if (conMacros.length > 10) {
    console.log(`  ... y ${conMacros.length - 10} más`)
}

// ─── Exportar a JSON ─────────────────────────────────────────────────────────
if (EXPORTAR) {
    const salidaPath = resolve(projectRoot, 'salidas')
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '-')

    writeFileSync(
        resolve(salidaPath, `${fecha}_no-comestibles-mercadona.json`),
        JSON.stringify(noComestibles.map(a => ({ id: a.id, nombre: a.nombre, categoria: a.categoria })), null, 2)
    )
    writeFileSync(
        resolve(salidaPath, `${fecha}_comestibles-sin-macros-mercadona.json`),
        JSON.stringify(sinMacros.map(a => ({ id: a.id, nombre: a.nombre })), null, 2)
    )
    console.log(`\n📁 Archivos exportados a salidas/`)
}

// ─── Borrar no comestibles ────────────────────────────────────────────────────
if (BORRAR) {
    if (noComestibles.length === 0) {
        console.log('\n✅ No hay no-comestibles que borrar.')
        process.exit(0)
    }

    const ids = noComestibles.map(a => a.id)
    console.log(`\n🗑️  Eliminando ${ids.length} no-comestibles de la BD...`)

    // Primero: borrar de productos_supermercado
    const { error: e1 } = await supabase
        .from('productos_supermercado')
        .delete()
        .in('alimento_id', ids)

    if (e1) {
        console.error('❌ Error al borrar de productos_supermercado:', e1.message)
        process.exit(1)
    }

    // También borrar de precios_historico si existe
    await supabase
        .from('precios_historico')
        .delete()
        .in('alimento_id', ids)
        .then(({ error }) => {
            if (error && !error.message.includes('does not exist')) {
                console.warn('⚠️  Error al borrar de precios_historico:', error.message)
            }
        })

    // Finalmente: borrar de alimentos
    const { error: e2 } = await supabase
        .from('alimentos')
        .delete()
        .in('id', ids)

    if (e2) {
        console.error('❌ Error al borrar de alimentos:', e2.message)
        console.log('   Puede que haya alimentos usados en planes de dietas.')
        console.log('   Usa --export para revisar la lista completa antes de borrar.')
        process.exit(1)
    }

    console.log(`✅ ${ids.length} no-comestibles eliminados correctamente.`)
    console.log(`\n📊 Quedan en BD:`)
    console.log(`   🍽️  Comestibles con macros: ${conMacros.length}`)
    console.log(`   ⚠️  Comestibles sin macros:  ${sinMacros.length}`)
    console.log(`\nPróximo paso: node scripts/enriquecer-alimentos.mjs para generar kcal/macros con IA`)
} else {
    console.log('\n──────────────────────────────────────────────────────')
    console.log('Modo auditoría (solo lectura). Para actuar:')
    console.log('  --delete   eliminar los no-comestibles')
    console.log('  --export   guardar listas en salidas/')
    console.log('  --delete --export   hacer ambas cosas')
}
