// lib/micro-learning.ts
// Gap #8 — Micro-learning automático: píldoras educativas semanales
// Genera contenido educativo breve y personalizado según perfil del cliente,
// su objetivo, condiciones de salud, flags psicológicos y momento del plan.

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface MicroLearningInput {
  clienteId: string
  semanaPlan: number                // Semana actual del plan (1-based)
  objetivo: string
  condicionesSalud?: string[]
  flagsPsicologicos: {
    confianzaBaja: boolean
    esInflexible: boolean
    tieneAnsiedad: boolean
    duermePoco: boolean
    estresAlto: boolean
  }
  segmento: string                  // standard | recomposicion | performance | elite
  adherencia?: number               // 0-100
  pesoInicial?: number
  pesoActual?: number
  edad: number
  sexo?: string
  sportModality?: string
}

export interface PilloraEducativa {
  id: string
  titulo: string
  contenido: string                // Texto breve (1-2 párrafos, max 300 chars)
  categoria: CategoriaPillora
  momento: 'inicio_plan' | 'semanal' | 'checkin_bajo' | 'checkin_alto' | 'estancamiento' | 'hito'
  tono: 'motivacional' | 'educativo' | 'correctivo' | 'celebratorio'
  emoji: string
}

type CategoriaPillora =
  | 'proteinas_mps'
  | 'hidratacion'
  | 'sueno'
  | 'estres'
  | 'carbohidratos'
  | 'grasas_saludables'
  | 'fibra'
  | 'sodio_hta'
  | 'azucares_diabetes'
  | 'peri_entreno'
  | 'adherencia'
  | 'flexibilidad'
  | 'paciencia'
  | 'expectativas'
  | 'hito_logro'
  | 'sueño_recuperacion'
  | 'alcohol'
  | 'comedor_emocional'

// ── Catálogo de píldoras ────────────────────────────────────────────────────

interface PilloraTemplate {
  categoria: CategoriaPillora
  titulo: string
  obtenerContenido: (input: MicroLearningInput) => string
  condiciones: (input: MicroLearningInput) => boolean
  momento: PilloraEducativa['momento']
  tono: PilloraEducativa['tono']
  emoji: string
}

