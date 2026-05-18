/**
 * fix-url-origen-ia.ts
 *
 * Limpia el campo url_origen moviendo datos mal ubicados
 * a sus columnas correctas usando DeepSeek para clasificación.
 *
 * PROBLEMA:
 *   53 recetas tienen en url_origen datos que NO son URLs:
 *   - Números (1-760): minutos de cocción → tiempo_coccion_min
 *   - "Horno", "Microondas", "Sartén/Wok", "No Bake": método → tipo_coccion
 *   - "Postre": tipo de plato → tipo_plato
 *
 * USO: npx tsx scripts/fix-url-origen-ia.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

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

async function llamarDeepSeek(prompt: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Eres un experto en clasificación de datos de recetas.
Respondes SIEMPRE en español, SOLO con JSON válido, nunca con markdown.

REGLAS:
- Analiza el valor en "url_origen" de cada receta
- Si es un NÚMERO → es tiempo de cocción en minutos → tiempo_coccion_min
- Si coincide con un método de cocción → tipo_coccion: "Horno"|"Microondas"|"Sartén"|"No bake"|"Freidora de aire"
- Si es "Postre" o similar → tipo_plato: "Postre"|"Desayuno"|"Comida"|"Cena"|"Snack"
- url_origen debe quedar vacío ('') si no es una URL real
- Usa el nombre de la receta como contexto para decidir`
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.05,
            max_tokens: 4000,
        }),
    })

    if (!response.ok) {
        throw new Error(`DeepSeek API error ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error(`DeepSeek: respuesta no contiene JSON. ${content.slice(0, 300)}`)
    return jsonMatch[0]
}

async function main() {
    console.log('🧹 fix-url-origen-ia.ts — Limpiando url_origen con DeepSeek\n')

    // 1. Obtener recetas con url_origen no válido
    const { data: recetas } = await supabase
        .from('recetas')
        .select('id, nombre, url_origen, tipo_coccion, tiempo_coccion_min, tipo_plato')
        .not('url_origen', 'is', null)

    const sucias = (recetas || []).filter(r => {
        const v = (r.url_origen || '').toString().trim()
        return v && !v.startsWith('http://') && !v.startsWith('https://')
    })

    console.log(`📊 Recetas con url_origen incorrecto: ${sucias.length}`)

    // 2. Procesar clasificación simple primero (números y valores conocidos)
    let manuales = 0
    let pendientesIA: typeof sucias = []

    const METODOS_COCCION = new Set(['horno', 'microondas', 'sartén/wok', 'sartén', 'wok', 'no bake'])

    for (const r of sucias) {
        const valor = r.url_origen.toString().trim().toLowerCase()
        const update: Record<string, any> = {}

        // Es un número → tiempo de cocción
        const num = parseInt(valor)
        if (!isNaN(num) && valor === num.toString()) {
            update.tiempo_coccion_min = num
            update.url_origen = ''
            manuales++
        }
        // Es método de cocción
        else if (METODOS_COCCION.has(valor)) {
            const metodo = valor.charAt(0).toUpperCase() + valor.slice(1).replace('/wok', '/Wok')
            update.tipo_coccion = metodo.includes('No') ? 'No bake' : metodo
            update.url_origen = ''
            manuales++
        }
        // Es "Postre"
        else if (valor === 'postre') {
            update.tipo_plato = 'Postre'
            update.url_origen = ''
            manuales++
        }
        else {
            pendientesIA.push(r)
        }

        if (Object.keys(update).length > 0) {
            await supabase.from('recetas').update(update).eq('id', r.id)
            console.log(`   ✅ ${r.nombre}: "${r.url_origen}" → ${JSON.stringify(update)}`)
        }
    }

    console.log(`\n📊 Clasificados manualmente: ${manuales}`)
    console.log(`📊 Pendientes de DeepSeek: ${pendientesIA.length}`)

    // 3. Procesar con IA los casos dudosos
    if (pendientesIA.length > 0) {
        console.log('\n🌐 Consultando a DeepSeek para los casos ambiguos...\n')

        const prompt = `Clasifica estos valores de url_origen de recetas.
Las columnas disponibles son:
- url_origen (debe contener SOLO URLs reales, vaciar si no lo es)
- tiempo_coccion_min (número de minutos)
- tipo_coccion ("Horno"|"Microondas"|"Sartén"|"No bake"|"Freidora de aire"|"" )
- tipo_plato ("Postre"|"Desayuno"|"Comida"|"Cena"|"Snack"|"")

DATOS A CLASIFICAR:
${JSON.stringify(pendientesIA.map(r => ({ id: r.id, nombre: r.nombre, url_origen_actual: r.url_origen })), null, 2)}

Responde SOLO con un array JSON. Cada elemento:
{
  "id": "uuid de la receta",
  "tiempo_coccion_min": null | número,
  "tipo_coccion": "..." | "",
  "tipo_plato": "..." | "",
  "nuevo_url_origen": "" | "solo si es URL real"
}`

        const rawJson = await llamarDeepSeek(prompt)
        let clasificaciones: any[]
        try {
            clasificaciones = JSON.parse(rawJson)
            if (!Array.isArray(clasificaciones)) clasificaciones = [clasificaciones]
        } catch (e) {
            console.error('Error parseando respuesta:', e)
            console.log('Raw:', rawJson.slice(0, 500))
            return
        }

        for (const c of clasificaciones) {
            const update: Record<string, any> = {}
            if (c.tiempo_coccion_min !== null && c.tiempo_coccion_min !== undefined) update.tiempo_coccion_min = c.tiempo_coccion_min
            if (c.tipo_coccion) update.tipo_coccion = c.tipo_coccion
            if (c.tipo_plato) update.tipo_plato = c.tipo_plato
            update.url_origen = c.nuevo_url_origen || ''

            await supabase.from('recetas').update(update).eq('id', c.id)
            const receta = pendientesIA.find(r => r.id === c.id)
            console.log(`   🤖 ${receta?.nombre || c.id}: "${receta?.url_origen}" → ${JSON.stringify(update)}`)
        }
    }

    // 4. Verificación final
    const { data: final } = await supabase
        .from('recetas')
        .select('id, nombre, url_origen, tipo_coccion, tiempo_coccion_min, tipo_plato')

    const siguenSucias = (final || []).filter(r => {
        const v = (r.url_origen || '').toString().trim()
        return v && !v.startsWith('http://') && !v.startsWith('https://')
    })

    console.log(`\n✅ Proceso completado.`)
    console.log(`   Recetas con url_origen incorrecto: ${sucias.length} → ${siguenSucias.length}`)
    if (siguenSucias.length > 0) {
        console.log('   ⚠️ Aún pendientes:', siguenSucias.map(r => r.nombre + '("' + r.url_origen + '")').join(', '))
    } else {
        console.log('   ✅ Todas las recetas tienen url_origen limpio')
    }
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
