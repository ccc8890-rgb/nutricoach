/**
 * deepseek.ts — Cliente para DeepSeek API
 *
 * CONFIGURACIÓN:
 *   Añadir DEEPSEEK_API_KEY a .env.local
 *   Opcional: DEEPSEEK_MODEL en .env.local (default: deepseek-v4-flash)
 *
 * PRECIOS (deepseek-v4-flash):
 *   $0.15/M input tokens, $0.60/M output tokens
 *
 * USO:
 *   import { generarDietaConIA } from '@/lib/deepseek'
 *   const resultado = await generarDietaConIA(promptData)
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
// Modelo actual: deepseek-chat (V3). NO usar deepseek-v4-pro ni deepseek-v4-flash (deprecados)
// GET https://api.deepseek.com/v1/models
// Configurable via DEEPSEEK_MODEL en .env.local (default: deepseek-chat)
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

interface DeepSeekResponse {
    id: string
    choices: {
        index: number
        message: DeepSeekMessage
        finish_reason: string
    }[]
    usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

export interface DietaGenerada {
    plantilla_id_elegida: string
    razon_plantilla: string
    comidas: {
        nombre: string
        orden: number
        origen_adherencia?: 'recetario' | 'habitual_adaptado' | 'novedad_controlada' | 'manual'
        adaptacion_habitual?: string
        alimentos: {
            receta_id: string
            receta_nombre: string
            cantidad_porciones: number
        }[]
    }[]
    macros_totales: {
        kcal: number
        proteinas: number
        carbohidratos: number
        grasas: number
    }
    notas: string
    // ── Campos pro (opcionales por retrocompatibilidad) ────────────
    notas_cliente?: string           // Narrativa personalizada al cliente
    protocolo_semana?: {
        dia_entreno: string          // Qué hacer diferente en días de entreno
        dia_descanso: string         // Ajustes en días de descanso
        timing_clave: string         // Cuándo concentrar carbohidratos/proteína
    }
    justificacion_coach?: {
        razonamiento_macros: string  // Qué paper/protocolo justifica estos macros
        senales_seguimiento: string[]// Qué medir en el próximo check-in (2-4 semanas)
        proxima_revision: string     // Qué ajustar si hay estancamiento/desvío
    }
}

/**
 * Construye el prompt para DeepSeek.
 * Se le pasa el contexto del cliente + plantillas + recetas disponibles.
 */