const PILDORAS: PilloraTemplate[] = [
  // ── Inicio del plan ─────────────────────────────────────────────────────
  {
    categoria: 'expectativas',
    titulo: 'Bienvenido al plan',
    obtenerContenido: (input) => `Este plan está diseñado específicamente para ti. Los resultados no son lineales — habrá semanas de ajuste. Confía en el proceso, registra tus comidas y sobre todo, sé constante. El cambio real ocurre con pequeños hábitos sostenidos.`,
    condiciones: () => true,
    momento: 'inicio_plan',
    tono: 'motivacional',
    emoji: '🎯',
  },
  {
    categoria: 'flexibilidad',
    titulo: 'Flexibilidad > Perfección',
    obtenerContenido: (input) => `No necesitas seguir el plan al 100% para obtener resultados. La evidencia muestra que una adherencia del 70-80% es suficiente para progresar. Si un día te sales, simplemente retoma al siguiente. Un día no arruina una semana.`,
    condiciones: (input) => input.flagsPsicologicos.esInflexible || input.flagsPsicologicos.confianzaBaja,
    momento: 'inicio_plan',
    tono: 'correctivo',
    emoji: '🧘',
  },
  {
    categoria: 'proteinas_mps',
    titulo: 'Proteína: el ladrillo del músculo',
    obtenerContenido: (input) => `Cada comida de tu plan tiene ≥${input.edad >= 50 ? '30' : '20'}g de proteína para activar la síntesis proteica muscular.${input.edad >= 50 ? ' Al ser mayor de 50 años, necesitas más proteína por comida (resistencia anabólica).' : ''} Distribuir la proteína así maximiza tus resultados.`,
    condiciones: () => true,
    momento: 'inicio_plan',
    tono: 'educativo',
    emoji: '🥩',
  },
  // ── Semanal genérico ────────────────────────────────────────────────────
  {
    categoria: 'hidratacion',
    titulo: 'Agua: el nutriente olvidado',
    obtenerContenido: (input) => `La deshidratación del 2% reduce el rendimiento deportivo hasta un 10-15%. Bebe 30-35ml/kg/día (${Math.round((input.pesoInicial ?? 70) * 0.035)}L). Aumenta si hace calor o entrenas más de 60min. Un truco: ten siempre una botella de 1L en tu mesa.`,
    condiciones: () => true,
    momento: 'semanal',
    tono: 'educativo',
    emoji: '💧',
  },
  {
    categoria: 'sueno',
    titulo: 'Dormir es hacer dieta',
    obtenerContenido: (input) => `Dormir <6h aumenta el cortisol un 25% y la grelina (hambre) un 15%. Si duermes mal, tu cuerpo quema menos grasa y más músculo. Prioriza 7-9h de sueño. Apaga pantallas 1h antes y mantén la habitación fresca (18-20°C).`,
    condiciones: (input) => input.flagsPsicologicos.duermePoco,
    momento: 'semanal',
    tono: 'educativo',
    emoji: '😴',
  },
  {
    categoria: 'estres',
    titulo: 'Estrés y comida emocional',
    obtenerContenido: (input) => `El estrés alto activa el eje HPA y aumenta la preferencia por alimentos densos en calorías. No es falta de fuerza de voluntad — es biología. Ante craving agudo: espera 10 minutos, bebe agua, respira profundo 5 veces. El craving suele desaparecer.`,
    condiciones: (input) => input.flagsPsicologicos.estresAlto,
    momento: 'semanal',
    tono: 'educativo',
    emoji: '🌿',
  },
  {
    categoria: 'comedor_emocional',
    titulo: 'Hambre real vs. emocional',
    obtenerContenido: (input) => `El hambre real aparece gradualmente, cualquier comida la satisface, y comes hasta sentirte lleno. El hambre emocional es repentina, busca un alimento específico, y comer no te calma. Cuando sientas hambre impulsiva, pregúntate: "¿Qué necesito realmente ahora?"`,
    condiciones: (input) => input.flagsPsicologicos.tieneAnsiedad,
    momento: 'semanal',
    tono: 'correctivo',
    emoji: '🧠',
  },
  // ── Chek-in bajo ────────────────────────────────────────────────────────
  {
    categoria: 'adherencia',
    titulo: 'Semana difícil — sin culpa',
    obtenerContenido: (input) => `Todas las personas tienen semanas complicadas. Lo importante no es la semana perfecta, sino volver al plan al día siguiente. Revisa qué obstáculos tuviste esta semana y dime cómo puedo ayudarte a superarlos la próxima.`,
    condiciones: (input) => (input.adherencia ?? 100) < 60,
    momento: 'checkin_bajo',
    tono: 'motivacional',
    emoji: '🤝',
  },
  {
    categoria: 'flexibilidad',
    titulo: 'El 80% es suficiente',
    obtenerContenido: (input) => `Si cumples el plan el 80% de las veces, estás progresando. Relájate con el 20% restante. La rigidez es la enemiga de la adherencia a largo plazo. No necesitas ser perfecto, necesitas ser consistente.`,
    condiciones: (input) => (input.adherencia ?? 100) < 70,
    momento: 'checkin_bajo',
    tono: 'correctivo',
    emoji: '🎯',
  },
  // ── Check-in alto ───────────────────────────────────────────────────────
  {
    categoria: 'hito_logro',
    titulo: 'Semana excelente',
    obtenerContenido: (input) => `¡Buena semana! Este nivel de adherencia es el que genera transformaciones reales. Tu consistencia está construyendo hábitos que durarán toda la vida. Sigue así y confía en el proceso.`,
    condiciones: (input) => (input.adherencia ?? 0) >= 90,
    momento: 'checkin_alto',
    tono: 'celebratorio',
    emoji: '🌟',
  },
  // ── Condiciones de salud ────────────────────────────────────────────────
  {
    categoria: 'sodio_hta',
    titulo: 'Sodio y tensión arterial',
    obtenerContenido: (input) => `La dieta DASH reduce la presión arterial en 8-14 mmHg en hipertensos. La clave: <1500mg sodio/día, >3500mg potasio/día. Prioriza alimentos frescos, limita procesados, y usa hierbas en lugar de sal. Cada gramo menos de sal reduce 2.5 mmHg.`,
    condiciones: (input) => (input.condicionesSalud ?? []).some(c => c.toLowerCase().includes('hta') || c.toLowerCase().includes('hipertens')),
    momento: 'semanal',
    tono: 'educativo',
    emoji: '🫀',
  },
  {
    categoria: 'azucares_diabetes',
    titulo: 'Azúcar y glucosa',
    obtenerContenido: (input) => `Para control glucémico: prioriza carbohidratos complejos (índice glucémico bajo), combínalos siempre con proteína y fibra. El orden importa: come verduras primero, luego proteína, y carbohidratos al final — reduce el pico glucémico hasta un 30%.`,
    condiciones: (input) => (input.condicionesSalud ?? []).some(c => c.toLowerCase().includes('diabet') || c.toLowerCase().includes('resistencia')),
    momento: 'semanal',
    tono: 'educativo',
    emoji: '🩸',
  },
  {
    categoria: 'fibra',
    titulo: 'Fibra: tu aliada digestiva',
    obtenerContenido: (input) => `La fibra soluble reduce el LDL (colesterol "malo") 5-15%. Objetivo: 25-35g/día. Fuentes: avena (3g/100g), legumbres (7g/100g), fruta con piel (2-4g/ud). Aumenta la fibra gradualmente para evitar molestias digestivas.`,
    condiciones: (input) => (input.condicionesSalud ?? []).some(c => c.toLowerCase().includes('dislipemia') || c.toLowerCase().includes('colesterol') || c.toLowerCase().includes('higado')),
    momento: 'semanal',
    tono: 'educativo',
    emoji: '🌾',
  },
  // ── Estancamiento ───────────────────────────────────────────────────────
  {
    categoria: 'paciencia',
    titulo: 'La meseta es parte del proceso',
    obtenerContenido: (input) => `Estancamientos de 2-3 semanas son normales. El cuerpo se adapta. Algunas causas: retención de líquidos, aumento de masa muscular, adaptación metabólica. Confía en el déficit y sé constante. Si dura >4 semanas, ajustaremos el plan.`,
    condiciones: () => true,
    momento: 'estancamiento',
    tono: 'motivacional',
    emoji: '⛰️',
  },
  {
    categoria: 'carbohidratos',
    titulo: 'Carbohidratos no son el enemigo',
    obtenerContenido: (input) => `Restringir carbohidratos太久 baja la leptina y el metabolismo. Por eso tu plan incluye días de recarga de carbohidratos (refeed). Los carbohidratos son el combustible principal del cerebro y los músculos. No los temas, adminístralos.`,
    condiciones: (input) => input.objetivo === 'perder_grasa',
    momento: 'estancamiento',
    tono: 'educativo',
    emoji: '🍚',
  },
  // ── Peri-entreno ────────────────────────────────────────────────────────
  {
    categoria: 'peri_entreno',
    titulo: 'Nutrición alrededor del entreno',
    obtenerContenido: (input) => `La ventana anabólica post-entreno es real: consumir proteína (0.3-0.4g/kg) + carbohidratos (0.5-0.8g/kg) dentro de las 2h posteriores optimiza la recuperación y la síntesis proteica.${input.sportModality === 'running' || input.sportModality === 'ciclismo' ? ' En cardio prolongado, la ventana es aún más crítica — prioriza la recuperación.' : ''}`,
    condiciones: (input) => input.segmento === 'performance' || input.segmento === 'elite' || !!input.sportModality,
    momento: 'semanal',
    tono: 'educativo',
    emoji: '⚡',
  },
  // ── Hitos ───────────────────────────────────────────────────────────────
  {
    categoria: 'hito_logro',
    titulo: '¡Siguiente nivel!',
    obtenerContenido: (input) => `Has completado ${input.semanaPlan} semanas. La adherencia consistente es el predictor número 1 de éxito. ¿Sabías que las personas que registran sus comidas pierden 2x más peso? Sigue así, cada check-in es un paso más cerca de tu objetivo.`,
    condiciones: (input) => input.semanaPlan === 4 || input.semanaPlan === 8 || input.semanaPlan === 12,
    momento: 'hito',
    tono: 'celebratorio',
    emoji: '🏆',
  },
  // ── Grasas saludables ───────────────────────────────────────────────────
  {
    categoria: 'grasas_saludables',
    titulo: 'Grasa no engorda (la buena)',
    obtenerContenido: (input) => `Las grasas insaturadas (aceite de oliva virgen extra, aguacate, frutos secos, pescado azul) mejoran el perfil lipídico y reducen inflamación. Objetivo: 2-3 raciones/día. Un puñado de nueces (30g) = 20g grasa insaturada + fibra + omega-3.`,
    condiciones: () => true,
    momento: 'semanal',
    tono: 'educativo',
    emoji: '🥑',
  },
  // ── Alcohol ─────────────────────────────────────────────────────────────
  {
    categoria: 'alcohol',
    titulo: 'Alcohol y progreso',
    obtenerContenido: (input) => `El alcohol aporta 7 kcal/g, prioriza su metabolismo sobre la quema de grasa, reduce la testosterona y empeora la calidad del sueño. Una copa de vino (125ml) = ~110kcal. Si bebes, hazlo con comida y limítalo a 1-2 veces/semana. No mezcles alcohol con comidas altas en grasa.`,
    condiciones: () => true,
    momento: 'semanal',
    tono: 'educativo',
    emoji: '🍷',
  },
]

