/**
 * Backfill: marcar es_comestible en alimentos existentes
 *
 * Aplica la misma lógica de esNoComestible() que usa el scraper en
 * lib/scraping/index.ts a TODOS los alimentos de la BD.
 *
 * USO:
 *   node --env-file=.env.local scripts/backfill-es-comestible.mjs              --dry-run
 *   node --env-file=.env.local scripts/backfill-es-comestible.mjs --aplicar    --escribe BD
 *   node --env-file=.env.local scripts/backfill-es-comestible.mjs --sql        --genera SQL
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Misma lógica que lib/scraping/index.ts ─────────────────────

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
    'absorbeolores', 'antipolilla', 'antipolillas',
    'repelente insectos', 'repelente mosquitos',
    'citronela colgador', 'pulsera citronela',
    'aditivo textil', 'quitamanchas prelavado', 'prelavado spray',
    'desinfectante textil', 'quitamanchas desinfectante',
    // ── Bebidas / mascotas ──────────────────────────────────────
    'comida perro', 'comida para perro', 'pienso perro', 'pienso para perro',
    'comida gato', 'comida para gato', 'pienso gato', 'pienso para gato',
    'comida húmeda perro', 'comida húmeda gato',
    'snack perro', 'snack para perro', 'snack gato', 'snack para gato',
    'hueso para perro',
    'arena gato', 'arena para gato', 'arenero',
    'leche polvo gato', 'leche maternizada gato',
    'antipulgas', 'antiparasitario',
    'shampoo perro',
    // ── Material de oficina / hogar ─────────────────────────────
    'pilas', 'batería ', 'cargador', 'bombilla', 'adaptador corriente',
    'pinza', 'brida', 'cinta adhesiva', 'celo', 'pegamento',
    'tijeras', 'cúter', 'navaja',
    'candado', 'cerradura',
    'filtro agua', 'filtro de agua',
    'fundas cojín', 'funda cojín',
    'colgador', 'perchero', 'estante', 'balda',
    'vela aromática', 'vela decorativa', 'vela de cumpleaños', 'vela led',
    'mechero', 'encendedor',
    'cenicero', 'cigarrillos',
    // ── Animales vivos ──────────────────────────────────────────
    'comida para peces', 'comida peces',
    // ── Electrodomésticos ───────────────────────────────────────
    'freidora de aire', 'freidora sin aceite',
    'microondas ', 'horno eléctrico', 'tostadora', 'sandwichera',
    'robot cocina',
    // ── Mascotas (general) ──────────────────────────────────────
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
    // ── Tabaco ──────────────────────────────────────────────────
    'tabaco', 'cigarro',
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
    'spray para freidora', 'spray freidora',
    'spray especial freidora',
    'aceite para freidora',
]

function esNoComestible(nombre) {
    const lower = nombre.toLowerCase()

    const tieneVatios = /\d{3,}\s*w/i.test(lower) || /\(w\)/i.test(lower)
    if (tieneVatios) return true

    const matchKw = NO_COMESTIBLE_KEYWORDS.find(kw => lower.includes(kw))
    if (matchKw) {
        if (matchKw.includes('dosificador') && lower.includes('miel')) return false
        if (matchKw === 'grill' && (lower.includes('brocheta') || lower.includes('minigrill')
            || lower.includes('tostada') || lower.includes('biscotes'))) return false
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

// ─── Main ──────────────────────────────────────────────────────

const APLICAR = process.argv.includes('--aplicar')
const GENERAR_SQL = process.argv.includes('--sql')

async function main() {
    console.log('══════════════════════════════════════════════════════')
    console.log('  Backfill: es_comestible en alimentos')
    console.log(`  Modo: ${APLICAR ? '✅ APLICAR (escribe en BD)' : GENERAR_SQL ? '📄 Generar SQL' : '🔍 Dry-run (solo lectura)'}`)
    console.log('══════════════════════════════════════════════════════\n')

    // Cargar todos los alimentos (la columna es_comestible se añade vía migración SQL)
    const { data: alimentos, error } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .order('nombre')

    if (error) {
        console.error('❌ Error al cargar alimentos:', error.message)
        process.exit(1)
    }

    console.log(`📦 Total alimentos en BD: ${alimentos.length}\n`)

    const noComestibles = []

    for (const a of alimentos) {
        const deberiaSer = !esNoComestible(a.nombre)
        if (!deberiaSer) {
            noComestibles.push(a)
        }
    }

    console.log(`🍽️  Comestibles: ${alimentos.length - noComestibles.length}`)
    console.log(`🚫 No comestibles: ${noComestibles.length}`)

    if (noComestibles.length > 0) {
        console.log('\n📋 No comestibles detectados:\n')
        for (const a of noComestibles) {
            const kw = NO_COMESTIBLE_KEYWORDS.find(k => a.nombre.toLowerCase().includes(k))
                ?? ALCOHOL_KEYWORDS.find(k => a.nombre.toLowerCase().includes(k))
                ?? (/\d{3,}\s*w/i.test(a.nombre) ? 'VATIOS' : '?')
            console.log(`  • [${a.id.slice(0, 8)}] "${a.nombre}" → keyword: "${kw}"`)
        }
    }

    if (GENERAR_SQL && noComestibles.length > 0) {
        const ids = noComestibles.map(a => `'${a.id}'`)
        console.log('\n─── SQL GENERADO ─────────────────────────────────\n')
        console.log(`update public.alimentos set es_comestible = false where id in (${ids.join(', ')});`)
        console.log(`\n-- Total: ${noComestibles.length} alimentos marcados como no comestibles`)
    }

    if (APLICAR && noComestibles.length > 0) {
        console.log('\n✏️  Actualizando BD...')

        const LOTE = 100
        for (let i = 0; i < noComestibles.length; i += LOTE) {
            const lote = noComestibles.slice(i, i + LOTE)
            const ids = lote.map(a => a.id)

            const { error: updateError } = await supabase
                .from('alimentos')
                .update({ es_comestible: false })
                .in('id', ids)

            if (updateError) {
                console.error(`  ❌ Error actualizando lote ${i / LOTE + 1}: ${updateError.message}`)
            } else {
                console.log(`  ✅ Lote ${i / LOTE + 1}: ${lote.length} alimentos actualizados`)
            }
        }

        console.log(`\n✅ ${noComestibles.length} alimentos marcados como es_comestible = false`)
    }

    if (!APLICAR && !GENERAR_SQL) {
        console.log('\n💡 Para aplicar: node scripts/backfill-es-comestible.mjs --aplicar')
        console.log('💡 Para SQL:     node scripts/backfill-es-comestible.mjs --sql')
    }
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})
