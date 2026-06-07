// scripts/fix-nombres-tecnicos.ts
// Busca recetas con términos técnicos en el nombre (tapering, carga CHO, etc.)
// y los renombra llamando a DeepSeek para generar un nombre natural en castellano.

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DRY_RUN = !process.argv.includes('--apply')

const TERMINOS_TECNICOS = ['tapering', 'carga cho', 'carga de carbohidrato', 'pre-entreno', 'post-entreno', 'pre entreno', 'post entreno', 'tdee', 'macros', 'kcal', 'hrv', 'rpe', 'rir']

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function llamarDeepSeek(prompt: string): Promise<string> {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content.trim()
}

function extraerNombre(respuesta: string): string {
  // Puede venir entre comillas tipográficas o rectas — extraer el contenido
  const match = respuesta.match(/["""'']([^"""'']+)["""'']/)
  if (match) return match[1].trim()
  // Sin comillas: limpiar prefijos y puntuación sobrante
  return respuesta
    .replace(/^nombre:\s*/i, '')
    .replace(/^["""''«»]+/g, '')
    .replace(/["""''«»]+$/g, '')
    .trim()
}

function tieneTerminoTecnico(nombre: string): boolean {
  const lower = nombre.toLowerCase()
  return TERMINOS_TECNICOS.some(t => lower.includes(t))
}

async function main() {
  console.log(`\n=== Fix nombres técnicos en recetas ===`)
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (usar --apply para guardar)' : 'APPLY'}`)
  console.log()

  const supabase = db()

  // Buscar recetas con términos técnicos en el nombre
  // Filtramos con OR sobre los términos más comunes
  const { data: recetas, error } = await supabase
    .from('recetas')
    .select('id, nombre, instrucciones, tipo_plato, estado')
    .or([
      'nombre.ilike.%tapering%',
      'nombre.ilike.%carga cho%',
      'nombre.ilike.%Carga CHO%',
      'nombre.ilike.%pre-entreno%',
      'nombre.ilike.%post-entreno%',
      'nombre.ilike.%pre entreno%',
      'nombre.ilike.%post entreno%',
    ].join(','))

  if (error) {
    console.error('Error al buscar recetas:', error.message)
    process.exit(1)
  }

  // Filtrar también por otros términos técnicos que puedan haber pasado
  const candidatas = (recetas ?? []).filter(r => tieneTerminoTecnico(r.nombre))

  console.log(`Recetas con términos técnicos encontradas: ${candidatas.length}`)

  if (candidatas.length === 0) {
    console.log('No hay recetas que necesiten corrección.')
    return
  }

  console.log()

  let ok = 0, errores = 0

  for (const rec of candidatas) {
    console.log(`  Procesando: "${rec.nombre}"`)
    console.log(`    Tipo: ${rec.tipo_plato} | Estado: ${rec.estado}`)

    // Extraer primer ingrediente de las instrucciones
    const primeraLinea = (rec.instrucciones ?? '').split('\n')[0].slice(0, 200)

    const prompt = `Eres un chef de cocina mediterránea española.
Renombra esta receta con un nombre atractivo y natural en castellano sin términos técnicos.
Primera línea de instrucciones: ${primeraLinea}
Tipo de plato: ${rec.tipo_plato}
Nombre actual (MAL): "${rec.nombre}"
REGLAS: NO usar tapering, pre-entreno, post-entreno, carga, bowl, dorado, proteico, fit, saludable, healthy, macros, kcal, TDEE, RPE, RIR, HRV.
El nombre debe sonar a receta casera mediterránea española apetecible.
Ejemplos correctos: "Arroz meloso de pollo con calabacín al limón", "Macarrones con pavo y sofrito de tomate".
Responde SOLO con el nuevo nombre entre comillas dobles, sin explicación.`

    try {
      const respuesta = await llamarDeepSeek(prompt)
      const nuevoNombre = extraerNombre(respuesta)

      if (!nuevoNombre || nuevoNombre.length < 5) {
        console.log(`    AVISO: respuesta inesperada de DeepSeek: "${respuesta}"`)
        errores++
        continue
      }

      // Verificar que el nuevo nombre no tenga términos técnicos
      if (tieneTerminoTecnico(nuevoNombre)) {
        console.log(`    AVISO: DeepSeek devolvió nombre con términos técnicos: "${nuevoNombre}"`)
        errores++
        continue
      }

      console.log(`    Nuevo nombre: "${nuevoNombre}"`)

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('recetas')
          .update({ nombre: nuevoNombre })
          .eq('id', rec.id)

        if (updateError) {
          console.log(`    ERROR al actualizar: ${updateError.message}`)
          errores++
          continue
        }
        console.log(`    OK: actualizado en BD`)
      } else {
        console.log(`    [DRY-RUN: no se guarda]`)
      }

      ok++
    } catch (e: unknown) {
      console.log(`    ERROR: ${e instanceof Error ? e.message : String(e)}`)
      errores++
    }

    // Pausa entre llamadas
    await new Promise(r => setTimeout(r, 500))
    console.log()
  }

  console.log(`\n=== Resumen ===`)
  console.log(`  OK: ${ok}`)
  console.log(`  Errores: ${errores}`)
  console.log(`  Total procesadas: ${candidatas.length}`)
  if (DRY_RUN) {
    console.log(`\n  Usa --apply para guardar los cambios en BD`)
  }
}

main().catch(console.error)
