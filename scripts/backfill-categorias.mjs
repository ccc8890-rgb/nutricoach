#!/usr/bin/env node
/**
 * Backfill de categorías — Asigna categoría real a alimentos etiquetados como "Otros"
 *
 * Usa reglas basadas en el nombre del alimento para clasificarlos correctamente.
 * Sin IA, 100% local. Procesa todos los alimentos con categoría = 'Otros'.
 *
 * Uso:
 *   node scripts/backfill-categorias.mjs              # Producción
 *   node scripts/backfill-categorias.mjs --dry-run    # Solo diagnóstico
 *
 * CATEGORÍAS DISPONIBLES:
 *   Carnes, Pescados, Verduras, Frutas, Legumbres, Lacteos,
 *   Cereales, Huevos, Frutos secos, Aceites y grasas,
 *   Condimentos, Salsas y condimentos, Snacks, Bebidas,
 *   Dulces y bolleria, Platos preparados, Mascotas
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(PROJECT_ROOT, '.env.local')
    if (!existsSync(envPath)) {
        console.error('❌ No se encuentra .env.local en', envPath)
        process.exit(1)
    }
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        process.env[key] = value
    }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

// ── Colors ──
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'

function log(...a) { console.log(`[${new Date().toLocaleTimeString()}]`, ...a) }
function ok(msg) { log(`${GREEN}✓${RESET} ${msg}`) }
function warn(msg) { log(`${YELLOW}⚠${RESET} ${msg}`) }
function err(msg) { log(`${RED}✗${RESET} ${msg}`) }

// ── REGLAS DE CLASIFICACIÓN ─────────────────────────────────
// NOTA: las regex se escriben SIN acentos porque normalizar()
// elimina los diacríticos antes de hacer match.
// El orden importa: primero reglas más específicas, después genéricas.

const REGLAS = [
    // ============================================================
    // ❌ NO COMESTIBLES (cosmética, higiene, mascotas)
    // ============================================================
    { test: n => /barra labial|barra labios|labial limit|pasta encias/.test(n), cat: '__SKIP__' },
    { test: n => /comida (gato|gatos|perro|perros|perr[oa])|comida (seca|humeda) (gatos|perros)/.test(n), cat: 'Mascotas' },

    // ============================================================
    // 🥨 SNACKS SALADOS
    // ============================================================
    { test: n => /doritos|cheetos|takis|gusanitos|nachos|triangulos.*maiz|snack.*maiz|palomitas|fritos.*barbacoa|snack.*papadelta|snack.*gublins|boom tijuana|triskys|pringles|lote lay.?s|patatas fritas|ruffles|patates xips|patates fregides|patates ranxeres|lays.*bugles|bugles|kaskys|aperitiu krititas|aperitivo sabores mediterraneos|combinado aperitivos|tiras de maiz frito|snack crispy|mix up favoritos|party mix|flash popitos|kids mix|crispy twist|bocados mediterraneos|tequenos/.test(n), cat: 'Snacks' },

    // ============================================================
    // 🍪 DULCES Y BOLLERÍA
    // ============================================================
    { test: n => /magdalena|magdalenes|croissant|donette|donuts?|donas?|gofre|berlines|palmerita|palmera cacao|palmeras$|ensaimada|mantecada|sobao|briochoco|briox?|brioche|brioix|bizcocho|bizcochit|bizcochad|brownie|tartaleta|bombon|cacao.*negro|cacao.*puro|kit kat|kinder|super cuquis|galactic|chapelas|valencianas|rollino|rosegones|obleas|minibiscotte|bocaditos|hojaldres? astorga|hojaldre cabello|hojaldre relleno|hojaldritos|lacasitos|tropifrutti|biscotte|rosquilletas.*choco|galetes($|[^a-z])|barritas.*cookies|barritas rellenas.*nocilla|crema.*cookies|crema.*cacao.*original|crema.*cacao.*noir|crema untar.*crunchy|crema de cacao/.test(n), cat: 'Dulces y bolleria' },

    // Bollería variada (segundo bloque para no saturar la regex anterior)
    { test: n => /fartons?|napolitana|susos (\()?|can(a|e) de hojaldre|espiral.*cacao|rosquilla.*cacao|bollycao|brazo de cacao|pandorino|trenza crema|trancetto|tubitos rellenos|capellanes secos|cake precortado|carrot cake|tarta infantil|tarta congelada|tarta.*hacendado congelada|tarta.*dibujos|tarta.*princesa|tarta.*san marcos|tarta.*tres caprichos|tarta.*carrot|tarta.*abuela|tarta.*red velvet|tarta.*selva negra|tarta.*choco dubai|tarta.*cookies.*cream|tarta.*fresa$|tarta.*zanahoria|base de tarta|tarta cookies|pastel san marcos|pastel.*bajo en azucar|pastel de crema/.test(n), cat: 'Dulces y bolleria' },

    // Más bollería / repostería
    { test: n => /lionesas|milhojas|milfulles|pa pessic|bollo rustico|bollisol|naranja bollo|pastelito|pastel sara|pastel crema|coquito|turron viena|bloque turron|bloque.*tres sabores|torta de aceite|tortas de aceite|tortas de anis|rosquillas bolsa|capricho romana|hoops glaseados|litines|plaquita felicidades|decomagia|artesanitos surtidos|barquillo.*b-ready|barquillos rellenos|barquillo relleno|algodon magico|algodon mágico|churros|xurros|crepes?$|creps?$|churros lazo|churros bites/.test(n), cat: 'Dulces y bolleria' },

    // Cremas dulces / frambuesas cubiertas chocolate
    { test: n => /frambuesas cubiertas|cheesecake|tarta.*cheesecake/.test(n), cat: 'Dulces y bolleria' },

    // Chocolatinas, cremas untables dulces, snack dulces
    { test: n => /huesitos|chococlack|schokobons|conguitos|nutella.*go|nocistick|banda rocher|sandwich biscoff|sandwich oreo|sandwich relleno choco|sandwich dinosaurus|sandwich mixte|sandwich pro.?atun|snack cookies cake|snack cookies|smarties mix|gummies.*azucar|gummies.*melatonina|lotus biscoff|lunas banadas cacao/.test(n), cat: 'Dulces y bolleria' },

    // Neules, carquinyols, melindros, menjablanc — repostería catalana
    { test: n => /neules|carquinyols|melindros|menjablanc|rifacli|cuadraditos (tomate|jamon)/.test(n), cat: 'Dulces y bolleria' },

    // Golosinas, caramelos, chucherías
    { test: n => /golosina|caramelo|chicle|nubes? bicolor|nubes?$|cono golosinas|bolitas multicolores|banderillas dulces|gominolas|colorinas regaliz|big dots sugar|mini gomas|orbic? xiclets|regaliz/.test(n), cat: 'Dulces y bolleria' },

    // Cacao en polvo / chocolates para taza
    { test: n => /cacao (en polvo|soluble|polvo taza|puro en polvo|instantaneo|a la taza)/.test(n), cat: 'Dulces y bolleria' },
    { test: n => /^\d+%.*cacao/.test(n), cat: 'Dulces y bolleria' },

    // Barritas energéticas / fruta
    { test: n => /barritas? (frutas|energetic)/.test(n), cat: 'Snacks' },
    { test: n => /barreta energetica|nakd barretes/.test(n), cat: 'Snacks' },
    { test: n => /pouch.*cacao|pouch.*platano/.test(n), cat: 'Dulces y bolleria' },

    // Preparados de repostería
    { test: n => /preparado hornear|preparado oreo cake|preparado pastel fresco|preparado para reposteria|preparado tortitas pancakes/.test(n), cat: 'Dulces y bolleria' },

    // ============================================================
    // 🍨 HELADOS Y POSTRES HELADOS
    // ============================================================
    { test: n => /helado|calippo|cono extreme|cono.*lima.*limon|cono.*peanut.*caramel|cono.*fresa|cornetto|magnum|maxibon|pirulo|polo hielo|frigo pie|mochi|trufas heladas|tarrina.*cafe.*latte|tarrina.*cookie.*dough|tarrina.*nutella|tarrina.*oreo|tarrina.*stracciatella|tarrina.*turron|tarrina.*vainilla|tarrinas fruit|tarrina cappuccino|tarrinas caramel|tarrina strawberry|sorbet llimona|sorbete|granizado.*limon|mini conos.*vainilla/.test(n), cat: 'Lacteos' },

    // ============================================================
    // 🥛 POSTRES LÁCTEOS (flan, natillas, crema catalana, gelatina, mousse, tarrinas)
    // ============================================================
    { test: n => /flam?n( de)? |flan$|natillas|crema catalana|tiramisu|flam d.ou|flam bany|preparado en polvo flan|gelatina|preparado en polvo gelatina|d?anet natilles|postre gelificado|postre.*trufa|postre.*manzana.*jamar|mousse.*limon|mousse.*chocolate|mochi/.test(n), cat: 'Lacteos' },

    // ============================================================
    // 🍯 AZÚCARES / EDULCORANTES / MIEL / SIROPES
    // ============================================================
    { test: n => /^azucar|edulcorante|endulzante|eritritol|miel de |miel (milflores|azahar|eucalipto)|sirope|jarabe|xarop/.test(n), cat: 'Condimentos' },

    // ============================================================
    // 🥫 MERMELADAS / CONFITURAS / DULCES UNTABLES
    // ============================================================
    { test: n => /mermelada|melmelada|membrillo|cabello de angel|cabello angel|dulce de membrillo|codonyat|confitura|dulce de frutas/.test(n), cat: 'Condimentos' },

    // Cremas dulces para untar (nocilla, nutella-like)
    { test: n => /crema (de )?cacao (noir|original|vaso)|crema untar.*crunchy|cookies mini nocilla|cookies nocilla/.test(n), cat: 'Dulces y bolleria' },

    // ============================================================
    // 🥘 PLATOS PREPARADOS (congelados, conservas, empanadas, etc.)
    // ============================================================
    // Empanadas, lasañas, canelones, pasta preparada
    { test: n => /empanada|lasan( |$|[abcdfglmp])|lasana|lasanya|canelons?|canelones|cappelletti|tortellini|tortelloni|tortel.linis|farfalle|raviolis?|tagliatelle|espaguetis preparados|macarrones preparados/.test(n), cat: 'Platos preparados' },

    // Croquetas (croqueta, croquetas, croquetes, minicroquetes)
    { test: n => /croquet[ae]s?|minicroquetes/.test(n), cat: 'Platos preparados' },

    // Pizzas, empanadillas, gyozas, rolls
    { test: n => /empanadilla|gyoza|rollitos? primavera|rotllet|rollito primavera|pinsa|pizza/.test(n), cat: 'Platos preparados' },

    // Burgers, nuggets, fingers, san jacobo, etc.
    { test: n => /burger|burguer|hamburguesa|nuggets?|finger|san jacobo|cheddar bites|cheese burger|instant burger/.test(n), cat: 'Platos preparados' },

    // Platos preparados de pescado / marisco
    { test: n => /boqueron tempura|anillas?.*romana|anillos.*romana|corazones romana|fish.?chips|filets peix|anelles ceba|tacos de poton|sardinillas|chipirones rellenos/.test(n), cat: 'Platos preparados' },

    // Platos preparados de carne / guisos
    { test: n => /callos|fabada|chili.*carne|chicken nuggets|albondiga|torrijas|berlina|estofado|compango|bacalla|fricando vedella|camembert empanado|rosca rustica|banderillas picantes|helices con vegetales|empedrat|tarrito.*noches|alas crunchy|alitas brooklyn|alitas de brocoli|estofat vedella|xurrasco vedella|blanqueta pollastre|carne pimiento choricero|carrilleras|oreja guisada|pelota cocido|perdiz escabeche|marmitako|bloc foie|bloc higado|pate (superior|iberico|pato|finas hierbas|sobrasada)|delicia sobrasada|delicias aguinaga/.test(n), cat: 'Platos preparados' },

    // Platos preparados veganos / vegetarianos
    { test: n => /vegan burger|burger.*vegetal|burgers vegetales|mini.?burger|hamburguesa vegetal|vegetariano|empanado vegetariano|lonchas veganas?|lonchas vegetarianas|tortilla vegana/.test(n), cat: 'Platos preparados' },

    // Paella, risotto, tabulé, noodles
    { test: n => /paella|risotto|tabule|noodles|yakisoba|tacos poton|delisandwich|frankfurt|airfryer crispy|relleno empanadas|relleno fajitas|preparado de paella|preparat paella/.test(n), cat: 'Platos preparados' },

    // Sopas instantáneas, pasta preparada
    { test: n => /demae ramen|yatekomo|tallarines carbonara|tallarines parmesana|paninis? barbacoa|bocata rustico|bocadillos?|bocadelia preparat|naming sandvitx|sandwich mixto/.test(n), cat: 'Platos preparados' },

    // Platos preparados catalanes / Terra i Tast
    { test: n => /trinxat|espinacs catalana|truita carbasso|truita d.alberginia|truita.*ceba|tires estil mediterrani|escalopa arrebossada|mandonguilles|pilotilles|gira.sols.*farcits|crestes tonyina|aloloco empanada|argal.*amanida.*cranc|aguinamar.*amanida|collita amanida|florette amanida/.test(n), cat: 'Platos preparados' },

    // Embutidos / fiambres preparados
    { test: n => /minifuets|palito sobrasada|argal fuet|fuet.*bread/.test(n), cat: 'Snacks' },

    // Conservas / ahumados / escabeches
    { test: n => /llagosti mediterrani|tamburinas|pop gallega|fumet peix|bloc foie|sardinillas|perdiz escabeche|berberechos|mejillones escabeche|pimiento choricero frasco/.test(n), cat: 'Platos preparados' },

    // ============================================================
    // 🥗 VERDURAS / CREMAS / SOPAS
    // ============================================================
    // Cremas de verduras
    { test: n => /crema (de )?(verduras|calabacin|calabaza|esparragos|champiny|vichyssoise|jamon york|cebolla)/.test(n), cat: 'Verduras' },

    // Sopas y caldos
    { test: n => /^sopa |sopa juliana|sopa hortelana|sopa de |sopa maravilla|sopa peix|sopa pollastre|sopa verduras|sopinstant|caldo|brou /.test(n), cat: 'Verduras' },

    // Verduras preparadas / congeladas
    { test: n => /espinacas.*crema|alcachofas.*tempura|tempura.*verduras|tempura.*verdures|tempura carbasso|tempura d.alberginia|broquil arrebossat|carxofes tempura|punta enfarinada|seitons tempura|verdures tempura|berenjena rellena|calabacin relleno|espinacas.*crema/.test(n), cat: 'Verduras' },

    // Verduras frescas individuales
    { test: n => /^cebolleta|^chalotas?|^moniato|ceba dolc|ceba fregida|cebolla crujiente|cebolla frita/.test(n), cat: 'Verduras' },

    // ============================================================
    // 🫒 ACEITUNAS / ENCURTIDOS / ENVASADOS
    // ============================================================
    { test: n => /^aceitunas|aceitunas rellenas|banderilla gildas/.test(n), cat: 'Verduras' },

    // ============================================================
    // 🌶️ SALSAS Y CONDIMENTOS
    // ============================================================
    { test: n => /^hummus|guacamole|gochugaru|gochujang|crema de (camembert|sobrasada)|pate.*finas hierbas|pate.*iberico|pate.*pato/.test(n), cat: 'Salsas y condimentos' },

    // ============================================================
    // 🥛 BEBIDAS
    // ============================================================
    { test: n => /^brou |brou (casola|pollastre)|crema de meloncello|sorbete/.test(n), cat: 'Bebidas' },

    // ============================================================
    // 🌾 CEREALES / GALLETAS / TORTITAS / PAN
    // ============================================================
    { test: n => /rosquilletas|tortitas de maiz|tortitas panquecas|preparado.*crepes|creps?$|coquetes blat moro|cocas dacsa|cocas de dacsa|cereal.*desayuno|corn flakes|muesli|avena|galletas? (maria|digestive|integral|chocolate|avena)/.test(n), cat: 'Cereales' },

    // PASQUIER Tortitas (tortitas de arroz)
    { test: n => /pasquier.*tortitas/.test(n), cat: 'Cereales' },

    // ============================================================
    // 🥜 FRUTOS SECOS / SEMILLAS
    // ============================================================
    { test: n => /cacahuetes?|almendras?|nueces?|avellanas?|pipas?|pistachos?|anacardos?|semillas? (chia|linaza|sesamo|calabaza)|mix.*frutos secos|frutos secos variados/.test(n), cat: 'Frutos secos' },

    // ============================================================
    // 🥩 CARNES / EMBUTIDOS
    // ============================================================
    { test: n => /lomo embuchado|chorizo?|salchichon?|jamon (serrano|iberico|cocido|york)|pavo (cocido|ahumado)|pechuga pavo|cecina|sobrasada|butifarra|salchichas?|longaniza|morcilla|fuet|minifuet/.test(n), cat: 'Carnes' },

    // ============================================================
    // 🧀 LÁCTEOS GENERAL
    // ============================================================
    { test: n => /queso? (fresco|rallado|crema|de untar|manchego|emmental|gouda|edam|mozzarella|brie|cabrales|roquefort|parmesano|curado|viejo|semicurado|en porciones|laminas|lonchas)/.test(n), cat: 'Lacteos' },

    // ============================================================
    // 🐟 PESCADOS / MARISCOS
    // ============================================================
    { test: n => /atun (claro|al natural|en aceite|escabeche)|atun desmigado|sardinas?|caballa|merluza|bacalao|salmone?s? (ahumado|fresco)|boquerones?|anchoas?|mejillones?|navajas?|almejas?|gambas?|langostinos?|calamares?|pota|sepia|cangrejo|cigalas?|vieiras?|pulpo/.test(n), cat: 'Pescados' },

    // ============================================================
    // 🥠 COMIDA BEBÉ / POTITOS
    // ============================================================
    { test: n => /smileat.*potet|potet.*vedella|tarrito.*lenguado|tarrito.*buenas noches|comida bebe|potito/.test(n), cat: 'Platos preparados' },

    // ============================================================
    // 🎯 CATCH-ALL — Patrones específicos detectados manualmente
    // ============================================================

    // Platos preparados: guisos, carnes preparadas, moussaka, sushi, etc.
    { test: n => /moussaka|mussaka|parrillada campestre|jugoso.*barbacoa|cocido madrile?no|hot dog|sushi|tequenos?|hakao|bo debo|tallarins|crestes|aloloco|argal.*fuet|pastel.*atun|empanados vegetales.*soja|lonchas finas vegetal|girasoles setas|lazan bolonesa|lazan.*bechamel|lazan.*familiar|lasan (a|b|f|m|t)|lasan$|nuggets.*arrebossat|nuggets.*pollo|nuggets.*veg|nuggets.*pollastre|hacendado ultracongelad.*(croqueta|lasan|crepes|churros)/.test(n), cat: 'Platos preparados' },

    // Barritas de fruta / manzana
    { test: n => /barritas? (manzana|fruta)/.test(n), cat: 'Snacks' },

    // Bollería y dulces — patrones adicionales
    { test: n => /hojaldres de astorga|hojaldre.*carne|lazos.*hojaldre|torta.*aceite.*sin.*azucar|barquillo.*vainilla|tortitas.*americanas|crepes.*choco|crepes.*hacendado|cocas cidoncha|algodon magico|algodon mágico|crepes? (choco|hacendado)|churros.*bites|crispy twist/.test(n), cat: 'Dulces y bolleria' },

    // Miel — catch-all for "Miel"
    { test: n => /^miel /, cat: 'Condimentos' },

    // Azúcares — catch-all for "azúcar" anywhere
    { test: n => /azucar|panela|terron.*azucar/.test(n), cat: 'Condimentos' },

    // Cocktail almíbar
    { test: n => /cocktail.*almibar/.test(n), cat: 'Condimentos' },

    // BEBIDAS — granizado / sorbete
    { test: n => /granizado/.test(n), cat: 'Bebidas' },

    // ENSALADAS preparadas (amanida)
    { test: n => /amanida (cesar|japo|l.ort)/.test(n), cat: 'Platos preparados' },

    // ALTERNATIVA3 Cacau Instant → Dulces
    { test: n => /cacau instant|cacao instant/.test(n), cat: 'Dulces y bolleria' },

    // Sushi
    { test: n => /sushi/.test(n), cat: 'Platos preparados' },

    // Tapas preparadas: banderilla gildas, pimientos
    { test: n => /pimiento.*choricero|banderilla.*gildas/.test(n), cat: 'Verduras' },
]

// Normalizar nombre para matching
function normalizar(n) {
    return (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function clasificar(nombre) {
    const n = normalizar(nombre)
    for (const regla of REGLAS) {
        if (regla.test(n)) return regla.cat
    }
    return null
}

// ── Fetch all con paginación ──
async function fetchAll(query) {
    let all = []
    let from = 0
    const limit = 1000
    while (true) {
        const url = `${SUPABASE_URL}/rest/v1/${query}&offset=${from}`
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Accept': 'application/json',
            }
        })
        if (!res.ok) break
        const data = await res.json()
        if (!data || data.length === 0) break
        all = all.concat(data)
        from += limit
    }
    return all
}

// ── Main ──
async function main() {
    log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    log(`${MAGENTA}  🏷️  BACKFILL DE CATEGORÍAS — Alimentos \"Otros\"${RESET}`)
    log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    log(`Dry-run: ${DRY_RUN ? 'SÍ' : 'NO'}`)
    log('')

    const otros = await fetchAll('alimentos?select=id,nombre,categoria,calorias&categoria=eq.Otros')
    log(`📦 Total alimentos categoría "Otros": ${otros.length}`)
    log('')

    // Clasificar
    const resultados = { clasificados: 0, noClasificados: 0, porCategoria: {} }
    const sinClasificar = []
    const cambios = []

    for (const a of otros) {
        const nuevaCat = clasificar(a.nombre)
        if (nuevaCat && nuevaCat !== '__SKIP__') {
            resultados.clasificados++
            resultados.porCategoria[nuevaCat] = (resultados.porCategoria[nuevaCat] || 0) + 1
            cambios.push({ id: a.id, nombre: a.nombre, vieja: 'Otros', nueva: nuevaCat })
        } else if (nuevaCat === '__SKIP__') {
            resultados.noClasificados++
            sinClasificar.push({ ...a, _skip: true })
        } else {
            resultados.noClasificados++
            sinClasificar.push(a)
        }
    }

    // Mostrar resumen
    const pctClasif = ((resultados.clasificados / otros.length) * 100).toFixed(1)
    console.log(`\n${CYAN}📊 RESULTADOS:${RESET}`)
    console.log(`   ${GREEN}Clasificados:${RESET}     ${resultados.clasificados} (${pctClasif}%)`)
    console.log(`   ${YELLOW}No clasificados:${RESET}  ${resultados.noClasificados} (${((resultados.noClasificados / otros.length) * 100).toFixed(1)}%)`)
    console.log('')

    console.log(`${CYAN}📊 Distribución por categoría asignada:${RESET}`)
    const sorted = Object.entries(resultados.porCategoria).sort((a, b) => b[1] - a[1])
    for (const [cat, count] of sorted) {
        const pct = ((count / resultados.clasificados) * 100).toFixed(1)
        console.log(`   ${cat.padEnd(25)} ${String(count).padStart(5)} (${pct}%)`)
    }

    // Mostrar muestra de no clasificados
    if (sinClasificar.length > 0) {
        console.log(`\n${YELLOW}⚠️  MUESTRA DE NO CLASIFICADOS (${Math.min(sinClasificar.length, 30)} de ${sinClasificar.length}):${RESET}`)
        for (const a of sinClasificar.slice(0, 30)) {
            console.log(`   ${(a.nombre || '?').padEnd(50)} [${a.categoria}]`)
        }
    }

    if (DRY_RUN) {
        log(`\n${YELLOW}🏁 MODO DRY-RUN — No se modificó la base de datos.${RESET}`)
        log(`Para ejecutar: node scripts/backfill-categorias.mjs`)
        return
    }

    // ── Actualizar en Supabase ──
    log(`\n${CYAN}🚀 Actualizando ${cambios.length} alimentos...${RESET}`)

    let ok = 0
    let errors = 0
    const batchSize = 50

    for (let i = 0; i < cambios.length; i += batchSize) {
        const batch = cambios.slice(i, i + batchSize)
        const pct = Math.round((i / cambios.length) * 100)
        log(`   [${Math.floor(i / batchSize) + 1}/${Math.ceil(cambios.length / batchSize)} - ${pct}%] ${batch.length} alimentos...`)

        // Actualizar uno por uno para tener control fino
        for (const c of batch) {
            const { error } = await supabase
                .from('alimentos')
                .update({ categoria: c.nueva })
                .eq('id', c.id)

            if (error) {
                errors++
                if (errors <= 3) err(`${c.nombre}: ${error.message}`)
            } else {
                ok++
            }
        }

        // Pausa entre batches
        if (i + batchSize < cambios.length) {
            await new Promise(r => setTimeout(r, 200))
        }
    }

    log(`\n${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    log(`${GREEN}✅ BACKFILL COMPLETADO${RESET}`)
    log(`   Total procesados: ${cambios.length}`)
    log(`   Actualizados: ${ok}`)
    log(`   Errores: ${errors}`)
    log(`   Pendientes manuales: ${sinClasificar.length} (requieren revisión)`)
    log('')
}

main().catch(e => {
    console.error('💥 Fatal:', e.message)
    process.exit(1)
})
