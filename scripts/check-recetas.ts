/**
 * Script rápido para ver qué recetas tienen url_origen
 * y de qué dominios son.
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

    ; (async () => {
        const { data, error } = await supabase
            .from('recetas')
            .select('id, nombre, url_origen, instrucciones, created_at')
            .not('url_origen', 'is', null)

        if (error) { console.error(error); process.exit(1) }

        console.log(`\n📦 ${data.length} recetas con url_origen:\n`)
        const domains: Record<string, number> = {}
        let withInst = 0, withoutInst = 0

        for (const r of data) {
            const hasInst = r.instrucciones ? '✅ instrucciones' : '❌ sin instrucciones'
            let domain = 'sin-domain'
            try { domain = new URL(r.url_origen).hostname.replace('www.', '') } catch { }
            domains[domain] = (domains[domain] || 0) + 1
            if (r.instrucciones) withInst++; else withoutInst++
            console.log(`  ${hasInst.padEnd(22)} ${domain.padEnd(30)} ${r.nombre}`)
        }

        console.log(`\n📊 RESUMEN:`)
        console.log(`  Con instrucciones: ${withInst}`)
        console.log(`  Sin instrucciones: ${withoutInst}`)
        console.log(`\n📈 Por dominio:`)
        for (const [d, c] of Object.entries(domains).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${d.padEnd(30)} ${c} recetas`)
        }
    })()
