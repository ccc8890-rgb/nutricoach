/**
 * lib/metodologia-recetario.ts
 *
 * Metodología del coach Carlos Casanova inyectada en TODOS los prompts de IA
 * que generan planes de nutrición, recetas o revisiones.
 *
 * INSTRUCCIONES DE USO:
 *   import { getContextoCoach, getContextoClienteClinico } from '@/lib/metodologia-recetario'
 *
 *   const systemPrompt = `${getContextoCoach()}
 *   [tu prompt específico aquí]`
 */

// ─── FILOSOFÍA BASE ────────────────────────────────────────────────────────

export const FILOSOFIA_COACH = `
COACH: Carlos Casanova Cordero — Dietista Deportivo (Valencia, España)
CERTIFICACIÓN: Dietista-Nutricionista titulado. Especialidad: nutrición deportiva y patologías hormonales.

FILOSOFÍA CORE:
"Comida real, sabrosa y mediterránea adaptada al deportista moderno."
No es dieta restrictiva. Es educación alimentaria progresiva. El plato debe ser:
  1. Atractivo visualmente — si no da ganas de comerse, no llega al cliente
  2. Accesible — ingredientes de cualquier Mercadona o Carrefour
  3. Sostenible — ≤30 min de preparación activa
  4. Científicamente correcto — macros, timing y calidad nutricional validados

ESTILO VISUAL OBLIGATORIO:
- Protagonismo de la proteína visible: filete entero, salmón en trozo, huevo poché visible
- Color: platos con 3+ colores (verde espinacas, rojo tomate, amarillo boniato)
- Textura: elemento crujiente siempre (semillas, frutos secos, granola, tostada)
- Presentación: bowls, wraps apilados, tostadas dobles, tarros overnight, capas visibles
- NUNCA: platos beiges sin textura ni color (arroz blanco + pechuga hervida = prohibido)
`

// ─── INGREDIENTES ESTRELLA ─────────────────────────────────────────────────

export const INGREDIENTES_PREFERIDOS = {
  proteinas: [
    'pechuga de pollo', 'contramuslo de pollo', 'salmón', 'atún en conserva',
    'merluza', 'gambas', 'mejillones', 'huevos', 'claras de huevo',
    'queso fresco batido 0%', 'queso cottage', 'yogur griego 0%', 'skyr',
    'fiambre de pavo', 'jamón cocido', 'requesón',
  ],
  hidratos: [
    'arroz basmati', 'arroz integral', 'pasta integral', 'boniato', 'avena',
    'pan proteico', 'legumbres (lentejas, garbanzos, alubias)', 'quinoa',
    'coliflor (arroz de coliflor para bajo CHO)', 'patata cocida',
  ],
  grasas_buenas: [
    'aguacate', 'AOVE (aceite de oliva virgen extra)', 'nueces', 'almendras',
    'semillas de chía', 'semillas de lino', 'semillas de cáñamo', 'hummus',
    'mantequilla de almendra', 'mantequilla de cacahuete sin azúcar',
    'salmón (doble rol proteína+grasa)', 'tahini',
  ],
  verduras_base: [
    'espinacas', 'rúcula', 'pepino', 'tomate cherry', 'pimiento rojo/verde',
    'calabacín', 'brócoli', 'edamame', 'maíz', 'zanahoria', 'col lombarda',
    'lechuga romana', 'canónigos',
  ],
  saborizantes: [
    'limón (zumo y ralladura)', 'jengibre fresco', 'cúrcuma', 'canela',
    'tahini', 'salsa sriracha', 'salsa de soja baja en sodio', 'miso blanco',
    'mostaza Dijon', 'vinagre de manzana', 'hierbas frescas (albahaca, cilantro, perejil)',
    'ajo en polvo', 'pimentón ahumado', 'comino', 'orégano',
  ],
}

// ─── TARGETS POR OBJETIVO ─────────────────────────────────────────────────

