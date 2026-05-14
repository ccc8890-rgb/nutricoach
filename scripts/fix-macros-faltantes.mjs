#!/usr/bin/env node
/**
 * fix-macros-faltantes.mjs
 *
 * Estima macros para alimentos que tienen calorias=0 pero deberían tenerlas.
 * Usa reglas por nombre/keywords para asignar macros realistas.
 * Luego recalcula las recetas afectadas.
 *
 * USO: node scripts/fix-macros-faltantes.mjs [--apply]
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnv()

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const headers = {
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
}

async function fetchAll(table, select, filter = '') {
    let all = [], from = 0, pageSize = 1000
    while (true) {
        const res = await fetch(`${SB}/rest/v1/${table}?select=${select}${filter}`, {
            headers: { ...headers, 'Range': `${from}-${from + pageSize - 1}` }
        })
        if (res.status === 416) break
        const data = await res.json()
        if (!data || !data.length) break
        all = all.concat(data)
        if (data.length < pageSize) break
        from += pageSize
    }
    return all
}

async function patch(table, id, body) {
    const res = await fetch(`${SB}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`PATCH error ${res.status}: ${await res.text()}`)
    return res.json()
}

/**
 * Mapa de macros por 100g para alimentos que no tienen datos.
 * Ordenado por matching: primero las reglas más específicas.
 *
 * ⚠️ IMPORTANTE: Colocar reglas más específicas ANTES que las genéricas.
 *    "Sal fina" debe ir antes que "sal" genérico.
 */
