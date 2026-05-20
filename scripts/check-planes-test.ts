/**
 * 🔍 Verifica el estado de los clientes test y sus planes IA
 * Uso: npx tsx scripts/check-planes-test.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

// IDs de nuestros clientes test
const CLIENTES = [
    { id: 'd324e4dc-bbfe-4266-9153-25a683e77f97', nombre: 'Carlos (35, diabetes T2, perder grasa)' },
    { id: '94259e48-0581-4ccb-ab31-4768090c08fb', nombre: 'María (28, vegana, ganar músculo)' },
    { id: 'ea2c3bdd-31fd-4176-bb33-89f3017596e8', nombre: 'Ana (52, menopausia, recomposición)' },
    { id: 'd1564f22-9980-4a21-978b-b06881ceda0d', nombre: 'Javier (42, maratón, rendimiento)' },
]

const COL = {
    verde: (s: string) => `\x1b[32m${s}\x1b[0m`,
    rojo: (s: string) => `\x1b[31m${s}\x1b[0m`,
    ama: (s: string) => `\x1b[33m${s}\x1b[0m`,
    azul: (s: string) => `\x1b[34m${s}\x1b[0m`,
    cielo: (s: string) => `\x1b[36m${s}\x1b[0m`,
    reset: '\x1b[0m',
}

async function main() {
    console.log(`${COL.cielo('═══════════════════════════════════════════════')}`)
    console.log(`${COL.cielo('  🔍 VERIFICACIÓN CLIENTES TEST')}`)
    console.log(`${COL.cielo('═══════════════════════════════════════════════')}\n`)

    // Buscar Pedro
    const { data: pedro } = await supabase
        .from('clientes')
        .select('id, objetivo, edad, peso_inicial, onboarding_completado')
        .eq('edad', 65)
        .maybeSingle()

    if (pedro) {
        console.log(`${COL.verde('✓')} Pedro (65, hipertenso) — ID: ${pedro.id} | onboarding: ${pedro.onboarding_completado}`)
        CLIENTES.push({ id: pedro.id, nombre: 'Pedro (65, hipertenso, mantener)' })
    } else {
        console.log(`${COL.rojo('✗')} Pedro (65, hipertenso) — NO ENCONTRADO`)
        CLIENTES.push({ id: '??', nombre: 'Pedro (65, hipertenso, mantener) — PENDIENTE' })
    }

    console.log('')

    for (const c of CLIENTES) {
        console.log(`${COL.azul('→')} ${COL.ama(c.nombre)}`)
        console.log(`  ID: ${c.id}`)

        // Buscar plan en registros_ia
        const { data: registros } = await supabase
            .from('registros_ia')
            .select('id, tipo, tokens_usados, respuesta_json, created_at')
            .eq('cliente_id', c.id)
            .in('tipo', ['plan_inicial', 'dieta'])
            .order('created_at', { ascending: false })
            .limit(1)

        if (registros && registros.length > 0) {
            const r = registros[0]
            const rj = r.respuesta_json as any || {}
            const macros = rj.macros || {}
            console.log(`  ${COL.verde('✓')} Plan IA generado:`)
            console.log(`    Kcal: ${COL.cielo(`${rj.kcal_objetivo ?? '?'} kcal`)}`)
            console.log(`    Macros: P${macros.proteinas_g || '?'} / C${macros.carbos_g || '?'} / G${macros.grasas_g || '?'}`)
            console.log(`    Tokens: ${r.tokens_usados}`)
            console.log(`    Fecha: ${r.created_at}`)
            const comidas = rj.distribucion_comidas as any[] || []
            if (comidas.length > 0) {
                console.log(`    Comidas: ${comidas.map((cm: any) => cm.nombre).join(' → ')}`)
            }
            const recos = rj.recomendaciones as string[] || []
            if (recos.length > 0) {
                console.log(`    Recomendaciones:`)
                recos.forEach((rec: string) => console.log(`      • ${rec}`))
            }
        } else {
            console.log(`  ${COL.rojo('✗')} SIN PLAN IA generado`)
        }
        console.log('')
    }

    // Resumen Acciones
    console.log(`${COL.cielo('═══════════════════════════════════════════════')}`)
    console.log(`${COL.cielo('  📋 ACCIONES RECOMENDADAS')}`)
    console.log(`${COL.cielo('═══════════════════════════════════════════════')}`)
    console.log(`
  1. ${COL.azul('Abrir /clientes en el navegador')} para ver los clientes creados
  2. ${COL.azul('Ir a /clientes/[id]')} de cada uno para ver el detalle y plan generado
  3. ${COL.azul('Revisar los planes IA')} generados en cada ficha de cliente
  4. ${COL.azul('Probar generación manual')} desde la UI si algún plan no se generó
  
  ${COL.ama('Emails de prueba:')} test-XXXXX@nutricoach-test.com
  ${COL.ama('Contraseña:')} TestPass2026!
  `)
}

main().catch(console.error)
