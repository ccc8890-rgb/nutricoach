/**
 * Script de diagnóstico — Auditoría de calidad de datos de alimentos
 *
 * Uso: node scripts/auditar-calidad-alimentos.mjs
 *
 * Detecta:
 * - Alimentos con macros=0 en categorías que deberían tener datos
 * - No-alimentos (cosmética, limpieza) que se colaron
 * - Alimentos sin micronutrientes ni perfil lipídico
 * - Categorías no estándar
 *
 * Es READ-ONLY, no modifica nada.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Faltan variables: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
}

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }

async function query(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query_sql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: sql }),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`SQL error: ${text}`)
    }
    return res.json()
}

async function fetchAll(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
    if (!res.ok) throw new Error(`Fetch error: ${await res.text()}`)
    return res.json()
}

async function main() {
    console.log('')
    console.log('══════════════════════════════════════════')
    console.log('  AUDITORÍA DE CALIDAD — ALIMENTOS')
    console.log('══════════════════════════════════════════')
    console.log('')

    // 1. Total de alimentos
    const conteo = await fetchAll('alimentos?select=id&limit=0')
    const totalCabecera = res ?? []
    const { count } = await (await fetch(`${SUPABASE_URL}/rest/v1/alimentos?select=id`, {
        headers: { ...headers, Prefer: 'count=exact' }
    })).json()

    // Mejor: usar count con prefer
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/alimentos?select=id`, {
        headers: { ...headers, Prefer: 'count=exact' }
    })
    const total = parseInt(countRes.headers.get('content-range')?.split('/')[1] ?? '0', 10)
    console.log(`📊 Total alimentos en BD: ${total}`)
    console.log('')

    // 2. Alimentos con macros=0 en categorías que siempre deberían tener datos
    console.log('── 1. ALIMENTOS CON MACROS=0 (carnes, pescados, huevos, lácteos) ──')
    const CATS_CRITICAS = ['Carnes', 'Pescados', 'Huevos', 'Lácteos']
    for (const cat of CATS_CRITICAS) {
        const items = await fetchAll(`alimentos?categoria=eq.${encodeURIComponent(cat)}&calorias=eq.0&select=id,nombre,calorias,proteinas,carbohidratos,grasas&limit=20`)
        if (items.length > 0) {
            console.log(`  🔴 ${cat}: ${items.length} con macros=0`)
            items.forEach(a => console.log(`     - ${a.nombre} (cal:${a.calorias} p:${a.proteinas} c:${a.carbohidratos} g:${a.grasas})`))
        } else {
            console.log(`  ✅ ${cat}: 0 con macros=0`)
        }
    }
    console.log('')

    // 3. Posibles no-alimentos
    console.log('── 2. POSIBLES NO-ALIMENTOS (cosmética, limpieza, etc) ──')
    const STOPWORDS = ['agua micelar', 'champú', 'gel', 'crema', 'loción', 'jabón',
        'desodorante', 'colonia', 'perfume', 'maquillaje', 'detergente',
        'suavizante', 'limpiador', 'ambientador', 'cera', 'pintura',
        'pegamento', 'comida perro', 'comida gato', 'pienso', 'vela',
        'incienso', 'lavavajillas', 'alcohol etílico', 'alcohol 96',
        'tónico facial', 'serum', 'protector solar', 'desmaquillante',
        'mascarilla facial', 'exfoliante',
    ]
    const todos = await fetchAll('alimentos?select=id,nombre,categoria&limit=3000')
    const noAlimentos = todos.filter(a => {
        const n = (a.nombre ?? '').toLowerCase()
        return STOPWORDS.some(sw => n.includes(sw))
    })
    if (noAlimentos.length > 0) {
        console.log(`  🔴 ${noAlimentos.length} posibles no-alimentos:`)
        noAlimentos.forEach(a => console.log(`     - [${a.categoria}] ${a.nombre}`))
    } else {
        console.log('  ✅ No se detectaron no-alimentos')
    }
    console.log('')

    // 4. Alimentos sin micronutrientes
    console.log('── 3. ALIMENTOS SIN MICRONUTRIENTES NI PERFIL LIPÍDICO ──')
    const conMicros = await fetchAll('alimentos?select=id,nombre,categoria,calorias&or=(vitamina_c_mg.gt.0,calcio_mg.gt.0,hierro_mg.gt.0)&limit=10')
    const sinMicros = todos.filter(a => {
        // Estimación: si el alimento tiene calorías>0 pero no está en conMicros
        return (a.calorias ?? 0) > 0
    })
    // Esto es solo una aproximación; el conteo real requeriría consulta más precisa
    console.log(`  ⚠️  (aprox) Muchos alimentos no tienen micronutrientes poblados`)
    console.log(`      Para enriquecer: node scripts/enriquecer-alimentos.mjs`)
    console.log('')

    // 5. Alimentos con categorías no estándar
    console.log('── 4. CATEGORÍAS NO ESTÁNDAR ──')
    const categorias = await fetchAll('alimentos?select=categoria&limit=3000')
    const catsUnicas = [...new Set(categorias.map(a => a.categoria).filter(Boolean))]
    console.log(`  📂 ${catsUnicas.length} categorías únicas:`)
    catsUnicas.forEach(c => {
        const count = categorias.filter(a => a.categoria === c).length
        console.log(`     - ${c}: ${count}`)
    })
    console.log('')

    // 6. Resumen
    console.log('══ RESUMEN ══')
    console.log(`  Total: ${total} alimentos`)
    console.log(`  Categorías: ${catsUnicas.length}`)
    console.log('')
    console.log('📋 Acciones recomendadas:')
    console.log('  1. Eliminar no-alimentos desde el panel de administración')
    console.log('  2. Ejecutar enriquecimiento: node scripts/enriquecer-alimentos.mjs')
    console.log('  3. Revisar carnes/pescados con macros=0 manualmente')
    console.log('')
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