const MACROS_POR_NOMBRE = [
    // === HARINAS Y CEREALES ===
    { match: n => /^harina de trigo/i.test(n), kcal: 364, p: 10, g: 1, c: 76, f: 3 },
    { match: n => /^harina/i.test(n), kcal: 364, p: 10, g: 1, c: 76, f: 3 },
    { match: n => /copos de avena/i.test(n), kcal: 389, p: 17, g: 7, c: 66, f: 10 },
    { match: n => /muesli/i.test(n), kcal: 370, p: 10, g: 12, c: 60, f: 8 },
    { match: n => /cereales (avena|crunchy)/i.test(n), kcal: 400, p: 8, g: 12, c: 68, f: 5 },
    { match: n => /cereales cubiertos de chocolate/i.test(n), kcal: 400, p: 6, g: 10, c: 75, f: 3 },
    { match: n => /spaghetti al huevo/i.test(n), kcal: 370, p: 14, g: 4, c: 72, f: 3 },
    { match: n => /fideos orientales/i.test(n), kcal: 350, p: 8, g: 2, c: 75, f: 2 },
    { match: n => /pasta fresca/i.test(n), kcal: 280, p: 11, g: 4, c: 52, f: 3 },
    { match: n => /placas para canelones/i.test(n), kcal: 370, p: 13, g: 2, c: 75, f: 3 },
    { match: n => /lasaña/i.test(n), kcal: 130, p: 6, g: 3, c: 22, f: 3 },
    { match: n => /tostadas de arroz/i.test(n), kcal: 380, p: 8, g: 3, c: 82, f: 4 },
    { match: n => /tortillas de maíz/i.test(n), kcal: 218, p: 6, g: 3, c: 44, f: 5 },
    { match: n => /tortilla de trigo|tortilla trigo|wrap/i.test(n), kcal: 300, p: 8, g: 7, c: 52, f: 2 },
    { match: n => /pan de hamburguesa/i.test(n), kcal: 280, p: 10, g: 5, c: 50, f: 2 },
    { match: n => /arroz/i.test(n), kcal: 365, p: 7, g: 1, c: 80, f: 2 },
    { match: n => /garbanzo cocido/i.test(n), kcal: 139, p: 8, g: 2, c: 23, f: 5 },
    { match: n => /garbanzo/i.test(n), kcal: 139, p: 8, g: 2, c: 23, f: 5 },
    { match: n => /patatas fritas clásicas/i.test(n), kcal: 536, p: 7, g: 35, c: 50, f: 5 },

    // === FRUTOS SECOS Y SEMILLAS ===
    { match: n => /almendra.*(molida|tostada|frita|salada)/i.test(n), kcal: 600, p: 20, g: 50, c: 15, f: 10 },
    { match: n => /almendras molidas/i.test(n), kcal: 600, p: 20, g: 50, c: 15, f: 10 },
    { match: n => /nuez pecana/i.test(n), kcal: 690, p: 9, g: 72, c: 14, f: 10 },
    { match: n => /pipas.*calabaza/i.test(n), kcal: 550, p: 29, g: 47, c: 15, f: 5 },
    { match: n => /cacahuetes tostados|de cacahuete/i.test(n), kcal: 570, p: 26, g: 48, c: 16, f: 9 },
    { match: n => /cacahuete.*proteínas.*desgrasado|proteínas.*cacahuete/i.test(n), kcal: 400, p: 70, g: 7, c: 15, f: 5 },
    { match: n => /pasas/i.test(n), kcal: 300, p: 3, g: 0.5, c: 80, f: 4 },
    { match: n => /fruta desecada|orejones|higos secos/i.test(n), kcal: 280, p: 3, g: 1, c: 65, f: 7 },

    // === CHOCOLATE, AZÚCAR, DULCES ===
    { match: n => /chocolate.*85%/i.test(n), kcal: 590, p: 10, g: 45, c: 30, f: 12 },
    { match: n => /chocolate.*72%.*almendras/i.test(n), kcal: 550, p: 10, g: 40, c: 35, f: 10 },
    { match: n => /chocolate.*avellanas|crema.*chocolate.*avellanas/i.test(n), kcal: 540, p: 6, g: 32, c: 58, f: 3 },
    { match: n => /chocolate (doble|con leche|blanco)/i.test(n), kcal: 530, p: 6, g: 30, c: 60, f: 3 },
    { match: n => /azúcar (glas|moreno|blanco)/i.test(n), kcal: 400, p: 0, g: 0, c: 100, f: 0 },
    { match: n => /panela.*azúcar/i.test(n), kcal: 380, p: 1, g: 0, c: 95, f: 0 },
    { match: n => /mermelada/i.test(n), kcal: 250, p: 0.5, g: 0, c: 60, f: 1 },
    { match: n => /compota.*manzana/i.test(n), kcal: 80, p: 0.3, g: 0, c: 19, f: 2 },
    { match: n => /golosinas.*rega/i.test(n), kcal: 350, p: 1, g: 1, c: 85, f: 0 },
    { match: n => /barritas.*proteínas/i.test(n), kcal: 380, p: 25, g: 12, c: 45, f: 8 },
    { match: n => /barritas.*galleta/i.test(n), kcal: 420, p: 5, g: 15, c: 68, f: 3 },
    { match: n => /barritas/i.test(n), kcal: 380, p: 10, g: 12, c: 60, f: 5 },
    { match: n => /hielo cocktail/i.test(n), kcal: 80, p: 0, g: 0, c: 20, f: 0 },
    { match: n => /helado.*(mini )?(triple )?chocolate.*anacardo|helado.*vegetal.*chocolate/i.test(n), kcal: 200, p: 3, g: 12, c: 24, f: 2 },
    { match: n => /snack.*maíz.*stars|snack.*maíz.*mantequilla|snack.*stars.*mantequilla/i.test(n), kcal: 500, p: 6, g: 28, c: 60, f: 2 },

    // === LÁCTEOS, HUEVOS ===
    { match: n => /queso.*mascarpone/i.test(n), kcal: 400, p: 5, g: 40, c: 4, f: 0 },
    { match: n => /queso.*fresco/i.test(n), kcal: 130, p: 12, g: 8, c: 3, f: 0 },
    { match: n => /leche evaporada/i.test(n), kcal: 134, p: 7, g: 8, c: 10, f: 0 },
    { match: n => /leche condensada/i.test(n), kcal: 320, p: 8, g: 9, c: 55, f: 0 },
    { match: n => /mantequilla (light|ligera)/i.test(n), kcal: 360, p: 1, g: 40, c: 0, f: 0 },
    { match: n => /mantequilla (sin sal|normal)/i.test(n), kcal: 717, p: 1, g: 81, c: 0, f: 0 },
    { match: n => /huevo.*cocido|huevos cocidos/i.test(n), kcal: 155, p: 13, g: 11, c: 1, f: 0 },
    { match: n => /huevo campero/i.test(n), kcal: 155, p: 13, g: 11, c: 1, f: 0 },
    { match: n => /yogur.*griego/i.test(n), kcal: 100, p: 6, g: 5, c: 6, f: 0 },
    { match: n => /tarrina.*vainilla/i.test(n), kcal: 200, p: 4, g: 12, c: 22, f: 1 },

    // === CARNES, PESCADOS, MARISCOS ===
    { match: n => /pechuga.*pollo.*grasa|pollo picado.*pechuga/i.test(n), kcal: 165, p: 31, g: 3.6, c: 0, f: 0 },
    { match: n => /gambas/i.test(n), kcal: 95, p: 20, g: 1, c: 0.5, f: 0 },
    { match: n => /filete.*atún/i.test(n), kcal: 130, p: 26, g: 1.5, c: 0, f: 0 },

    // === BEBIDAS ===
    { match: n => /café con leche.*(light|sin lactosa|desnatado)/i.test(n), kcal: 35, p: 2.5, g: 1, c: 3, f: 0 },
    { match: n => /cerveza.*radler.*limón/i.test(n), kcal: 29, p: 0.4, g: 0, c: 7, f: 0 },

    // === SALSAS, CONDIMENTOS ===
    { match: n => /salsa barbacoa/i.test(n), kcal: 110, p: 1, g: 1, c: 26, f: 1 },
    { match: n => /salsa (fresca )?pesto.*albahaca/i.test(n), kcal: 400, p: 5, g: 38, c: 8, f: 2 },
    { match: n => /salsa pesto/i.test(n), kcal: 400, p: 5, g: 38, c: 8, f: 2 },
    { match: n => /salsa teriyaki/i.test(n), kcal: 90, p: 2, g: 0, c: 20, f: 0 },
    { match: n => /salsa fresca.*setas/i.test(n), kcal: 80, p: 2, g: 5, c: 7, f: 1 },
    { match: n => /salsa de trufa/i.test(n), kcal: 150, p: 2, g: 14, c: 5, f: 1 },
    { match: n => /salsa thai chili.*dulce|salsa.*thai.*chili/i.test(n), kcal: 200, p: 1, g: 5, c: 40, f: 0 },
    { match: n => /salsa césar/i.test(n), kcal: 450, p: 3, g: 48, c: 3, f: 0 },
    { match: n => /salsa miel.*mostaza/i.test(n), kcal: 120, p: 2, g: 5, c: 18, f: 0 },
    { match: n => /salsa worcestershire/i.test(n), kcal: 70, p: 1, g: 0, c: 16, f: 0 },
    { match: n => /vinagre/i.test(n), kcal: 18, p: 0, g: 0, c: 0.5, f: 0 },
    { match: n => /mostaza.*dijon/i.test(n), kcal: 80, p: 5, g: 5, c: 4, f: 1 },
    { match: n => /carne.*pimiento choricero/i.test(n), kcal: 80, p: 2, g: 4, c: 10, f: 3 },
    { match: n => /cebolla en polvo/i.test(n), kcal: 341, p: 10, g: 1, c: 80, f: 6 },
    { match: n => /ajo y perejil/i.test(n), kcal: 100, p: 4, g: 1, c: 20, f: 2 },
    { match: n => /sazonador.*hierbas provenzales/i.test(n), kcal: 50, p: 2, g: 1, c: 10, f: 5 },
    { match: n => /sazonador.*ajo.*limón/i.test(n), kcal: 50, p: 2, g: 1, c: 10, f: 3 },
    { match: n => /hummus/i.test(n), kcal: 170, p: 5, g: 12, c: 12, f: 4 },
    { match: n => /zumo.*limón/i.test(n), kcal: 29, p: 0.4, g: 0, c: 7, f: 0 },
    { match: n => /caldo.*(pescado|verduras|pollo)/i.test(n), kcal: 5, p: 0.5, g: 0.1, c: 0.5, f: 0 },
    { match: n => /tomate seco.*aceite/i.test(n), kcal: 160, p: 3, g: 10, c: 16, f: 4 },
    { match: n => /tomate.*concentrado|pasta.*tomate|doble concentrado/i.test(n), kcal: 82, p: 4, g: 0.5, c: 18, f: 4 },
    { match: n => /tomates cherry/i.test(n), kcal: 18, p: 1, g: 0.2, c: 3.5, f: 1 },
    { match: n => /tomates pera/i.test(n), kcal: 18, p: 1, g: 0.2, c: 3.5, f: 1 },

    // === ESPECIAS, HIERBAS, CONDIMENTOS ===
    { match: n => /cebolla frita crujiente/i.test(n), kcal: 500, p: 6, g: 35, c: 45, f: 5 },
    { match: n => /cayena molida/i.test(n), kcal: 310, p: 10, g: 15, c: 50, f: 5 },
    { match: n => /cebollino/i.test(n), kcal: 30, p: 3, g: 0.5, c: 5, f: 2 },
    { match: n => /cebolla morada/i.test(n), kcal: 40, p: 1.5, g: 0.2, c: 9, f: 2 },
    { match: n => /pimentón.*(dulce|vera)/i.test(n), kcal: 280, p: 14, g: 13, c: 50, f: 5 },
    { match: n => /hoja.*laurel/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /canela.*rama/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /pimienta.*(blanca|molida)/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /jengibre molido/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },

    // === VERDURAS, FRUTAS ===
    { match: n => /tomates?$/i.test(n), kcal: 18, p: 1, g: 0.2, c: 3.5, f: 1 },
    { match: n => /cebolla$/i.test(n), kcal: 40, p: 1.5, g: 0.2, c: 9, f: 2 },
    { match: n => /papilla.*lentejas/i.test(n), kcal: 80, p: 3, g: 2, c: 13, f: 3 },
    { match: n => /pepinillos/i.test(n), kcal: 15, p: 0.5, g: 0.1, c: 3, f: 1 },
    { match: n => /verduras.*cocido/i.test(n), kcal: 40, p: 2, g: 0.5, c: 7, f: 3 },

    // === SALES, BICARBONATOS, SIN CALORÍAS ===
    // (puestos al final para que reglas más específicas matcheen antes)
    { match: n => /escamas.*sal.*marina/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /sal (fina|gruesa)/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /bicarbonato/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /^sal$/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /^sal /i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },

    // === OTROS ===
    { match: n => /endulzante|edulcorante/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /glutamato monosódico/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /agua mineral.*gas/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /agua$/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /hielo/i.test(n), kcal: 0, p: 0, g: 0, c: 0, f: 0 },
    { match: n => /anís/i.test(n), kcal: 250, p: 0, g: 0, c: 30, f: 0 },
]

