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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

    ; (async () => {
        const { data } = await supabase
            .from('recetas')
            .select('id, nombre, url_origen, instrucciones')
            .not('url_origen', 'is', null)

        const sinDomain = data!.filter(r => {
            try { new URL(r.url_origen!); return false } catch { return true }
        })
        console.log(`\n🔍 ${sinDomain.length} recetas con url_origen inválida:\n`)
        for (const r of sinDomain) {
            const preview = r.url_origen!.length > 80 ? r.url_origen!.slice(0, 80) + '...' : r.url_origen
            console.log(`  ${r.nombre.padEnd(45)} → "${preview}"`)
        }
    })()