export const TARGETS_MACRO_OBJETIVO = {
  perder_grasa: {
    proteina_g_kg: 2.2,
    deficit_kcal: -400,
    distribucion: '35% proteína / 35% CHO / 30% grasas',
    estrategia: 'Saciedad máxima: proteína alta + fibra + volumen de verduras. CHO ciclados (↑ días entreno, ↓ días descanso).',
  },
  ganar_musculo: {
    proteina_g_kg: 2.0,
    superavit_kcal: 300,
    distribucion: '30% proteína / 45% CHO / 25% grasas',
    estrategia: 'CHO pre/post entreno. Leucina ≥3g por comida. Proteína distribuida en 4 tomas.',
  },
  rendimiento: {
    proteina_g_kg: 1.8,
    kcal: 'mantenimiento +5-15% días competición',
    distribucion: '25% proteína / 55% CHO / 20% grasas',
    estrategia: 'Periodización de CHO según carga de entrenamiento. CHO altos en días de volumen/competición. Peri-workout: CHO rápidos pre + proteína+CHO post.',
  },
  salud_general: {
    proteina_g_kg: 1.4,
    kcal: 'mantenimiento',
    distribucion: '25% proteína / 45% CHO / 30% grasas',
    estrategia: 'Equilibrio. Densidad nutricional alta. Variedad de colores y grupos.',
  },
  recomposicion: {
    proteina_g_kg: 2.4,
    kcal: 'mantenimiento ±50',
    distribucion: '35% proteína / 40% CHO / 25% grasas',
    estrategia: 'Proteína muy alta. CHO timing estricto (pre/post entreno). Déficit los días de descanso.',
  },
}

// ─── TARGETS POR TIPO DE COMIDA ───────────────────────────────────────────

export const TARGETS_POR_COMIDA: Record<string, { proteina_min_g: number; kcal_min: number; kcal_max: number; notas: string }> = {
  Desayuno: { proteina_min_g: 15, kcal_min: 300, kcal_max: 500, notas: 'Incluir proteína + HC lentos. No solo fruta.' },
  Almuerzo: { proteina_min_g: 20, kcal_min: 300, kcal_max: 500, notas: 'Puede ser snack pre-entreno: CHO+proteína.' },
  Comida: { proteina_min_g: 25, kcal_min: 400, kcal_max: 700, notas: 'Comida principal. Verdura + proteína + HC.' },
  Merienda: { proteina_min_g: 12, kcal_min: 150, kcal_max: 350, notas: 'Post-entreno tarde o saciante.' },
  Cena: { proteina_min_g: 25, kcal_min: 350, kcal_max: 600, notas: 'HC reducidos si no hay entreno nocturno. Proteína alta.' },
  Snack: { proteina_min_g: 10, kcal_min: 100, kcal_max: 300, notas: 'Rápido. Alta proteína. Mínimo procesado.' },
}

// ─── PATOLOGÍAS ESPECÍFICAS ────────────────────────────────────────────────