function estimarMacros(nombre) {
    const n = nombre.trim()
    for (const rule of MACROS_POR_NOMBRE) {
        if (rule.match(n)) return { calorias: rule.kcal, proteinas: rule.p, grasas: rule.g, carbohidratos: rule.c, fibra: rule.f }
    }
    return null
}

async function main() {
    console.log('══════════════════════════════════════════════════')
    console.log('   FIX: ESTIMAR MACROS PARA ALIMENTOS FALTANTES')
    console.log('   Modo: ' + (APPLY ? '🔥 APLICANDO CAMBIOS' : '👁️  Dry-run (usa --apply)'))
    console.log('══════════════════════════════════════════════════\n')

    // 1. Get ALL receta_ingredientes
    const ri = await fetchAll('receta_ingredientes', 'id,nombre_libre,cantidad_gramos,alimento_id,receta_id')
    console.log(`📦 Receta_ingredientes: ${ri.length}`)

    // 2. Get referenced alimento IDs
    const refIds = [...new Set(ri.filter(r => r.alimento_id).map(r => r.alimento_id))]
    console.log(`🔗 Alimentos únicos referenciados: ${refIds.length}`)

    // 3. Get their current macros
    const alimMap = {}
    for (let i = 0; i < refIds.length; i += 200) {
        const batch = refIds.slice(i, i + 200)
        const alim = await fetchAll('alimentos', 'id,nombre,calorias,proteinas,grasas,carbohidratos,fibra,categoria', '&id=in.(' + batch.join(',') + ')')
        for (const a of alim) alimMap[a.id] = a
    }

    // 4. Find zero-macro foods that should have macros
    const zeroFoods = Object.values(alimMap).filter(a => !a.calorias || a.calorias === 0)

    console.log(`\n🔍 Alimentos con kcal=0 referenciados en recetas: ${zeroFoods.length}\n`)

    let estimados = 0
    let noEstimados = 0
    const fixes = []

    for (const a of zeroFoods) {
        const macros = estimarMacros(a.nombre)
        if (macros) {
            estimados++
            fixes.push({ id: a.id, nombre: a.nombre, categoria: a.categoria, actual: { kcal: a.calorias }, estimado: macros })
            console.log(`  ✅ ${a.nombre} → ${macros.calorias} kcal, P=${macros.proteinas} G=${macros.grasas} C=${macros.carbohidratos}`)
        } else {
            noEstimados++
            console.log(`  ❌ ${a.nombre} (${a.categoria}) — SIN REGLA`)
        }
    }

    console.log(`\n📊 Resumen:`)
    console.log(`  Estimados: ${estimados}`)
    console.log(`  Sin regla: ${noEstimados}`)

    if (!APPLY) {
        console.log(`\n👁️  Dry-run completo. Usa --apply para aplicar ${estimados} cambios.`)
        return
    }

    // 5. Apply fixes
    console.log('\n🔥 APLICANDO CAMBIOS...')
    let applied = 0
    let errors = 0

    for (const fix of fixes) {
        try {
            const result = await patch('alimentos', fix.id, fix.estimado)
            applied++
            console.log(`  ${applied}. ✅ ${fix.nombre} → ${fix.estimado.calorias} kcal`)
        } catch (e) {
            errors++
            console.error(`  ❌ Error en ${fix.nombre}: ${e.message}`)
        }
    }

    // 6. Now recalculate affected recipes
    console.log('\n🔄 RECALCULANDO RECETAS AFECTADAS...')

    // Build the updated alimMap
    for (const fix of fixes) {
        if (alimMap[fix.id]) {
            alimMap[fix.id].calorias = fix.estimado.calorias
            alimMap[fix.id].proteinas = fix.estimado.proteinas
            alimMap[fix.id].grasas = fix.estimado.grasas
            alimMap[fix.id].carbohidratos = fix.estimado.carbohidratos
            alimMap[fix.id].fibra = fix.estimado.fibra
        }
    }

    // Group ingredients by receta
    const recetaIngs = {}
    for (const r of ri) {
        if (!recetaIngs[r.receta_id]) recetaIngs[r.receta_id] = []
        recetaIngs[r.receta_id].push(r)
    }

    // Get receta names
    const allRecetaIds = Object.keys(recetaIngs)
    const recetaMap = {}
    for (let i = 0; i < allRecetaIds.length; i += 200) {
        const batch = allRecetaIds.slice(i, i + 200)
        const recetas = await fetchAll('recetas', 'id,nombre,peso_total_g,porciones', '&id=in.(' + batch.join(',') + ')')
        for (const r of recetas) recetaMap[r.id] = r
    }

    let recalculadas = 0
    let recetaErrors = 0

    for (const [rid, ings] of Object.entries(recetaIngs)) {
        // Calculate macros
        let kcal = 0, p = 0, g = 0, c = 0, f = 0, pesoTotal = 0
        let changed = false

        for (const ing of ings) {
            if (!ing.cantidad_gramos) continue
            pesoTotal += ing.cantidad_gramos
            if (ing.alimento_id && alimMap[ing.alimento_id]) {
                const a = alimMap[ing.alimento_id]
                const factor = ing.cantidad_gramos / 100
                // Check if this ingredient was just fixed
                if (fixes.some(fx => fx.id === ing.alimento_id)) changed = true
                kcal += (a.calorias || 0) * factor
                p += (a.proteinas || 0) * factor
                g += (a.grasas || 0) * factor
                c += (a.carbohidratos || 0) * factor
                f += (a.fibra || 0) * factor
            }
        }

        if (!changed) continue // skip if no fix was applied to this recipe

        try {
            const receta = recetaMap[rid]
            const nombre = receta?.nombre || rid.slice(0, 12)
            const porciones = receta?.porciones || 1

            // ⚠️ CRITICAL: Dividir por porciones porque la BD almacena MACROS POR PORCIÓN
            // (ver recetas_schema.sql línea 28: "Macros por porción")
            const kcalPorcion = kcal / porciones
            const pPorcion = p / porciones
            const gPorcion = g / porciones
            const cPorcion = c / porciones
            const fPorcion = f / porciones

            await patch('recetas', rid, {
                kcal: Math.round(kcalPorcion * 10) / 10,
                proteinas: Math.round(pPorcion * 10) / 10,
                grasas: Math.round(gPorcion * 10) / 10,
                carbohidratos: Math.round(cPorcion * 10) / 10,
                fibra: Math.round(fPorcion * 10) / 10,
                peso_total_g: Math.round(pesoTotal),
                ...(pesoTotal > 0 ? {
                    kcal_100g: Math.round(kcal * 100 / pesoTotal),
                    proteinas_100g: Math.round(p * 100 / pesoTotal * 10) / 10,
                    grasas_100g: Math.round(g * 100 / pesoTotal * 10) / 10,
                    carbohidratos_100g: Math.round(c * 100 / pesoTotal * 10) / 10,
                    fibra_100g: Math.round(f * 100 / pesoTotal * 10) / 10,
                } : {})
            })
            recalculadas++
            console.log(`  ${recalculadas}. ✅ ${nombre}: ${Math.round(kcal)} kcal`)
        } catch (e) {
            recetaErrors++
            console.error(`  ❌ Error en receta ${rid}: ${e.message}`)
        }
    }

    console.log('\n══════════════════════════════════════════════════')
    console.log('   RESULTADO FINAL')
    console.log('══════════════════════════════════════════════════')
    console.log(`  Alimentos actualizados: ${applied}`)
    console.log(`  Errores en alimentos:   ${errors}`)
    console.log(`  Recetas recalculadas:   ${recalculadas}`)
    console.log(`  Errores en recetas:     ${recetaErrors}`)
    console.log(`  Sin regla de estimación: ${noEstimados}`)
    console.log('══════════════════════════════════════════════════')
}

main().catch(err => { console.error(err); process.exit(1) })
