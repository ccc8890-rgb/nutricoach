import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { inferirRolIngrediente } from '../lib/ingredient-roles'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type FoodKey =
  | 'arroz_blanco'
  | 'arroz_basmati'
  | 'cuscus'
  | 'pan_blanco'
  | 'tortitas_arroz'
  | 'platano'
  | 'mermelada_fresa'
  | 'zumo_naranja'
  | 'patata'
  | 'boniato'
  | 'pollo'
  | 'pavo'
  | 'atun'
  | 'leche_desnatada'
  | 'yogur_griego'

const FOOD_QUERIES: Record<FoodKey, string> = {
  arroz_blanco: 'Arroz blanco',
  arroz_basmati: 'Arroz basmati',
  cuscus: 'Cuscús',
  pan_blanco: 'Pan blanco',
  tortitas_arroz: 'Tortitas de Arroz Integral Paquete',
  platano: 'Plátano (maduro)',
  mermelada_fresa: 'Mermelada Fresa de Temporada',
  zumo_naranja: 'Zumo de naranja',
  patata: 'Patata, cruda',
  boniato: 'Boniato',
  pollo: 'Pechuga de Pollo sin Grasa',
  pavo: 'Pechuga de Pavo Lonchas Finas',
  atun: 'Atún en lata al natural',
  leche_desnatada: 'Leche desnatada Asturiana',
  yogur_griego: 'Yogur griego natural (0%)',
}

type Food = {
  id: string
  nombre: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  fibra: number | null
  categoria: string | null
}

type RecetaSeed = {
  nombre: string
  descripcion: string
  categoria: string
  tipo_plato: string
  momentos: string[]
  ingredientes: Array<{ key: FoodKey; nombre: string; gramos: number }>
  instrucciones: string
  consejos: string
  deportes?: string[]
}

