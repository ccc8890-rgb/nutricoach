// scripts/generar-recetas-desde-esqueletos.ts
import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { TODOS_LOS_ESQUELETOS, filtrarEsqueletos } from '../lib/recetas/esqueletos/index'
import { validarVocabulario } from '../lib/recetas/agente-recetario/vocabulary-guard'
import type { Esqueleto, IngredienteEsqueleto } from '../lib/recetas/esqueletos/types'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ── CLI args ─────────────────────────────────────────────────────
const DRY_RUN   = !process.argv.includes('--apply')
const LIMITE    = Number(process.argv.find(a => a.startsWith('--limite='))?.split('=')[1] ?? '999')
const PERFIL    = process.argv.find(a => a.startsWith('--perfil='))?.split('=')[1]
const TIPO      = process.argv.find(a => a.startsWith('--tipo='))?.split('=')[1]
const VARIACIONES = Number(process.argv.find(a => a.startsWith('--variaciones='))?.split('=')[1] ?? '1')

// ── DeepSeek ──────────────────────────────────────────────────────
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
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

// ── Prompt builder ────────────────────────────────────────────────
// Guarda de coherencia: el nombre debe mencionar el ingrediente principal
// real del esqueleto. Es la comprobación que habría bloqueado el bug de
// esta sesión (nombre "Salmón al horno..." para una receta de pollo) antes
// de insertarla — no confía solo en que el prompt lo pida.
function normalizarPalabra(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function nombreCoherenteConIngredientes(nombre: string, esqueleto: Esqueleto): boolean {
  const nombreN = normalizarPalabra(nombre)
  const principal = esqueleto.ingredientes.find(i => i.rol === 'proteina_principal') ?? esqueleto.ingredientes[0]
  const palabrasClave = normalizarPalabra(principal.nombre)
    .split(/\s+/)
    .filter(w => w.length > 3 && !['fresco', 'fresca', 'entero', 'entera', 'natural', 'crudo', 'cruda'].includes(w))
  return palabrasClave.some(w => nombreN.includes(w))
}

function construirPrompt(esqueleto: Esqueleto, variacion: number): string {
  const ings = esqueleto.ingredientes
    .map(i => `- ${i.gramos}g de ${i.nombre} (rol: ${i.rol})`)
    .join('\n')

  return `Eres un chef de cocina mediterránea española experto en nutrición deportiva.
Escribe una receta atractiva en castellano de España a partir de estos ingredientes y técnica.

TÉCNICA: ${esqueleto.tecnica}
TIPO DE PLATO: ${esqueleto.tipoPlato}
INGREDIENTES:
${ings}
${variacion > 1 ? `\nEsta es la variación ${variacion} — usa una preparación, salsa o presentación diferente a las anteriores.` : ''}

REGLAS ABSOLUTAS — si las incumples el sistema rechaza la receta:
- El nombre y la descripción DEBEN mencionar explícitamente el ingrediente de rol "proteina_principal" (o el de más peso si no hay ninguno con ese rol) tal cual aparece en la lista de arriba. NUNCA nombres, en su lugar, otra proteína o ingrediente que no esté en la lista — aunque suene más apetecible. Si la lista dice "pechuga de pollo", el nombre debe decir pollo; nunca salmón, atún, merluza, caballa ni ningún otro sustituto.
- NUNCA uses en nombre, descripción ni instrucciones: tapering, pre-entreno, post-entreno, carga, carga de carbohidratos, carga cho, TDEE, macros, proteico, fit, healthy, saludable (como adjetivo del nombre), bowl, dorado (en sentido culinario), smoothie bowl, açaí, granola bowl, RPE, RIR, HRV, FODMAP, goitrógeno, dislipidemia, hipotiroidismo, resistencia a la insulina, colon irritable
- El nombre debe sonar a receta casera mediterránea española apetecible
- Formato de nombre (sustituye SIEMPRE los ingredientes de ejemplo por los reales de la lista de arriba): "[Técnica de preparación] de [proteína/ingrediente principal] con [acompañamiento] al/con [detalle]" — ej. si la lista trae pollo+calabacín+limón: "Pollo meloso con calabacín al limón"; si trae garbanzos+espinacas: "Garbanzos guisados con espinacas"
- Vocabulario permitido: meloso, cremoso, jugoso, tierno, crujiente, especiado, al horno, a la plancha, al vapor, guisado, estofado, en salsa, con sofrito, al ajillo, mediterráneo, casero, de temporada
- Instrucciones con intención culinaria: textura deseada, punto de cocción, montaje, contraste — usando SOLO los ingredientes listados, ninguno más

Devuelve SOLO este JSON (sin texto extra):
{
  "nombre": "...",
  "descripcion": "...",
  "instrucciones": ["paso 1", "paso 2", "paso 3", "paso 4"],
  "consejos": "..."
}`
}

// ── Parser de respuesta ───────────────────────────────────────────
type RecetaGenerada = {
  nombre: string
  descripcion: string
  instrucciones: string[]
  consejos: string
}

function parsearRespuesta(raw: string): RecetaGenerada {
  const obj = JSON.parse(raw) as RecetaGenerada
  if (!obj.nombre || !obj.descripcion || !Array.isArray(obj.instrucciones)) {
    throw new Error('Estructura JSON inválida')
  }
  return obj
}

// ── Supabase ──────────────────────────────────────────────────────
function crearSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function obtenerCoachId(db: ReturnType<typeof crearSupabase>): Promise<string> {
  const email = process.env.NUTRICOACH_COACH_EMAIL ?? 'ccc8890@gmail.com'
  const { data } = await db.from('profiles').select('id').eq('email', email).single()
  if (!data) throw new Error(`Coach ${email} no encontrado en profiles`)
  return data.id
}

async function insertarReceta(
  db: ReturnType<typeof crearSupabase>,
  coachId: string,
  esqueleto: Esqueleto,
  generada: RecetaGenerada,
): Promise<string> {
  const { data, error } = await (db.from('recetas') as any).insert({
    coach_id:        coachId,
    nombre:          generada.nombre,
    descripcion:     generada.descripcion,
    instrucciones:   generada.instrucciones.join('\n'),
    consejos:        generada.consejos,
    tipo_plato:      esqueleto.tipoPlato,
    estado:          'en_revision',
    tags:            [
      ...esqueleto.metadatos.momentos,
      ...esqueleto.metadatos.deportes.filter((d: string) => d !== 'todos'),
      ...esqueleto.metadatos.objetivos,
      esqueleto.perfil,
    ],
  }).select('id').single()

  if (error) throw new Error(error.message)
  return data!.id
}

// ── Vincular ingredientes del esqueleto + calcular macros ──────────
//
// Bug raíz corregido (30-09-2026, ver TAREAS.md T43c): esta función antes
// no existía — los ingredientes se vinculaban en un paso APARTE
// (scripts/backfill-macros-esqueletos.ts) que ya no sabía qué esqueleto
// exacto había generado cada receta (no se guardaba ninguna referencia) y
// tenía que ADIVINARLO por perfil+tipoPlato+tags. Cuando varios esqueletos
// compartían esas señales, adivinaba mal y le colgaba a una receta los
// ingredientes de otro esqueleto distinto — así una receta "Salmón al
// horno..." podía acabar con pechuga de pollo y arroz como ingredientes
// reales. Vincular aquí, con el `esqueleto` ya en memoria (sin adivinar
// nada), elimina esa clase de bug de raíz para todo lo generado a partir
// de ahora.
type AlimentoDB = { id: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number }

async function buscarAlimento(db: ReturnType<typeof crearSupabase>, nombre: string): Promise<AlimentoDB | null> {
  const { data: exacto } = await db.from('alimentos')
    .select('id, calorias, proteinas, carbohidratos, grasas, fibra')
    .ilike('nombre', nombre).eq('es_comestible', true).gt('calorias', 0)
    .order('nombre').limit(1)
  if (exacto?.[0]) return exacto[0] as AlimentoDB

  const palabras = nombre.toLowerCase()
    .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] ?? c))
    .split(/\s+/).filter(w => w.length > 3)
  for (const w of palabras) {
    const { data } = await db.from('alimentos')
      .select('id, calorias, proteinas, carbohidratos, grasas, fibra')
      .ilike('nombre', `%${w}%`).eq('es_comestible', true).gt('calorias', 0)
      .order('nombre').limit(1)
    if (data?.[0]) return data[0] as AlimentoDB
  }
  return null
}