export const PAUTAS_CLINICAS = {
  sop: {
    nombre: 'SOP (Síndrome de Ovario Poliquístico)',
    prioridades: [
      'IG bajo: reducir picos de insulina es la prioridad #1',
      'Omega-3: salmón, sardinas, semillas chía/lino — antiinflamatorio directo',
      'Fibra alta (≥25g/día): verduras + legumbres + avena integral',
      'Eliminar azúcares añadidos y harinas refinadas',
      'Zinc + Vitamina D + Magnesio: huevos, nueces, espinacas',
      'Proteína moderada-alta para saciedad y estabilidad glucémica',
    ],
    evitar: ['azúcar refinado', 'harina blanca', 'lácteos en exceso', 'aceites vegetales omega-6 altos'],
    incluir: ['canela (sensibilización insulina)', 'cúrcuma (antiinflamatorio)', 'brócoli (DIM)', 'lino molido'],
  },
  hashimoto: {
    nombre: 'Hipotiroidismo / Hashimoto',
    prioridades: [
      'Selenio: nueces de Brasil (2/día), atún, huevos',
      'Zinc: carne roja magra, pipas de calabaza, legumbres',
      'Hierro no hemínico con vitamina C: lentejas + pimiento rojo',
      'Evitar bociógenos crudos (col, brócoli crudo) — cocinados OK',
      'Vitamina D: 15-20 min sol + salmón, huevos',
      'Sin gluten estricto no está indicado salvo celiaquía confirmada',
    ],
    evitar: ['soja en exceso (puede interferir con tiroxina)', 'crucíferas crudas en exceso'],
    incluir: ['nuez de Brasil', 'mariscos (yodo)', 'huevos', 'pipas de calabaza'],
  },
  rendimiento_running: {
    nombre: 'Running / Triatlón',
    prioridades: [
      'CHO periodizados: semana de volumen = 5-7g/kg, semana suave = 3-4g/kg',
      'Proteína 1.6-2.0g/kg para reparación muscular',
      'Hierro: prevenir ferropenia (frecuente en runners)',
      'Sodio y electrolitos: especialmente en verano Valencia',
      'Pre-entreno (1-2h antes): CHO fácil digestión + poco grasa/fibra',
      'Post-entreno (30 min): 3:1 CHO:Proteína — máximo window anabólico',
    ],
    timing: 'CHO ALTOS días de rodaje largo/intervalos. CHO MODERADOS días de recuperación activa.',
  },
  rendimiento_gym: {
    nombre: 'Musculación / Gimnasio',
    prioridades: [
      'Leucina ≥3g por comida para máxima síntesis proteica',
      'Proteína distribuida en 4 tomas de ≥25g',
      'Creatina monohidrato 3-5g/día (suplemento respaldado)',
      'CHO post-entreno: reponer glucógeno muscular en las 2h siguientes',
      'Calorías suficientes: no se puede ganar músculo en déficit prolongado',
    ],
    timing: 'Pre-entreno: proteína + CHO moderado (60-90 min antes). Post-entreno: proteína+CHO (30 min después).',
  },
}

// ─── ESTÁNDARES DE CALIDAD VISUAL ─────────────────────────────────────────

export const ESTANDARES_VISUALES = `
FOTOGRAFÍA DE PLATOS — ESTILO FOOD BLOGGER ESPAÑOL:
- Luz natural de ventana, suave y difusa. Nunca flash directo.
- Composición overhead (desde arriba) o 45°, ligeramente imperfecta
- Plato cerámico o bowl artesanal (no plato blanco genérico)
- Mesa de madera clara o mármol como superficie
- Elementos: cubiertos de madera/cerámica, pañito de lino, hierbas frescas
- Tonos cálidos mediterráneos: beige, blanco roto, verde salvia, terracota
- Sin texto superpuesto, sin watermarks, sin manos visibles

NAMING DE RECETAS:
- Evocador y descriptivo: "Bowl de salmón teriyaki con edamame y arroz jazmín"
- No genérico: NUNCA "Salmón con arroz" o "Ensalada de pollo"
- Incluir técnica o salsa especial si la hay: poché, teriyaki, al miso, en ceviche
- Incluir ingrediente visual estrella: "con huevo poché", "con crujiente de almendra"
`

// ─── FUNCIÓN PRINCIPAL: CONTEXTO COACH ────────────────────────────────────

/**
 * Devuelve el contexto base del coach para inyectar en prompts de IA.
 * Usar en todos los system prompts de generación de dietas/recetas.
 */
