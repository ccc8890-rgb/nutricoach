/**
 * Verifica si las 80 recetas sin ingredientes en receta_ingredientes
 * tienen ingredientes en texto plano en el campo 'ingredientes' legacy.
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
    // Get all receta_ingredientes receta_ids
    const { data: ings } = await supabase.from('receta_ingredientes').select('receta_id')
    const idsConIng = new Set(ings?.map(i => i.receta_id) || [])

    // Get all recetas and find ones WITHOUT ingredients in receta_ingredientes
    const { data: recetas } = await supabase.from('recetas').select('id, nombre, instrucciones')
    if (!recetas) return

    const sinIng = recetas.filter(r => !idsConIng.has(r.id))

    console.log(`🔍 80 recetas SIN ingredientes en receta_ingredientes\n`)

    // Check if there's a legacy 'ingredientes' field by trying to select it
    const { data: withTextField } = await supabase
        .from('recetas')
        .select('*')
        .in('id', sinIng.map(r => r.id))
        .limit(1)

    const hasLegacyField = withTextField && withTextField.length > 0 &&
        Object.keys(withTextField[0]).includes('ingredientes')

    if (hasLegacyField) {
        console.log('✅ Existe campo legacy "ingredientes"\n')
        const { data: conTexto } = await supabase
            .from('recetas')
            .select('id, nombre, ingredientes')
            .in('id', sinIng.map(r => r.id))
            .not('ingredientes', 'is', null)
            .not('ingredientes', 'eq', '')

        if (conTexto && conTexto.length > 0) {
            console.log(`Recetas con texto en campo 'ingredientes': ${conTexto.length}/${sinIng.length}\n`)
            console.log('Ejemplos:')
            conTexto.slice(0, 8).forEach((r: any) => {
                const text = (r.ingredientes || '').substring(0, 150)
                console.log(`  ${r.nombre}: "${text}..."`)
            })
        } else {
            console.log('Ninguna receta tiene datos en campo "ingredientes" (todas null/vacío)')
        }
    } else {
        console.log('❌ No existe campo legacy "ingredientes"')
    }

    // Show available columns in first matching receta
    if (withTextField && withTextField.length > 0) {
        const cols = Object.keys(withTextField[0])
        console.log(`\nColumnas disponibles en recetas (${cols.length}):`)
        console.log(cols.join(', '))
    }

    // Quick check: do these 80 recetas have macros calculated?
    const { data: recetasCompletas } = await supabase
        .from('recetas')
        .select('nombre, kcal, proteinas')
        .in('id', sinIng.map(r => r.id))

    if (recetasCompletas) {
        const conKcal = recetasCompletas.filter((r: any) => r.kcal && r.kcal > 0).length
        console.log(`\n📊 De estas 80 recetas:`)
        console.log(`  Con kcal > 0: ${conKcal}/${recetasCompletas.length}`)
    }
}

main().catch(console.error)