export function construirPrompt(
    datosCliente: Record<string, string | string[] | number>,
    plantillas: { id: string; nombre: string; kcal_objetivo: number; proteinas_objetivo: number; carbohidratos_objetivo: number; grasas_objetivo: number }[],
    recetas: { id: string; nombre: string; categoria: string; kcal: number; proteinas: number; carbohidratos: number; grasas: number; azucares?: number; sodio_mg?: number; fibra?: number }[],
    conocimientoCientifico?: string
): string {
    const clienteStr = Object.entries(datosCliente)
        .map(([k, v]) => `  - ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n')

    const plantillasStr = JSON.stringify(plantillas, null, 2)

    // Agrupar recetas por categoría
    const recetasPorCategoria: Record<string, typeof recetas> = {}
    for (const r of recetas) {
        const cat = r.categoria || 'Otras'
        if (!recetasPorCategoria[cat]) recetasPorCategoria[cat] = []
        recetasPorCategoria[cat].push(r)
    }
    const recetasStr = JSON.stringify(recetasPorCategoria, null, 2)

    const conocimiento = conocimientoCientifico
        ? `\nCONOCIMIENTO CIENTÍFICO PARA APLICAR EN LA DIETA:\n${conocimientoCientifico}\n\n`
        : ''

    return `${conocimiento}REGLAS DE SELECCIÓN DE RECETAS:
- Usa SOLO las recetas proporcionadas en la lista *_CANDIDATAS por slot
- NO inventes recetas ni uses IDs que no estén en la lista
- Elige la plantilla que MÁS se ajuste al perfil del cliente
- Ajusta porciones para cumplir macros del slot (±8%)
- Prioriza variedad (no repetir receta en distintas comidas del mismo día)
- Intolerancias y restricciones del cliente son LÍMITES DUROS, nunca los violes
- Si el cliente declaró dieta habitual, escucha primero: respeta SUS platos razonables, optimiza cantidades y usa recetas nuevas como alternativas progresivas
- No extrapoles desde ejemplos de otros clientes. Cada plan se adapta al texto real de ESTE onboarding
- Cuando un slot venga de su dieta habitual, marca "origen_adherencia": "habitual_adaptado" y explica el ajuste en "adaptacion_habitual"
- Patologías especiales:
  * DIABETES / RESISTENCIA A INSULINA → prioriza recetas con azúcares < 10g/100g
  * HIPERTENSIÓN → sodio < 400mg/100g, evita embutidos
  * ESTREÑIMIENTO → fibra > 4g/100g

DATOS DEL CLIENTE:
${clienteStr}

PLANTILLAS DISPONIBLES (elige la más adecuada):
${plantillasStr}

RECETAS DISPONIBLES (agrupadas por categoría):
${recetasStr}

SCHEMA DE SALIDA JSON (respeta todos los campos):

{
  "plantilla_id_elegida": "uuid o cadena vacía si no aplica",
  "razon_plantilla": "por qué esta plantilla",
  "comidas": [
    {
      "nombre": "Desayuno",
      "orden": 1,
      "origen_adherencia": "habitual_adaptado",
      "adaptacion_habitual": "Mantengo la estructura del plato habitual declarado por el cliente y ajusto cantidades, proteína, fibra o timing para llegar al objetivo.",
      "alimentos": [
        {
          "receta_id": "uuid-exacto-de-la-lista",
          "receta_nombre": "Nombre de la receta",
          "cantidad_porciones": 1
        }
      ]
    }
  ],
  "macros_totales": {
    "kcal": 1800,
    "proteinas": 135,
    "carbohidratos": 200,
    "grasas": 60
  },
  "notas": "notas generales del plan",
  "notas_cliente": "Mensaje personalizado para el cliente, 3-4 frases explicando su plan en tono de coach cercano",
  "protocolo_semana": {
    "dia_entreno": "qué ajustar en días con entrenamiento (timing, cantidades)",
    "dia_descanso": "qué reducir o ajustar en días de descanso",
    "timing_clave": "la regla de oro más importante para este cliente"
  },
  "justificacion_coach": {
    "razonamiento_macros": "qué protocolo científico justifica estos macros para este objetivo",
    "senales_seguimiento": ["indicador 1 a medir en 2-4 semanas", "indicador 2", "indicador 3"],
    "proxima_revision": "qué ajustar en 3 semanas si no hay progreso esperado"
  }
}`
}

/**
 * Llama a DeepSeek V3 para generar una dieta.
 * Lanza error si la API falla o el JSON de respuesta no es válido.
 * Devuelve { data, total_tokens } para poder loguear el consumo.
 */
export async function generarDietaConIA(prompt: string, contextoClinico?: string): Promise<{ data: DietaGenerada; total_tokens: number }> {
    const apiKey = process.env.DEEPSEEK_API_KEY

    if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY no configurada. Añádela en .env.local')
    }

    const SYSTEM_PROMPT_ELITE = `Eres un nutricionista deportivo de élite con 20 años de experiencia trabajando con atletas recreacionales y profesionales en España. Tienes certificación ISSN (International Society of Sports Nutrition) y especialización en running, CrossFit, triatlón e Hyrox.

TU MISIÓN:
Los cálculos de TDEE, macros, distribución proteica y mesociclo ya están hechos por el sistema — NO los recalcules ni los contradigas.
Tu trabajo es lo que ningún software puede hacer: pensar como el experto que el cliente está pagando.

LO QUE DEBES HACER:
1. SELECCIONAR las recetas óptimas del recetario para cada slot:
   - Respeta los macros del slot con margen ±8%
   - Considera timing de entrenamiento (pre/post): carbohidratos en pre, proteína en post
   - Adapta al nivel de cocina y tiempo disponible del cliente
   - Varía: nunca repitas la misma receta dos veces en un mismo día
   - Prioriza recetas altas en proteína en post-entreno y cena
   - Si el cliente indicó un plato habitual, NO lo ignores: mantén la idea base de ese cliente y selecciona la receta del recetario más parecida o una alternativa compatible
   - Evita cambios bruscos: mezcla familiaridad + mejora nutricional + pequeñas novedades

2. ESCRIBIR "notas_cliente" — mensaje personalizado al cliente (3-4 frases):
   - En tono de coach cercano: "Tu plan está diseñado para..."
   - Explica el POR QUÉ concreto de sus macros (no genérico)
   - Conecta con su objetivo real y su estilo de vida
   - Menciona al menos una receta concreta del plan que le ayudará
   - NUNCA uses frases vacías como "sigue así" o "lo estás haciendo bien"

3. ESCRIBIR "protocolo_semana" — guía práctica de una semana tipo:
   - "dia_entreno": qué ajustar en días con entrenamiento (timing CHO, comida pre/post)
   - "dia_descanso": qué reducir o ajustar si no hay entreno (generalmente -10-15% CHO)
   - "timing_clave": la regla de oro más importante para este cliente específico

4. ESCRIBIR "justificacion_coach" — briefing técnico para el coach:
   - "razonamiento_macros": qué protocolo científico justifica estos macros (citar paper si aplica)
   - "senales_seguimiento": 3 indicadores concretos a medir en el próximo check-in (2-4 semanas)
   - "proxima_revision": qué ajustar si en 3 semanas no hay progreso

FILOSOFÍA: Cada plan que generas es el que un nutricionista de 150-200€/sesión daría. Tiene base científica, personalización real, y el cliente entiende por qué come lo que come. No es un template, es un plan de esa persona en concreto.
ADHERENCIA: El mejor plan no es el más perfecto en papel; es el que el cliente sigue. Escucha sus hábitos declarados y transfórmalos con criterio.

RESPONDE ÚNICAMENTE EN JSON VÁLIDO. Sin markdown, sin explicaciones fuera del JSON.`

    const systemContent = contextoClinico
        ? `${SYSTEM_PROMPT_ELITE}\n\n${contextoClinico}`
        : SYSTEM_PROMPT_ELITE

    const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt },
    ]

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            temperature: 0.35,
            max_tokens: 6000,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
    }

    const data: DeepSeekResponse = await response.json()

    const content = data.choices?.[0]?.message?.content
    if (!content) {
        throw new Error('DeepSeek: respuesta vacía')
    }

    // Intentar extraer JSON del contenido (por si viene con markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        throw new Error(`DeepSeek: respuesta no contiene JSON válido. Contenido: ${content.slice(0, 500)}`)
    }

    try {
        const parsed: DietaGenerada = JSON.parse(jsonMatch[0])

        // Validar estructura mínima (los campos pro son opcionales)
        if (!parsed.comidas || !parsed.macros_totales) {
            throw new Error('DeepSeek: JSON incompleto. Faltan comidas o macros_totales.')
        }
        // plantilla_id_elegida puede ser null si el coach no tiene plantillas definidas
        if (!parsed.plantilla_id_elegida) parsed.plantilla_id_elegida = ''

        return { data: parsed, total_tokens: data.usage.total_tokens }
    } catch (parseError) {
        throw new Error(`DeepSeek: error al parsear JSON: ${parseError instanceof Error ? parseError.message : 'error desconocido'}`)
    }
}

// ── Informe Semanal Automático ─────────────────────────────────────────────

export interface InformeSemanal {
    resumen: string
    evolucion_peso: string
    adherencia: string
    energia: string
    recomendaciones: string[]
    estado_general: 'positivo' | 'neutro' | 'atencion'
}

/**
 * Construye el prompt para que DeepSeek genere un informe semanal del cliente.
 */
export function construirPromptInformeSemanal(
    cliente: {
        nombre?: string
        peso_inicial?: number
        objetivo?: string
    },
    pesoHistory: { fecha: string; peso: number }[],
    checkins: { fecha: string; adherencia?: number; energia?: number; sueno?: number; peso?: number; notas?: string }[]
): string {
    return `Eres un coach nutricional experto. Genera un informe semanal personalizado para un cliente.

INSTRUCCIONES:
- Analiza los datos de la última semana del cliente
- Genera un informe MOTIVADOR y CONSTRUCTIVO en español
- El tono debe ser como el de un coach personal: cercano, profesional y alentador
- No seas genérico: referencia datos concretos del cliente
- Responde ÚNICAMENTE con JSON válido, sin explicaciones previas

DATOS DEL CLIENTE:
- Nombre: ${cliente.nombre || 'Cliente'}
- Peso inicial: ${cliente.peso_inicial ? `${cliente.peso_inicial} kg` : 'No registrado'}
- Objetivo: ${cliente.objetivo || 'No especificado'}

EVOLUCIÓN DE PESO (${pesoHistory.length} registros):
${pesoHistory.map(r => `  - ${r.fecha}: ${r.peso} kg`).join('\n')}

${checkins.length > 0 ? `CHECK-INS DE LA SEMANA (${checkins.length} registros):
${checkins.map(c => {
        const det = []
        if (c.peso) det.push(`Peso: ${c.peso} kg`)
        if (c.adherencia) det.push(`Adherencia: ${c.adherencia}/10`)
        if (c.energia) det.push(`Energía: ${c.energia}/10`)
        if (c.sueno) det.push(`Sueño: ${c.sueno}/10`)
        if (c.notas) det.push(`Notas: "${c.notas}"`)
        return `  - ${c.fecha}: ${det.join(' · ')}`
    }).join('\n')}` : 'NO HAY CHECK-INS ESTA SEMANA'}

RESPONDE CON ESTE JSON EXACTO:
{
  "resumen": "Párrafo inicial de 2-3 frases resumiendo la semana del cliente",
  "evolucion_peso": "Análisis de la evolución del peso esta semana",
  "adherencia": "Valoración de la adherencia al plan",
  "energia": "Comentario sobre los niveles de energía reportados",
  "recomendaciones": ["Recomendación 1 concreta", "Recomendación 2 concreta", "Recomendación 3 concreta"],
  "estado_general": "positivo|neutro|atencion"
}`
}

/**
 * Llama a DeepSeek para generar un informe semanal del cliente.
 * Devuelve { data, total_tokens } para poder loguear el consumo.
 */
export async function generarInformeSemanalIA(prompt: string): Promise<{ data: InformeSemanal; total_tokens: number }> {
    const apiKey = process.env.DEEPSEEK_API_KEY

    if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY no configurada. Añádela en .env.local')
    }

    const messages: DeepSeekMessage[] = [
        { role: 'system', content: 'Eres un coach nutricional experto en informes semanales. Respondes siempre en español, solo con JSON válido.' },
        { role: 'user', content: prompt },
    ]

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            temperature: 0.5,
            max_tokens: 2000,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
    }

    const data: DeepSeekResponse = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
        throw new Error('DeepSeek: respuesta vacía')
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        throw new Error(`DeepSeek: respuesta no contiene JSON. Contenido: ${content.slice(0, 300)}`)
    }

    try {
        const parsed: InformeSemanal = JSON.parse(jsonMatch[0])
        if (!parsed.resumen || !parsed.recomendaciones || !parsed.estado_general) {
            throw new Error('DeepSeek: JSON incompleto, faltan campos requeridos')
        }
        return { data: parsed, total_tokens: data.usage.total_tokens }
    } catch (parseError) {
        throw new Error(`DeepSeek: error al parsear JSON: ${parseError instanceof Error ? parseError.message : 'error desconocido'}`)
    }
}

// ── Ajuste Automático de Macros por IA ──────────────────────────────────────

export interface SugerenciaMacros {
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
    razonamiento: string
}

/**
 * Construye el prompt para que DeepSeek analice la evolución del cliente
 * y sugiera nuevos macros objetivo.
 */
export function construirPromptAjusteMacros(
    cliente: {
        nombre?: string
        peso_inicial?: number
        altura?: number
        edad?: number
        sexo?: string
        objetivo?: string
    },
    planActual: {
        nombre?: string
        kcal_objetivo?: number
        proteinas_objetivo?: number
        carbohidratos_objetivo?: number
        grasas_objetivo?: number
    },
    pesoHistory: { fecha: string; peso: number }[],
    checkins: { adherencia?: number; energia?: number }[]
): string {
    return `Eres un coach nutricional experto en ajuste de macros.

INSTRUCCIONES:
- Analiza la evolución del cliente y su plan actual
- Sugiere NUEVOS macros objetivo (kcal, proteínas, carbohidratos, grasas)
- Responde ÚNICAMENTE con JSON válido, sin explicaciones previas
- Si el cliente pierde peso muy rápido (>1kg/semana), sugiere aumentar kcal ligeramente
- Si no pierde peso suficiente (<0.3kg/semana) y su objetivo es perder grasa, reduce kcal -200
- Si gana peso y su objetivo es ganar músculo, valora si el ritmo es adecuado (0.2-0.5kg/semana)
- Ten en cuenta la adherencia: si es baja (<6), prioriza ajustes que faciliten el cumplimiento
- Ajusta proteínas según objetivo (2.2g/kg para ganar músculo, 2.0g/kg para otros)
- Las grasas no deben bajar de 0.8g/kg peso actual
- Los carbohidratos son el macro de ajuste principal

DATOS DEL CLIENTE:
- Nombre: ${cliente.nombre || 'No especificado'}
- Peso inicial: ${cliente.peso_inicial ? `${cliente.peso_inicial} kg` : 'No registrado'}
- Altura: ${cliente.altura ? `${cliente.altura} cm` : 'No registrada'}
- Edad: ${cliente.edad ? `${cliente.edad} años` : 'No registrada'}
- Sexo: ${cliente.sexo || 'No especificado'}
- Objetivo: ${cliente.objetivo || 'No especificado'}

PLAN ACTUAL:
${planActual.nombre ? `- Nombre del plan: ${planActual.nombre}` : ''}
- Kcal: ${planActual.kcal_objetivo || 'No definido'}
- Proteínas: ${planActual.proteinas_objetivo || 'No definido'}g
- Carbohidratos: ${planActual.carbohidratos_objetivo || 'No definido'}g
- Grasas: ${planActual.grasas_objetivo || 'No definido'}g

EVOLUCIÓN DE PESO (${pesoHistory.length} registros):
${pesoHistory.map(r => `  - ${r.fecha}: ${r.peso} kg`).join('\n')}

${checkins.length > 0 ? `MÉTRICAS DE CHECK-INS (${checkins.length} registros):
- Adherencia media: ${(checkins.reduce((s, c) => s + (c.adherencia || 0), 0) / checkins.length).toFixed(1)}/10
- Energía media: ${(checkins.reduce((s, c) => s + (c.energia || 0), 0) / checkins.length).toFixed(1)}/10` : ''}

RESPONDE CON ESTE JSON EXACTO:
{
  "kcal": numero_entero,
  "proteinas": numero_entero,
  "carbohidratos": numero_entero,
  "grasas": numero_entero,
  "razonamiento": "Explicación breve de los ajustes sugeridos"
}`
}

/**
 * Llama a DeepSeek para recalcular macros objetivo basados en la evolución del cliente.
 * Devuelve { data, total_tokens } para poder loguear el consumo.
 */
export async function recalcularMacrosIA(prompt: string): Promise<{ data: SugerenciaMacros; total_tokens: number }> {
    const apiKey = process.env.DEEPSEEK_API_KEY

    if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY no configurada. Añádela en .env.local')
    }

    const messages: DeepSeekMessage[] = [
        { role: 'system', content: 'Eres un coach nutricional experto en ajuste de macronutrientes. Respondes siempre en español, solo con JSON válido.' },
        { role: 'user', content: prompt },
    ]

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            temperature: 0.3,
            max_tokens: 1500,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
    }

    const data: DeepSeekResponse = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
        throw new Error('DeepSeek: respuesta vacía')
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        throw new Error(`DeepSeek: respuesta no contiene JSON. Contenido: ${content.slice(0, 300)}`)
    }

    try {
        const parsed: SugerenciaMacros = JSON.parse(jsonMatch[0])
        if (!parsed.kcal || !parsed.proteinas || !parsed.carbohidratos || !parsed.grasas) {
            throw new Error('DeepSeek: JSON incompleto, faltan campos requeridos')
        }
        return { data: parsed, total_tokens: data.usage.total_tokens }
    } catch (parseError) {
        throw new Error(`DeepSeek: error al parsear JSON: ${parseError instanceof Error ? parseError.message : 'error desconocido'}`)
    }
}

// ── Refinamiento de Recetas con IA ────────────────────────────────────────────

export interface IngredienteRefinado {
    nombre_original: string
    nombre_limpio: string       // Normalizado al español, singular
    cantidad_gramos: number     // Convertido a gramos
    /** Si el alimento no existe en DB, DeepSeek estima sus macros/100g */
    macros_100g?: {
        kcal: number
        proteinas: number
        carbohidratos: number
        grasas: number
        fibra?: number
    }
}

export interface RecetaRefinada {
    nombre: string
    descripcion: string
    instrucciones: string       // Pasos numerados separados por \n
    imagen_url: string | null
    porciones: number
    tiempo_prep_min: number | null
    tiempo_coccion_min: number | null
    ingredientes: IngredienteRefinado[]
    macros_por_porcion: {
        kcal: number
        proteinas: number
        carbohidratos: number
        grasas: number
        fibra?: number
    }
}

/**
 * Refina el texto crudo de una receta scrapeada (Instagram, TikTok, blog)
 * usando DeepSeek. Limpia, traduce, convierte medidas, extrae ingredientes
 * y calcula macros.
 *
 * @param textoCrudo - Texto extraído de la página (meta description o body text)
 * @param urlOrigen  - URL original de la receta
 * @returns RecetaRefinada con datos limpios y estructurados
 */
export async function refinarRecetaConIA(
    textoCrudo: string,
    urlOrigen: string
): Promise<{ data: RecetaRefinada; total_tokens: number }> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const systemPrompt = `Eres un nutricionista y chef experto. Tu trabajo es transformar texto crudo de recetas de redes sociales (Instagram, TikTok) o blogs en una receta profesional, limpia y estructurada.

NORMAS ESTRICTAS:
1. LIMPIEZA: Elimina absolutamente TODO el contenido social: hashtags (#comida #healthy), @menciones, emojis (🔥🍗✅), contadores de likes, comentarios, "ver más", "seguir", "audio original", enlaces, texto de cookies, selector de idiomas (Afrikaans, العربية, Čeština...), texto de pie de página.
2. IDIOMA: Traduce todo a español. Los ingredientes en inglés deben traducirse a su nombre común en España (ej: "chicken thighs" → "contramuslo de pollo", "shredded cabbage" → "col rallada", "light mayo" → "mayonesa light").
3. MEDIDAS: Convierte todas las medidas al sistema métrico (gramos/ml):
   - 1 tsp (cucharadita) = 5g
   - 1 tbsp (cucharada) = 15g
   - 1 cup (taza) = 200g (o 240ml si es líquido)
   - 1 oz = 28g
   - 1 lb (libra) = 453g
   - 1 fl oz = 30ml
   - "to taste" o "al gusto" = 0g (especia/condimento)
4. INSTRUCCIONES: Escribe pasos numerados y detallados en lenguaje culinario profesional. Cada paso debe ser una acción clara.
5. FOTO: Si hay alguna URL de imagen en el texto, inclúyela. Si no, devuelve null.
6. MACROS POR INGREDIENTE: Para cada ingrediente, estima sus macros por 100g basándote en tu conocimiento de bases de datos BEDCA/USDA. Si no tienes certeza, usa valores de referencia estándar.
7. MACROS TOTALES: Calcula los macros totales por porción sumando todos los ingredientes y dividiendo entre el número de porciones.
8. NOMBRE: Asigna un nombre descriptivo y atractivo en español.

RESPONDE ÚNICAMENTE CON UN JSON VÁLIDO. SIN texto adicional, SIN markdown, SOLO el JSON.

{
  "nombre": "Nombre de la receta en español",
  "descripcion": "Descripción profesional y apetitosa",
  "instrucciones": "1. Primer paso...\\n2. Segundo paso...\\n",
  "imagen_url": "https://..." o null,
  "porciones": 4,
  "tiempo_prep_min": 15,
  "tiempo_coccion_min": 30,
  "ingredientes": [
    {
      "nombre_original": "1100g Boneless Skinless Chicken Thighs",
      "nombre_limpio": "Contramuslo de pollo sin piel",
      "cantidad_gramos": 1100,
      "macros_100g": { "kcal": 177, "proteinas": 24.8, "carbohidratos": 0, "grasas": 8.2, "fibra": 0 }
    }
  ],
  "macros_por_porcion": {
    "kcal": 572,
    "proteinas": 52,
    "carbohidratos": 54,
    "grasas": 16,
    "fibra": 2
  }
}`

    const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `TEXTO CRUDO DE LA RECETA:\n\n${textoCrudo}\n\nURL: ${urlOrigen}` },
    ]

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            temperature: 0.2, // Baja temperatura para consistencia/precisión
            max_tokens: 4096,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error ${response.status} al refinar receta: ${errorText}`)
    }

    const data: DeepSeekResponse = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía al refinar receta')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        throw new Error(`DeepSeek: respuesta no contiene JSON válido. Contenido: ${content.slice(0, 500)}`)
    }

    try {
        const parsed: RecetaRefinada = JSON.parse(jsonMatch[0])
        if (!parsed.nombre || !parsed.ingredientes || !parsed.macros_por_porcion) {
            throw new Error('DeepSeek: JSON incompleto en refinamiento de receta')
        }
        return { data: parsed, total_tokens: data.usage.total_tokens }
    } catch (parseError) {
        throw new Error(`DeepSeek: error al parsear receta refinada: ${parseError instanceof Error ? parseError.message : 'error desconocido'}`)
    }
}