export function getContextoCoach(options?: {
  incluirIngredientes?: boolean
  incluirVisuales?: boolean
}): string {
  const opts = { incluirIngredientes: true, incluirVisuales: false, ...options }

  let ctx = FILOSOFIA_COACH.trim()

  if (opts.incluirIngredientes) {
    ctx += `\n\nINGREDIENTES ESTRELLA DEL RECETARIO:
Proteínas: ${INGREDIENTES_PREFERIDOS.proteinas.join(', ')}
Hidratos: ${INGREDIENTES_PREFERIDOS.hidratos.join(', ')}
Grasas buenas: ${INGREDIENTES_PREFERIDOS.grasas_buenas.join(', ')}
Saborizantes clave: ${INGREDIENTES_PREFERIDOS.saborizantes.join(', ')}`
  }

  if (opts.incluirVisuales) {
    ctx += `\n\n${ESTANDARES_VISUALES.trim()}`
  }

  return ctx
}

/**
 * Devuelve instrucciones clínicas específicas para un cliente según su perfil.
 * Inyectar en el prompt de generación de plan inicial y revisiones.
 */
export function getContextoClienteClinico(params: {
  objetivo: string
  restricciones?: string[]
  condiciones_salud?: string
  actividad?: string
  peso_kg?: number
  altura_cm?: number
  edad?: number
  sexo?: string
}): string {
  const { objetivo, restricciones = [], condiciones_salud, actividad, peso_kg, altura_cm, edad, sexo } = params

  const parts: string[] = []

  // Targets macro por objetivo
  const targets = TARGETS_MACRO_OBJETIVO[objetivo as keyof typeof TARGETS_MACRO_OBJETIVO]
  if (targets) {
    parts.push(`OBJETIVO ${objetivo.toUpperCase()}:
Proteína objetivo: ${targets.proteina_g_kg}g/kg peso corporal
Distribución: ${targets.distribucion}
Estrategia: ${targets.estrategia}`)
  }

  // Instrucciones clínicas
  const condicion = condiciones_salud?.toLowerCase() ?? ''
  const esRendimiento = actividad && ['running', 'triatlón', 'ciclismo', 'hyrox'].some(d => actividad.toLowerCase().includes(d))

  if (condicion.includes('sop') || restricciones.includes('sop')) {
    const c = PAUTAS_CLINICAS.sop
    parts.push(`PATOLOGÍA: ${c.nombre}
Prioridades nutricionales:
${c.prioridades.map(p => `  • ${p}`).join('\n')}
Incluir especialmente: ${c.incluir.join(', ')}
Evitar: ${c.evitar.join(', ')}`)
  }

  if (condicion.includes('hashimoto') || condicion.includes('hipotiroidismo') || restricciones.includes('hashimoto')) {
    const c = PAUTAS_CLINICAS.hashimoto
    parts.push(`PATOLOGÍA: ${c.nombre}
Prioridades nutricionales:
${c.prioridades.map(p => `  • ${p}`).join('\n')}
Incluir: ${c.incluir.join(', ')}
Precaución: ${c.evitar.join(', ')}`)
  }

  if (esRendimiento) {
    const c = objetivo === 'rendimiento' ? PAUTAS_CLINICAS.rendimiento_running : PAUTAS_CLINICAS.rendimiento_gym
    parts.push(`DEPORTE: ${c.nombre}
Prioridades:
${c.prioridades.map(p => `  • ${p}`).join('\n')}
Timing: ${(c as typeof PAUTAS_CLINICAS.rendimiento_running).timing ?? ''}`)
  }

  return parts.join('\n\n')
}

/**
 * Texto corto (2-3 líneas) de targets por tipo de comida.
 * Inyectar en prompts de generación de dieta para que la IA sepa
 * cuántas kcal y proteína poner en cada comida.
 */
export function getTargetsComidas(): string {
  return Object.entries(TARGETS_POR_COMIDA)
    .map(([tipo, t]) => `${tipo}: ${t.kcal_min}-${t.kcal_max} kcal | ≥${t.proteina_min_g}g proteína | ${t.notas}`)
    .join('\n')
}