const RECETAS: RecetaSeed[] = [
  {
    nombre: 'Tapering: arroz blanco con plátano y mermelada',
    descripcion: 'Bowl simple de arroz blanco, plátano maduro y mermelada de fresa para aumentar carbohidratos sin meter demasiada grasa. Pensado para el día previo a carrera o sesiones largas.',
    categoria: 'Desayuno',
    tipo_plato: 'Desayuno',
    momentos: ['desayuno', 'carga_cho', 'tapering'],
    ingredientes: [
      { key: 'arroz_blanco', nombre: 'Arroz blanco', gramos: 95 },
      { key: 'platano', nombre: 'Plátano maduro', gramos: 120 },
      { key: 'mermelada_fresa', nombre: 'Mermelada de fresa', gramos: 35 },
      { key: 'zumo_naranja', nombre: 'Zumo de naranja', gramos: 120 },
    ],
    instrucciones: '1. Cocer el arroz blanco con agua hasta que quede blando y fácil de digerir.\n2. Cortar el plátano en rodajas finas.\n3. Servir el arroz templado con la mermelada y el plátano encima.\n4. Acompañar con el zumo de naranja y tomar sin añadir grasas extra.',
    consejos: 'Usar en tapering o carga de hidratos cuando se busca alta disponibilidad de carbohidratos y digestión sencilla.',
  },
  {
    nombre: 'Carga CHO: cuscús con pavo y zumo de naranja',
    descripcion: 'Plato rápido de cuscús con pavo magro y zumo de naranja. Aporta carbohidratos altos con proteína ligera y grasa baja.',
    categoria: 'Comida',
    tipo_plato: 'Comida',
    momentos: ['comida', 'carga_cho', 'post_entreno'],
    ingredientes: [
      { key: 'cuscus', nombre: 'Cuscús', gramos: 105 },
      { key: 'pavo', nombre: 'Pechuga de pavo', gramos: 90 },
      { key: 'zumo_naranja', nombre: 'Zumo de naranja', gramos: 120 },
      { key: 'pan_blanco', nombre: 'Pan blanco', gramos: 45 },
    ],
    instrucciones: '1. Hidratar el cuscús con agua caliente y dejar reposar 5 minutos.\n2. Cortar la pechuga de pavo en tiras pequeñas.\n3. Mezclar el cuscús con el pavo y servir con el pan blanco.\n4. Tomar el zumo de naranja como parte de la comida para completar la carga de carbohidratos.',
    consejos: 'Útil cuando el cliente necesita subir carbohidratos sin mucha cocina ni fibra excesiva.',
  },
  {
    nombre: 'Pre-carrera: pan blanco con mermelada y plátano',
    descripcion: 'Opción muy simple para antes de carrera: pan blanco, mermelada y plátano con bebida de naranja. Baja en grasa y fácil de ajustar.',
    categoria: 'Desayuno',
    tipo_plato: 'Desayuno',
    momentos: ['desayuno', 'pre_entreno', 'tapering'],
    ingredientes: [
      { key: 'pan_blanco', nombre: 'Pan blanco', gramos: 95 },
      { key: 'mermelada_fresa', nombre: 'Mermelada de fresa', gramos: 40 },
      { key: 'platano', nombre: 'Plátano maduro', gramos: 110 },
      { key: 'zumo_naranja', nombre: 'Zumo de naranja', gramos: 120 },
    ],
    instrucciones: '1. Tostar ligeramente el pan blanco si se tolera mejor.\n2. Untar la mermelada de fresa de forma uniforme.\n3. Añadir el plátano en rodajas o tomarlo aparte.\n4. Acompañar con el zumo y evitar añadir mantequilla o frutos secos.',
    consejos: 'Ideal 2-3 horas antes de competir. Si hay nervios digestivos, reducir el plátano y subir un poco el pan.',
  },
  {
    nombre: 'Carga CHO: patata cocida con atún y pan blanco',
    descripcion: 'Base de patata cocida con atún al natural y pan blanco. Funciona como comida sencilla de carga o recuperación con grasa controlada.',
    categoria: 'Comida',
    tipo_plato: 'Comida',
    momentos: ['comida', 'carga_cho', 'post_entreno'],
    ingredientes: [
      { key: 'patata', nombre: 'Patata', gramos: 520 },
      { key: 'atun', nombre: 'Atún al natural', gramos: 90 },
      { key: 'pan_blanco', nombre: 'Pan blanco', gramos: 60 },
      { key: 'zumo_naranja', nombre: 'Zumo de naranja', gramos: 120 },
    ],
    instrucciones: '1. Cocer la patata pelada hasta que esté muy tierna.\n2. Escurrir el atún al natural.\n3. Servir la patata troceada con el atún por encima.\n4. Añadir el pan blanco y el zumo de naranja para completar carbohidratos.',
    consejos: 'Para tapering cercano a carrera, retirar piel de la patata y evitar salsas grasas.',
  },
  {
    nombre: 'Tapering: tortitas de arroz con mermelada y yogur',
    descripcion: 'Merienda de tapering con tortitas de arroz, mermelada y yogur griego 0%. Sube carbohidratos con proteína ligera y poca grasa.',
    categoria: 'Merienda',
    tipo_plato: 'Merienda',
    momentos: ['merienda', 'carga_cho', 'tapering'],
    ingredientes: [
      { key: 'tortitas_arroz', nombre: 'Tortitas de arroz', gramos: 55 },
      { key: 'mermelada_fresa', nombre: 'Mermelada de fresa', gramos: 45 },
      { key: 'yogur_griego', nombre: 'Yogur griego natural 0%', gramos: 170 },
      { key: 'platano', nombre: 'Plátano maduro', gramos: 90 },
    ],
    instrucciones: '1. Colocar las tortitas de arroz en un plato.\n2. Repartir la mermelada por encima.\n3. Servir el yogur griego 0% al lado.\n4. Añadir el plátano en rodajas y tomar como merienda sencilla.',
    consejos: 'Buena opción cuando se necesita una carga moderada sin cocinar y sin exceso de grasa.',
  },
  {
    nombre: 'Carga CHO: arroz basmati con pollo y pan blanco',
    descripcion: 'Bowl de arroz basmati con pollo magro y pan blanco para días de alto volumen. Mantiene proteína suficiente y baja grasa.',
    categoria: 'Comida',
    tipo_plato: 'Comida',
    momentos: ['comida', 'carga_cho', 'post_entreno'],
    ingredientes: [
      { key: 'arroz_basmati', nombre: 'Arroz basmati', gramos: 110 },
      { key: 'pollo', nombre: 'Pechuga de pollo', gramos: 120 },
      { key: 'pan_blanco', nombre: 'Pan blanco', gramos: 45 },
      { key: 'zumo_naranja', nombre: 'Zumo de naranja', gramos: 120 },
    ],
    instrucciones: '1. Cocer el arroz basmati hasta que quede suelto.\n2. Cocinar la pechuga de pollo a la plancha sin añadir aceite.\n3. Servir el arroz con el pollo cortado en tiras.\n4. Añadir pan blanco y zumo de naranja para completar el objetivo de carbohidratos.',
    consejos: 'Para carga agresiva, subir arroz; para digestión sensible, mantener el pollo en porción moderada.',
  },
  {
    nombre: 'Pre-entreno largo: boniato con pavo y plátano',
    descripcion: 'Comida pre-entreno para sesiones largas con boniato, pavo y plátano. Aporta energía sostenida sin salsas pesadas.',
    categoria: 'Comida',
    tipo_plato: 'Comida',
    momentos: ['comida', 'pre_entreno', 'carga_cho'],
    ingredientes: [
      { key: 'boniato', nombre: 'Boniato', gramos: 420 },
      { key: 'pavo', nombre: 'Pechuga de pavo', gramos: 100 },
      { key: 'platano', nombre: 'Plátano maduro', gramos: 100 },
      { key: 'pan_blanco', nombre: 'Pan blanco', gramos: 40 },
    ],
    instrucciones: '1. Asar o cocer el boniato hasta que quede muy tierno.\n2. Añadir la pechuga de pavo en lonchas o tiras.\n3. Servir con el pan blanco.\n4. Tomar el plátano como postre de la misma comida.',
    consejos: 'Tomar 3-4 horas antes de una sesión larga. Si hay molestias, cambiar parte del boniato por arroz blanco.',
  },
  {
    nombre: 'Tapering express: arroz blanco con leche desnatada y plátano',
    descripcion: 'Versión ligera de arroz con leche para tapering, con leche desnatada y plátano. Carbohidrato alto, grasa muy baja y textura blanda.',
    categoria: 'Desayuno',
    tipo_plato: 'Desayuno',
    momentos: ['desayuno', 'carga_cho', 'tapering'],
    ingredientes: [
      { key: 'arroz_blanco', nombre: 'Arroz blanco', gramos: 90 },
      { key: 'leche_desnatada', nombre: 'Leche desnatada', gramos: 250 },
      { key: 'platano', nombre: 'Plátano maduro', gramos: 120 },
      { key: 'mermelada_fresa', nombre: 'Mermelada de fresa', gramos: 25 },
    ],
    instrucciones: '1. Cocer el arroz blanco con la leche desnatada a fuego suave.\n2. Remover hasta que quede cremoso y blando.\n3. Añadir el plátano en rodajas al final.\n4. Terminar con la mermelada de fresa por encima.',
    consejos: 'Usar como desayuno del día previo o como comida de carga suave. Evitar añadir frutos secos.',
  },
]