// ── Selector de píldoras ────────────────────────────────────────────────────

/**
 * Selecciona las píldoras educativas relevantes para el cliente en este momento.
 * Máximo 3 píldoras por llamada para no abrumar.
 */
export function seleccionarPildoras(input: MicroLearningInput, maxPildoras = 3): PilloraEducativa[] {
  const seleccionadas: PilloraEducativa[] = []

  // 1. Píldoras de momento específico
  const candidatas = PILDORAS.filter(p => p.condiciones(input))

  // 2. Ordenar por relevancia
  const prioridad = (p: PilloraTemplate): number => {
    let score = 0
    // Momento específico
    if (p.momento === 'inicio_plan') score += 100
    if (p.momento === 'checkin_bajo') score += 90
    if (p.momento === 'estancamiento') score += 80
    if (p.momento === 'hito') score += 70
    if (p.momento === 'checkin_alto') score += 60
    // Condiciones de salud específicas
    if (p.categoria === 'sodio_hta' || p.categoria === 'azucares_diabetes') score += 50
    if (p.categoria === 'fibra') score += 40
    // Flags psicológicos
    if (p.categoria === 'comedor_emocional' && input.flagsPsicologicos.tieneAnsiedad) score += 35
    if (p.categoria === 'estres' && input.flagsPsicologicos.estresAlto) score += 30
    if (p.categoria === 'sueno' && input.flagsPsicologicos.duermePoco) score += 25
    // Adherencia
    if (p.categoria === 'adherencia') score += (input.adherencia ?? 50) < 50 ? 45 : 10
    // Hitos
    if (p.momento === 'hito') score += input.semanaPlan * 5
    return score
  }

  candidatas.sort((a, b) => prioridad(b) - prioridad(a))

  // 3. Seleccionar sin repetir categoría
  const categoriasUsadas = new Set<CategoriaPillora>()
  for (const p of candidatas) {
    if (seleccionadas.length >= maxPildoras) break
    if (categoriasUsadas.has(p.categoria)) continue
    categoriasUsadas.add(p.categoria)

    seleccionadas.push({
      id: `pill_${p.categoria}_${Date.now()}_${seleccionadas.length}`,
      titulo: p.titulo,
      contenido: p.obtenerContenido(input),
      categoria: p.categoria,
      momento: p.momento,
      tono: p.tono,
      emoji: p.emoji,
    })
  }

  // 4. Fallback: si no hay píldoras seleccionadas, dar la genérica de hidratación
  if (seleccionadas.length === 0) {
    const hidratacion = PILDORAS.find(p => p.categoria === 'hidratacion')
    if (hidratacion) {
      seleccionadas.push({
        id: `pill_hidratacion_${Date.now()}`,
        titulo: hidratacion.titulo,
        contenido: hidratacion.obtenerContenido(input),
        categoria: hidratacion.categoria,
        momento: 'semanal',
        tono: 'educativo',
        emoji: '💧',
      })
    }
  }

  return seleccionadas
}

/**
 * Genera un mensaje corto para incluir en el check-in semanal
 */
export function formatearPildorasParaCheckin(pildoras: PilloraEducativa[]): string {
  if (pildoras.length === 0) return ''
  return pildoras.map(p => `${p.emoji} **${p.titulo}**: ${p.contenido}`).join('\n\n')
}
