/**
 * Investiga las 53 recetas con url_origen que no son HTTP válidas
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
    const { data: recetas } = await supabase
        .from('recetas')
        .select('id, nombre, url_origen')
        .not('url_origen', 'is', null)

    if (!recetas) return

    console.log(`Total recetas con url_origen (no null): ${recetas.length}\n`)

    let httpValidas = 0
    let vacias = 0
    let sinProtocolo = 0
    let otras = 0

    const grupos: Record<string, { count: number, ejemplos: { nombre: string, url: string }[] }> = {}

    for (const r of recetas) {
        const url = (r.url_origen || '').trim()

        if (!url) {
            vacias++
            continue
        }

        if (url.startsWith('http://') || url.startsWith('https://')) {
            httpValidas++
            continue
        }

        // No empieza con http
        sinProtocolo++

        // Intentar parsear
        try {
            new URL(url)
            // Es parseable pero no http
        } catch {
            // No es parseable
        }

        const key = url.length > 60 ? url.substring(0, 60) + '...' : url
        if (!grupos[key]) grupos[key] = { count: 0, ejemplos: [] }
        grupos[key].count++
        if (grupos[key].ejemplos.length < 2) {
            grupos[key].ejemplos.push({ nombre: r.nombre, url: r.url_origen || '' })
        }
    }

    console.log(`  HTTP válidas:   ${httpValidas}`)
    console.log(`  Vacías:         ${vacias}`)
    console.log(`  Sin protocolo:  ${sinProtocolo}\n`)

    if (sinProtocolo > 0) {
        console.log('══════════════════════════════════════════════')
        console.log('  URLs SIN PROTOCOLO HTTP')
        console.log('══════════════════════════════════════════════\n')

        Object.entries(grupos).sort((a, b) => b[1].count - a[1].count).forEach(([key, info]) => {
            console.log(`  [${info.count}x] "${key}"`)
            info.ejemplos.forEach(e => console.log(`    → ${e.nombre}`))
        })
    }
}

main().catch(console.error)