function round1(value: number) {
  return Math.round(value * 10) / 10
}

async function resolverFoods() {
  const foods = {} as Record<FoodKey, Food>
  for (const [key, name] of Object.entries(FOOD_QUERIES) as Array<[FoodKey, string]>) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id,nombre,calorias,proteinas,carbohidratos,grasas,fibra,categoria')
      .eq('es_comestible', true)
      .ilike('nombre', name)
      .gt('calorias', 0)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!data?.[0]) throw new Error(`No encontrado alimento base: ${key} -> ${name}`)
    foods[key] = data[0] as Food
  }
  return foods
}

async function main() {
  const aplicar = process.argv.includes('--apply')
  const repararExistentes = process.argv.includes('--repair-existing')
  const foods = await resolverFoods()

  console.log(`${aplicar ? '[APPLY]' : '[DRY-RUN]'} Recetas nuevas: ${RECETAS.length}`)

  for (const receta of RECETAS) {
    const { data: existente } = await supabase
      .from('recetas')
      .select('id,estado,nombre')
      .ilike('nombre', receta.nombre)
      .maybeSingle()

    if (existente) {
      if (!aplicar || !repararExistentes) {
        console.log(`  SKIP existente ${existente.estado} · ${receta.nombre}`)
        continue
      }
    }

    const macros = receta.ingredientes.reduce((acc, ing) => {
      const food = foods[ing.key]
      const f = ing.gramos / 100
      acc.kcal += food.calorias * f
      acc.proteinas += food.proteinas * f
      acc.carbohidratos += food.carbohidratos * f
      acc.grasas += food.grasas * f
      acc.fibra += (food.fibra ?? 0) * f
      return acc
    }, { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 })

    console.log(`  + ${Math.round(macros.kcal)} kcal | ${round1(macros.proteinas)}P ${round1(macros.carbohidratos)}C ${round1(macros.grasas)}G | ${receta.nombre}`)
    if (!aplicar) continue

    const recetaPayload = {
        nombre: receta.nombre,
        descripcion: receta.descripcion,
        categoria: receta.categoria,
        tipo_plato: receta.tipo_plato,
        dificultad: 'facil',
        tipo_coccion: 'Cocción simple',
        porciones: 1,
        descripcion_porcion: '1 ración individual',
        tiempo_prep_min: 10,
        tiempo_coccion_min: receta.nombre.includes('express') || receta.nombre.includes('cuscús') ? 10 : 20,
        kcal: round1(macros.kcal),
        proteinas: round1(macros.proteinas),
        carbohidratos: round1(macros.carbohidratos),
        grasas: round1(macros.grasas),
        fibra: round1(macros.fibra),
        instrucciones: receta.instrucciones,
        consejos: receta.consejos,
        tags: ['rendimiento', 'carga_cho', 'digestibilidad', 'periodizacion'],
        objetivos: ['rendimiento'],
        deportes: receta.deportes ?? ['running', 'endurance', 'ciclismo', 'triatlon'],
        momentos: receta.momentos,
        estilos: ['funcional', 'rapida'],
        premium_chef: false,
        batch_cooking: false,
        tupper: false,
        digestibilidad: receta.momentos.includes('tapering') ? 'alta' : 'media',
        densidad_energetica: 'alta',
        nivel_elaboracion: 1,
        adherencia_score: 78,
        coste_estimado_nivel: 'bajo',
        intolerancias: receta.ingredientes.some(i => i.key === 'pan_blanco' || i.key === 'cuscus') ? ['Gluten'] : [],
        estado: 'en_revision',
        fuente: 'curacion_manual_codex',
        fuente_tipo: 'manual',
        url_origen: 'manual://recetas-carga-tapering-2026-06-07',
        taxonomia_version: 2,
        taxonomia_actualizada_at: new Date().toISOString(),
        imagen_estado: 'sin_imagen',
        imagen_origen: 'missing',
        imagen_needs_review: true,
        imagen_review_notes: 'Receta curada para carga CHO/tapering. Requiere imagen realista antes de uso comercial.',
      }

    const { data: creada, error: recetaError } = existente
      ? await supabase
        .from('recetas')
        .update(recetaPayload)
        .eq('id', existente.id)
        .select('id')
        .single()
      : await supabase
        .from('recetas')
        .insert(recetaPayload)
        .select('id')
        .single()

    if (recetaError || !creada) throw new Error(recetaError?.message ?? `No se pudo crear ${receta.nombre}`)

    if (existente) {
      const { error: deleteError } = await supabase
        .from('receta_ingredientes')
        .delete()
        .eq('receta_id', creada.id)
      if (deleteError) throw new Error(deleteError.message)
    }

    const { error: ingError } = await supabase
      .from('receta_ingredientes')
      .insert(receta.ingredientes.map((ing, index) => {
        const food = foods[ing.key]
        return {
          receta_id: creada.id,
          alimento_id: food.id,
          nombre_libre: ing.nombre,
          cantidad_gramos: ing.gramos,
          orden: index,
          rol_ingrediente: inferirRolIngrediente(food, ing.nombre),
          es_cantidad_fija: false,
        }
      }))

    if (ingError) throw new Error(ingError.message)

    const audit = await auditarRecetaProfesional(supabase, creada.id, 'seed_carga_tapering', 'seed-recetas-carga-tapering')
    console.log(`    audit ${audit.score.score} · ${audit.resumen.estado_sugerido} · bloqueantes=${audit.score.bloqueantes.join(',') || '0'}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