/**
 * Cuando un alimento no existe en DB, DeepSeek proporciona sus macros.
 * Esta función llama a DeepSeek para obtener macros/100g de un alimento
 * por su nombre, usando datos BEDCA/USDA como referencia.
 */
export async function completarAlimentoConIA(
    nombreAlimento: string
): Promise<{
    data: {
        kcal: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number;
        // Vitaminas
        vitamina_a_ug?: number; vitamina_c_mg?: number; vitamina_d_ug?: number;
        vitamina_e_mg?: number; vitamina_k_ug?: number; vitamina_b6_mg?: number;
        vitamina_b12_ug?: number; tiamina_mg?: number; riboflavina_mg?: number;
        niacina_mg?: number; folato_ug?: number;
        // Minerales
        calcio_mg?: number; hierro_mg?: number; magnesio_mg?: number; fosforo_mg?: number;
        potasio_mg?: number; sodio_mg?: number; zinc_mg?: number; cobre_mg?: number;
        selenio_ug?: number;
        // Perfil lipídico
        saturados_g?: number; monoinsaturados_g?: number; poliinsaturados_g?: number;
        colesterol_mg?: number;
    }; total_tokens: number
}> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const messages: DeepSeekMessage[] = [
        {
            role: 'system',
            content: `Eres un nutricionista experto en composición de alimentos.
Dados nombres de alimentos, devuelves sus valores nutricionales por 100g basados en BEDCA (Base de Datos Española) y USDA.
Debes ser preciso. Si no conoces el valor exacto, da la estimación más cercana.

RESPONDE SOLO CON JSON (sin markdown, sin explicaciones), TODOS los campos incluidos:
{
  "kcal": 0,
  "proteinas": 0,
  "carbohidratos": 0,
  "grasas": 0,
  "fibra": 0,
  "vitamina_a_ug": 0,
  "vitamina_c_mg": 0,
  "vitamina_d_ug": 0,
  "vitamina_e_mg": 0,
  "vitamina_k_ug": 0,
  "vitamina_b6_mg": 0,
  "vitamina_b12_ug": 0,
  "tiamina_mg": 0,
  "riboflavina_mg": 0,
  "niacina_mg": 0,
  "folato_ug": 0,
  "calcio_mg": 0,
  "hierro_mg": 0,
  "magnesio_mg": 0,
  "fosforo_mg": 0,
  "potasio_mg": 0,
  "sodio_mg": 0,
  "zinc_mg": 0,
  "cobre_mg": 0,
  "selenio_ug": 0,
  "saturados_g": 0,
  "monoinsaturados_g": 0,
  "poliinsaturados_g": 0,
  "colesterol_mg": 0
}`
        },
        { role: 'user', content: `Valores nutricionales por 100g para: "${nombreAlimento}"` }
    ]

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, temperature: 0.1, max_tokens: 800 }),
    })

    if (!response.ok) throw new Error(`DeepSeek API error ${response.status} al consultar alimento`)
    const data: DeepSeekResponse = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('DeepSeek: respuesta no contiene JSON')

    const parsed = JSON.parse(jsonMatch[0])
    return { data: parsed, total_tokens: data.usage.total_tokens }
}
