/**
 * DIAGNÓSTICO COMPLETO DE RECETAS
 * 
 * Analiza todos los campos de las recetas en Supabase y genera
 * un reporte detallado de qué falta, qué está mal y qué está bien.
 * 
 * Uso: npx tsx scripts/diagnostico-completo-recetas.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return
    const content = fs.readFileSync(envPath, 'utf-8')
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
loadEnvLocal()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
    const { data: recetas, error } = await supabase.from('recetas').select('*')
    if (error || !recetas) { console.error('Error:', error); return }

    const total = recetas.length

    console.log('')
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║     DIAGNÓSTICO COMPLETO DEL RECETARIO                  ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log('')
    console.log(`  Total recetas: ${total}`)
    console.log('')

    // ─── 1. CAMPOS BÁSICOS ─────────────────────────────────
    console.log('══════════════════════════════════════════════')
    console.log('  1. CAMPOS BÁSICOS')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const camposBasicos: Record<string, string> = {
        descripcion: 'Descripción',
        categoria: 'Categoría',
        dificultad: 'Dificultad',
        tipo_coccion: 'Tipo cocción',
        instrucciones: 'Instrucciones',
        consejos: 'Consejos',
        imagen_url: 'Imagen URL',
        video_url: 'Video URL',
        url_origen: 'URL origen',
        fuente: 'Fuente',
        estado: 'Estado',
        tipo_plato: 'Tipo plato',
        fuente_tipo: 'Fuente tipo',
        autor_original: 'Autor original',
        notas_coach: 'Notas coach',
    }

    for (const [field, label] of Object.entries(camposBasicos)) {
        const sin = recetas.filter((r: any) => {
            const v = (r as any)[field]
            return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
        })
        const pct = Math.round(((total - sin.length) / total) * 100)
        console.log(`  ${label.padEnd(20)} ${String(total - sin.length).padStart(3)}/${total} (${pct}%)`)
    }

    // ─── 2. TIEMPOS Y PORCIONES ────────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  2. TIEMPOS Y PORCIONES')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const camposNum: Record<string, string> = {
        porciones: 'Porciones',
        tiempo_prep_min: 'Tiempo preparación',
        tiempo_coccion_min: 'Tiempo cocción',
    }

    for (const [field, label] of Object.entries(camposNum)) {
        const sin = recetas.filter((r: any) => (r as any)[field] === null || (r as any)[field] === undefined)
        const con = total - sin.length
        console.log(`  ${label.padEnd(22)} ${String(con).padStart(3)}/${total} (${Math.round(con / total * 100)}%)`)
    }

    // ─── 3. MACROS ─────────────────────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  3. MACROS (por porción)')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const camposMacros: Record<string, string> = {
        kcal: 'Kcal',
        proteinas: 'Proteinas',
        carbohidratos: 'Carbohidratos',
        grasas: 'Grasas',
        fibra: 'Fibra',
    }

    for (const [field, label] of Object.entries(camposMacros)) {
        const sin = recetas.filter((r: any) => (r as any)[field] === null || (r as any)[field] === undefined || (r as any)[field] === 0)
        const con = total - sin.length
        const valores = recetas.filter((r: any) => (r as any)[field] && (r as any)[field] > 0).map((r: any) => (r as any)[field])
        const media = valores.length > 0 ? (valores.reduce((a: number, b: number) => a + b, 0) / valores.length).toFixed(1) : 'N/A'
        console.log(`  ${label.padEnd(22)} ${String(con).padStart(3)}/${total} | Media: ${media}`)
    }

    // ─── 4. MACROS POR 100g ────────────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  4. MACROS POR 100g (v2)')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const camposMacros100 = ['kcal_100g', 'proteinas_100g', 'carbohidratos_100g', 'grasas_100g', 'fibra_100g', 'peso_total_g']
    for (const field of camposMacros100) {
        const sin = recetas.filter((r: any) => (r as any)[field] === null || (r as any)[field] === undefined)
        const con = total - sin.length
        console.log(`  ${field.padEnd(22)} ${String(con).padStart(3)}/${total} (${Math.round(con / total * 100)}%)`)
    }

    // ─── 5. INTOLERANCIAS Y TAGS ───────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  5. INTOLERANCIAS Y TAGS')
    console.log('══════════════════════════════════════════════')
    console.log('')

    for (const field of ['intolerancias', 'tags']) {
        const sin = recetas.filter((r: any) => {
            const v = (r as any)[field]
            return !v || (Array.isArray(v) && v.length === 0)
        })
        const con = total - sin.length
        console.log(`  ${field.padEnd(22)} ${String(con).padStart(3)}/${total} (${Math.round(con / total * 100)}%)`)
    }

    // ─── 6. URL_ORIGEN - ANÁLISIS ──────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  6. URL_ORIGEN - ANÁLISIS')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const conUrl = recetas.filter((r: any) => r.url_origen?.startsWith('http'))
    const sinUrl = recetas.filter((r: any) => !r.url_origen)
    const urlRara = recetas.filter((r: any) => r.url_origen && !r.url_origen.startsWith('http'))

    console.log(`  URL http* válida:     ${conUrl.length}`)
    console.log(`  Sin url_origen:       ${sinUrl.length}`)
    console.log(`  URL no-http:          ${urlRara.length}`)

    if (urlRara.length > 0) {
        console.log('')
        console.log('  ── URLs no-estándar ──')
        const agrupadas: Record<string, number> = {}
        urlRara.forEach((r: any) => {
            const v = r.url_origen || ''
            agrupadas[v] = (agrupadas[v] || 0) + 1
        })
        Object.entries(agrupadas).sort((a, b) => b[1] - a[1]).forEach(([val, count]) => {
            console.log(`    [${count}x] "${val}"`)
        })
    }

    if (sinUrl.length > 0) {
        console.log('')
        console.log('  ── Primeras 10 recetas sin url_origen ──')
        sinUrl.slice(0, 10).forEach((r: any) => {
            console.log(`    • ${r.nombre}`)
        })
        if (sinUrl.length > 10) console.log(`    ... y ${sinUrl.length - 10} más`)
    }

    // ─── 7. CATEGORÍAS ─────────────────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  7. DISTRIBUCIÓN')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const cats: Record<string, number> = {}
    recetas.forEach((r: any) => {
        const c = r.categoria || 'SIN CATEGORÍA'
        cats[c] = (cats[c] || 0) + 1
    })
    console.log('  Categorías:')
    Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
        console.log(`    ${c.padEnd(20)} ${String(n).padStart(3)} recetas`)
    })

    const diffs: Record<string, number> = {}
    recetas.forEach((r: any) => {
        const d = r.dificultad || 'SIN DIFICULTAD'
        diffs[d] = (diffs[d] || 0) + 1
    })
    console.log('')
    console.log('  Dificultad:')
    Object.entries(diffs).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => {
        console.log(`    ${d.padEnd(20)} ${String(n).padStart(3)} recetas`)
    })

    // ─── 8. RECETAS CON PROBLEMAS ──────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  8. RECETAS CON PROBLEMAS')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const testRecetas = recetas.filter((r: any) => r.nombre.includes('TEST'))
    if (testRecetas.length > 0) {
        console.log(`  🧪 Recetas con "TEST" en nombre: ${testRecetas.length}`)
        testRecetas.forEach((r: any) => console.log(`    • ${r.nombre} (id: ${(r as any).id})`))
    }

    // Posibles duplicados por nombre similar
    const nombres = recetas.map((r: any) => r.nombre.toLowerCase().trim())
    const duplicados: Record<string, string[]> = {}
    for (let i = 0; i < nombres.length; i++) {
        for (let j = i + 1; j < nombres.length; j++) {
            const sim = similaridad(nombres[i], nombres[j])
            if (sim > 0.8) {
                if (!duplicados[nombres[i]]) duplicados[nombres[i]] = []
                duplicados[nombres[i]].push(recetas[j].nombre)
            }
        }
    }
    if (Object.keys(duplicados).length > 0) {
        console.log('')
        console.log(`  🔍 Posibles duplicados:`)
        Object.entries(duplicados).forEach(([a, bs]) => {
            console.log(`    • "${a}" ≈ "${bs.join('", "')}"`)
        })
    }

    // ─── 9. INGREDIENTES ───────────────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  9. INGREDIENTES')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const { count: totalIng } = await supabase
        .from('receta_ingredientes')
        .select('*', { count: 'exact', head: true })

    // ── Obtener TODOS los receta_id (paginados) ──
    // ── Obtener TODOS los receta_id (paginados, Supabase max 1000 por página) ──
    const allRecetaIds: string[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
        const { data: page } = await supabase
            .from('receta_ingredientes')
            .select('receta_id')
            .order('receta_id')
            .range(from, from + pageSize - 1)
        if (!page || page.length === 0) break
        allRecetaIds.push(...page.map((r: any) => r.receta_id))
        from += pageSize
        if (page.length < pageSize) break
    }

    const idsConIng = new Set(allRecetaIds)
    const sinIngredientes = recetas.filter((r: any) => !idsConIng.has(r.id))

    console.log(`  Total filas ingredientes: ${totalIng}`)
    console.log(`  Recetas CON ingredientes: ${idsConIng.size}`)
    console.log(`  Recetas SIN ingredientes: ${sinIngredientes.length}`)

    if (sinIngredientes.length > 0) {
        console.log('')
        console.log('  ── Recetas sin ingredientes ──')
        sinIngredientes.slice(0, 5).forEach((r: any) => console.log(`    • ${r.nombre}`))
        if (sinIngredientes.length > 5) console.log(`    ... y ${sinIngredientes.length - 5} más`)
    }

    // ─── 10. ESTADO GENERAL ─────────────────────────────────
    console.log('')
    console.log('══════════════════════════════════════════════')
    console.log('  10. ESTADO')
    console.log('══════════════════════════════════════════════')
    console.log('')

    const estados: Record<string, number> = {}
    recetas.forEach((r: any) => {
        const e = r.estado || 'sin estado'
        estados[e] = (estados[e] || 0) + 1
    })
    Object.entries(estados).sort((a, b) => b[1] - a[1]).forEach(([e, n]) => {
        console.log(`  ${e.padEnd(20)} ${String(n).padStart(3)} recetas`)
    })

    // ─── RESUMEN ───────────────────────────────────────────
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║  RESUMEN EJECUTIVO                                       ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log('')

    // Calcular campos críticos faltantes
    const sinDesc = recetas.filter((r: any) => !r.descripcion).length
    const sinCat = recetas.filter((r: any) => !r.categoria).length
    const sinImg = recetas.filter((r: any) => !r.imagen_url).length
    const sinTiempo = recetas.filter((r: any) => !r.tiempo_prep_min).length
    const sinConsejos = recetas.filter((r: any) => !r.consejos).length
    const sinMacros100 = recetas.filter((r: any) => !r.kcal_100g && r.kcal_100g !== 0).length
    const sinTags = recetas.filter((r: any) => !r.tags || r.tags.length === 0).length
    const sinIntolerancias = recetas.filter((r: any) => !r.intolerancias || r.intolerancias.length === 0).length

    console.log(`  ✅ Instrucciones OK:        ${total - recetas.filter((r: any) => !r.instrucciones).length}/${total}`)
    console.log(`  ✅ Ingredientes OK:         ${idsConIng.size}/${total}`)
    console.log(`  ✅ Macros OK:               ${total - recetas.filter((r: any) => !r.kcal || r.kcal === 0).length}/${total}`)
    console.log(`  ⚠️  Sin descripción:         ${sinDesc}/${total}`)
    console.log(`  ⚠️  Sin categoría:           ${sinCat}/${total}`)
    console.log(`  ⚠️  Sin imagen:              ${sinImg}/${total}`)
    console.log(`  ⚠️  Sin tiempo preparación:  ${sinTiempo}/${total}`)
    console.log(`  ⚠️  Sin consejos:             ${sinConsejos}/${total}`)
    console.log(`  ⚠️  Sin macros/100g:         ${sinMacros100}/${total}`)
    console.log(`  ⚠️  Sin tags:                ${sinTags}/${total}`)
    console.log(`  ⚠️  Sin intolerancias:       ${sinIntolerancias}/${total}`)
    console.log(`  ⚠️  Sin url_origen:          ${sinUrl.length}/${total}`)
    console.log('')

    // Guardar reporte
    const fechaStr = new Date().toISOString().split('T')[0]
    const reportDir = path.resolve(process.cwd(), 'salidas')
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
    const reportPath = path.join(reportDir, `diagnostico-recetas-${fechaStr}.md`)

    let report = `# Diagnóstico Completo del Recetario - ${fechaStr}\n\n`
    report += `**Total recetas:** ${total}\n\n`
    report += `## Campos básicos\n\n`
    for (const [field, label] of Object.entries(camposBasicos)) {
        const sin = recetas.filter((r: any) => {
            const v = (r as any)[field]
            return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
        })
        report += `- ${label}: ${total - sin.length}/${total}\n`
    }
    report += `\n## Resumen de problemas\n\n`
    report += `- Sin descripción: ${sinDesc}\n`
    report += `- Sin categoría: ${sinCat}\n`
    report += `- Sin imagen: ${sinImg}\n`
    report += `- Sin tiempo preparación: ${sinTiempo}\n`
    report += `- Sin consejos: ${sinConsejos}\n`
    report += `- Sin macros/100g: ${sinMacros100}\n`
    report += `- Sin tags: ${sinTags}\n`
    report += `- Sin intolerancias: ${sinIntolerancias}\n`
    report += `- Sin url_origen: ${sinUrl.length}\n`

    fs.writeFileSync(reportPath, report, 'utf-8')
    console.log(`  📄 Reporte guardado en: ${reportPath}`)
    console.log('')
}

function similaridad(a: string, b: string): number {
    if (a === b) return 1
    const palabrasA = new Set(a.split(/\s+/))
    const palabrasB = new Set(b.split(/\s+/))
    let comunes = 0
    for (const p of palabrasA) if (palabrasB.has(p)) comunes++
    const total = Math.max(palabrasA.size, palabrasB.size)
    return comunes / total
}

main().catch(console.error)
