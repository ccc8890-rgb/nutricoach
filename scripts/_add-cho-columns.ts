import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, KEY)
const REST_URL = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`

async function main() {
    // 1. Ejecutar SQL para añadir columnas
    const sql = `
    ALTER TABLE alimentos
    ADD COLUMN IF NOT EXISTS azucares_anyadidos NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS almidon NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS polialcoholes NUMERIC DEFAULT NULL;
  `

    // Try via REST API (more reliable)
    const res = await fetch(REST_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
        },
        body: JSON.stringify({ sql_text: sql }),
    })

    if (res.ok) {
        const result = await res.json()
        console.log('SQL ejecutado:', JSON.stringify(result))
    } else {
        const txt = await res.text()
        console.log('exec_sql falló:', txt.substring(0, 300))

        // Fallback: ALTER TABLE directo via REST
        console.log('Intentando ALTER TABLE directo...')
        const alterRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': KEY,
                'Authorization': `Bearer ${KEY}`,
            },
            body: JSON.stringify({}),
        })
        console.log('Fallback status:', alterRes.status)
    }

    // 2. Verificar columnas
    const { data } = await supabase
        .from('alimentos')
        .select('id,azucares_anyadidos,almidon,polialcoholes,azucares,fibra')
        .limit(3)

    if (data) {
        console.log('Columnas verificadas:', JSON.stringify(data[0], null, 2))
    } else {
        console.log('No se pudieron leer las columnas nuevas')
        // Check all columns
        const { data: allCols } = await supabase.from('alimentos').select('*').limit(1)
        if (allCols?.[0]) {
            const keys = Object.keys(allCols[0])
            console.log('Columnas totales:', keys.length)
            const targetKeys = keys.filter(k =>
                ['azucares_anyadidos', 'almidon', 'polialcoholes', 'azucares', 'fibra', 'carbohidratos'].includes(k)
            )
            console.log('Columnas CHO target:', targetKeys.join(', '))
            // Check which are missing
            for (const col of ['azucares_anyadidos', 'almidon', 'polialcoholes']) {
                console.log(`  ${col}: ${col in allCols[0] ? 'EXISTE' : 'NO EXISTE'}`)
            }
        }
    }
}

main().catch(console.error)