async function vincularIngredientesYMacros(
  db: ReturnType<typeof crearSupabase>,
  recetaId: string,
  esqueleto: Esqueleto,
  porciones: number,
): Promise<{ vinculados: number; total: number }> {
  const filas: Array<{ receta_id: string; alimento_id: string; nombre_libre: string; cantidad_gramos: number; rol_ingrediente: string }> = []
  let kcal = 0, prot = 0, carb = 0, gras = 0, fib = 0

  for (const ing of esqueleto.ingredientes) {
    const alimento = await buscarAlimento(db, ing.nombre)
    if (!alimento) continue
    const factor = ing.gramos / 100
    kcal += alimento.calorias * factor
    prot += alimento.proteinas * factor
    carb += alimento.carbohidratos * factor
    gras += alimento.grasas * factor
    fib += (alimento.fibra ?? 0) * factor
    filas.push({
      receta_id: recetaId,
      alimento_id: alimento.id,
      nombre_libre: ing.nombre,
      cantidad_gramos: ing.gramos,
      rol_ingrediente: ing.rol,
    })
  }

  if (filas.length > 0) {
    const { error: errIng } = await db.from('receta_ingredientes').insert(filas)
    if (errIng) throw new Error(errIng.message)

    const p = Math.max(porciones, 1)
    const { error: errMacros } = await db.from('recetas').update({
      kcal: Math.round(kcal / p * 10) / 10,
      proteinas: Math.round(prot / p * 10) / 10,
      carbohidratos: Math.round(carb / p * 10) / 10,
      grasas: Math.round(gras / p * 10) / 10,
      fibra: Math.round(fib / p * 10) / 10,
    }).eq('id', recetaId)
    if (errMacros) throw new Error(errMacros.message)
  }

  return { vinculados: filas.length, total: esqueleto.ingredientes.length }
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🍳 Generador de recetas desde esqueletos`)
  console.log(`   Modo: ${DRY_RUN ? 'DRY-RUN (sin insertar)' : 'APPLY'}`)
  console.log(`   Variaciones por esqueleto: ${VARIACIONES}`)
  if (PERFIL) console.log(`   Perfil: ${PERFIL}`)
  if (TIPO) console.log(`   Tipo plato: ${TIPO}`)
  console.log()

  let esqueletos = TODOS_LOS_ESQUELETOS
  if (PERFIL) esqueletos = esqueletos.filter(e => e.perfil === PERFIL)
  if (TIPO) esqueletos = esqueletos.filter(e => e.tipoPlato === TIPO)
  esqueletos = esqueletos.slice(0, LIMITE)

  console.log(`   Esqueletos a procesar: ${esqueletos.length}\n`)

  const db = DRY_RUN ? null : crearSupabase()
  const coachId = DRY_RUN ? 'dry-run' : await obtenerCoachId(db!)

  let ok = 0, rechazadas = 0, errores = 0

  for (const esqueleto of esqueletos) {
    for (let v = 1; v <= VARIACIONES; v++) {
      const label = `${esqueleto.id}${VARIACIONES > 1 ? `-v${v}` : ''}`
      process.stdout.write(`  → ${label} ... `)

      try {
        const prompt = construirPrompt(esqueleto, v)
        const raw = await llamarDeepSeek(prompt)
        const generada = parsearRespuesta(raw)

        const vocab = validarVocabulario(generada)
        if (!vocab.valido) {
          console.log(`❌ Vocabulario`)
          vocab.violaciones.forEach(viol =>
            console.log(`     campo=${viol.campo} patrón=${viol.patron}`)
          )
          rechazadas++
          continue
        }

        if (!nombreCoherenteConIngredientes(generada.nombre, esqueleto)) {
          console.log(`❌ Nombre no coherente con ingredientes ("${generada.nombre}")`)
          rechazadas++
          continue
        }

        if (DRY_RUN) {
          console.log(`✅ "${generada.nombre}"`)
        } else {
          const recetaId = await insertarReceta(db!, coachId, esqueleto, generada)
          const { vinculados, total } = await vincularIngredientesYMacros(db!, recetaId, esqueleto, 1)
          console.log(`✅ "${generada.nombre}" (${vinculados}/${total} ingredientes vinculados)`)
        }
        ok++

      } catch (err) {
        console.log(`💥 Error: ${err instanceof Error ? err.message : err}`)
        errores++
      }

      // Pausa para no saturar la API
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`\n── Resumen ──────────────────────────────`)
  console.log(`   ✅ Generadas: ${ok}`)
  console.log(`   ❌ Rechazadas (vocabulario): ${rechazadas}`)
  console.log(`   💥 Errores: ${errores}`)
  if (DRY_RUN) console.log(`\n   ℹ️  Ejecutar con --apply para insertar en BD`)
}

main().catch(console.error)
