// ================================================================
// MOTOR DE INTELIGENCIA CLÍNICA
//
// Genera un informe de caso clínico estructurado por cliente que:
//  1. Detecta 15 flags clínicos con lógica determinista
//  2. Cross-referencia la KB con el perfil completo del cliente
//  3. Sintetiza razonamiento clínico vía DeepSeek
//  4. Produce `instrucciones_ia` listo para inyectar en TODOS los prompts
//
// El informe se regenera automáticamente cuando:
//  - Hay 4+ checkins nuevos desde la última generación
//  - El plan activo cambia
//  - Se fuerza desde la API
//
// Coste: ~$0.003 por cliente/regeneración (DeepSeek V3)
// ================================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '@/lib/knowledge-base'

// ── Tipos ──────────────────────────────────────────────────────

export type SeveridadFlag = 'critico' | 'alto' | 'medio' | 'bajo'

export interface FlagClinico {
  codigo: string
  severidad: SeveridadFlag
  titulo: string
  evidencia: string[]        // Data points that triggered this flag
  implicacion: string        // Clinical meaning
  accion: string             // Specific action for the AI
  papers_clave: string[]     // Paper references from KB
}

export interface ProtocoloClinico {
  nombre: string
  categoria: 'nutricion' | 'entrenamiento' | 'recuperacion' | 'suplementacion'
  fuente: string             // "Morton et al. 2018, BJSM"
  aplicacion: string         // How it applies to THIS specific client
}

export interface ParametrosObjetivo {
  kcal_minimo_absoluto: number
  proteina_g_kg_minimo: number
  proteina_g_kg_optimo: number
  cho_g_kg_entreno: number | null
  cho_g_kg_descanso: number | null
  frecuencia_ingestas: number
  prioridades_timing: string[]
  suplementacion_prioritaria: string[]
  restricciones_absolutas: string[]   // What NOT to do with this client
}

export interface InformeCasoClinico {
  id?: string
  cliente_id: string
  version: number
  generado_at: string
  checkins_analizados: number
  semanas_seguimiento: number

  // Datos de base calculados
  datos_base: {
    peso_inicial: number | null
    peso_actual: number | null
    variacion_peso_total: number | null
    variacion_peso_4s: number | null
    adherencia_media_total: number
    adherencia_media_4s: number
    energia_media: number
    sueno_medio: number
    dias_entrenamiento_semana: number | null
    kcal_plan_actual: number | null
    proteina_plan_g_kg: number | null
  }

  flags_activos: FlagClinico[]
  protocolos_aplicados: ProtocoloClinico[]
  parametros_objetivo: ParametrosObjetivo
  narrativa_clinica: string
  instrucciones_ia: string    // Compact string injected into every AI prompt
}

// ── Contexto extendido del cliente ────────────────────────────

interface ClienteCompleto {
  id: string
  nombre: string | null
  apellidos: string | null
  objetivo: string | null
  peso_inicial: number | null
  altura: number | null
  edad: number | null
  sexo: string | null
  condiciones_salud: string | null
  restricciones_alimentarias: string | null
  tipo_entreno: string | null
}

interface CheckinCompleto {
  id: string
  fecha: string
  peso: number | null
  adherencia: number | null
  energia: number | null
  sueno: number | null
  notas: string | null
}

interface PlanActivo {
  id: string
  kcal_objetivo: number
  proteinas_objetivo: number
  carbohidratos_objetivo: number
  grasas_objetivo: number
}

interface PerfilEntreno {
  sport_modality: string | null
  dias_disponibles: number | null
  nivel_condicion: string | null
  patron_lesiones: unknown[] | null
  objetivo_especifico: string | null
}

interface ContextoCompleto {
  cliente: ClienteCompleto
  plan_activo: PlanActivo | null
  checkins: CheckinCompleto[]
  perfil_entreno: PerfilEntreno | null
  perfil_aprendizaje: {
    adherencia_media: number
    riesgo_abandono: number
    semanas_sin_mejora: number
    peso_tendencia: string
    mejor_dia_semana: string | null
    peor_dia_semana: string | null
  } | null
}

// ── Carga de contexto extendido ───────────────────────────────

async function cargarContextoCompleto(clienteId: string): Promise<ContextoCompleto | null> {
  const db = createServiceSupabase()

  const { data: clienteRaw } = await db
    .from('clientes')
    .select(`
      id, objetivo, peso_inicial, altura, edad, sexo,
      profiles(nombre, apellidos),
      onboarding_perfil_profundo
    `)
    .eq('id', clienteId)
    .single()

  if (!clienteRaw) return null

  const profiles = clienteRaw.profiles as { nombre?: string; apellidos?: string } | null
  const onboarding = (clienteRaw.onboarding_perfil_profundo as Record<string, unknown>) ?? {}

  const cliente: ClienteCompleto = {
    id: clienteRaw.id,
    nombre: profiles?.nombre ?? null,
    apellidos: profiles?.apellidos ?? null,
    objetivo: clienteRaw.objetivo ?? null,
    peso_inicial: clienteRaw.peso_inicial ?? null,
    altura: clienteRaw.altura ?? null,
    edad: clienteRaw.edad ?? null,
    sexo: clienteRaw.sexo ?? null,
    condiciones_salud: (onboarding.condiciones_salud as string) ?? null,
    restricciones_alimentarias: (onboarding.restricciones_alimentarias as string) ?? null,
    tipo_entreno: (onboarding.tipo_entrenamiento as string) ?? null,
  }

  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Todos los checkins — para tendencia real, no solo los últimos 8
  const { data: checkins } = await db
    .from('checkins')
    .select('id, fecha, peso, adherencia, energia, sueno, notas')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .limit(52) // máx 1 año de histórico

  const { data: perfilEntreno } = await db
    .from('perfil_entreno_cliente')
    .select('sport_modality, dias_disponibles, nivel_condicion, patron_lesiones, objetivo_especifico')
    .eq('cliente_id', clienteId)
    .single()

  const { data: perfilAprendizaje } = await db
    .from('cliente_perfil_aprendizaje')
    .select('adherencia_media, riesgo_abandono, semanas_sin_mejora, peso_tendencia, mejor_dia_semana, peor_dia_semana')
    .eq('cliente_id', clienteId)
    .single()

  return {
    cliente,
    plan_activo: plan ?? null,
    checkins: (checkins as CheckinCompleto[]) ?? [],
    perfil_entreno: (perfilEntreno as PerfilEntreno) ?? null,
    perfil_aprendizaje: perfilAprendizaje ?? null,
  }
}

// ── Cálculo de datos base ─────────────────────────────────────

function calcularDatosBase(ctx: ContextoCompleto): InformeCasoClinico['datos_base'] {
  const checkins = ctx.checkins
  const pesoActual = checkins[0]?.peso ?? null
  const pesoInicial = ctx.cliente.peso_inicial ?? checkins[checkins.length - 1]?.peso ?? null

  const checkins4s = checkins.slice(0, 8) // ~4 semanas si checkin semanal
  const peso4sAtras = checkins4s[checkins4s.length - 1]?.peso ?? null

  const calcMedia = (arr: CheckinCompleto[], campo: keyof CheckinCompleto) => {
    const vals = arr.map(c => c[campo] as number | null).filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

  const proteina_g_kg =
    ctx.plan_activo && ctx.cliente.peso_inicial
      ? ctx.plan_activo.proteinas_objetivo / ctx.cliente.peso_inicial
      : null

  return {
    peso_inicial: pesoInicial,
    peso_actual: pesoActual,
    variacion_peso_total:
      pesoActual !== null && pesoInicial !== null ? pesoActual - pesoInicial : null,
    variacion_peso_4s:
      pesoActual !== null && peso4sAtras !== null ? pesoActual - peso4sAtras : null,
    adherencia_media_total: calcMedia(checkins, 'adherencia'),
    adherencia_media_4s: calcMedia(checkins4s, 'adherencia'),
    energia_media: calcMedia(checkins4s, 'energia'),
    sueno_medio: calcMedia(checkins4s, 'sueno'),
    dias_entrenamiento_semana: ctx.perfil_entreno?.dias_disponibles ?? null,
    kcal_plan_actual: ctx.plan_activo?.kcal_objetivo ?? null,
    proteina_plan_g_kg: proteina_g_kg,
  }
}

// ── Detección de flags clínicos (15 flags) ────────────────────

function detectarFlags(ctx: ContextoCompleto, datos: InformeCasoClinico['datos_base']): FlagClinico[] {
  const flags: FlagClinico[] = []
  const checkins = ctx.checkins
  const checkins4s = checkins.slice(0, 8)
  const peso = ctx.cliente.peso_inicial ?? 65

  // ─ 1. RED-S (Relative Energy Deficiency in Sport) ─────────
  // Mountjoy et al. 2023 — IOC Consensus Statement
  if (
    ctx.cliente.sexo === 'mujer' &&
    ctx.plan_activo &&
    ctx.plan_activo.kcal_objetivo / peso < 30
  ) {
    flags.push({
      codigo: 'RED_S_RIESGO',
      severidad: 'critico',
      titulo: 'Riesgo de Deficiencia Energética Relativa (RED-S)',
      evidencia: [
        `Disponibilidad energética estimada: ${(ctx.plan_activo.kcal_objetivo / peso).toFixed(1)} kcal/kg`,
        `Umbral clínico: <30 kcal/kg (Mountjoy 2023)`,
        `Sexo femenino → mayor vulnerabilidad hormonal y ósea`,
      ],
      implicacion:
        'Riesgo de supresión hormonal, pérdida de densidad ósea, fatiga crónica y disfunción inmune. Prevalente en atletas femeninas con alta carga de entrenamiento.',
      accion:
        'NUNCA bajar de 30 kcal/kg. Si objetivo es pérdida de peso: déficit máx 300 kcal/día. Priorizar hierro, calcio, vitamina D. Screening hormonal si lleva >4 semanas en déficit.',
      papers_clave: ['Mountjoy 2023 IOC', 'Loucks 2004 EJSM', 'Nattiv 2007 MSSE'],
    })
  }

  // ─ 2. Plateau real (adherencia alta + sin progreso) ────────
  // Trexler et al. 2014 — Metabolic adaptation to weight loss
  if (checkins4s.length >= 6 && datos.variacion_peso_4s !== null && datos.adherencia_media_4s > 65) {
    const esPlateau =
      ctx.cliente.objetivo?.includes('perder') &&
      Math.abs(datos.variacion_peso_4s) < 0.4
    if (esPlateau) {
      flags.push({
        codigo: 'PLATEAU_REAL',
        severidad: 'alto',
        titulo: 'Plateau metabólico con buena adherencia',
        evidencia: [
          `Variación de peso en 4 semanas: ${datos.variacion_peso_4s.toFixed(2)} kg`,
          `Adherencia media: ${datos.adherencia_media_4s.toFixed(0)}%`,
          `Objetivo: pérdida de peso`,
        ],
        implicacion:
          'Adaptación metabólica documentada (Trexler 2014): reducción del NEAT y termogénesis adaptativa. Reducir más calorías sería contraproducente — activa más la adaptación.',
        accion:
          'Aplicar protocolo diet break (Peos 2019): 2 semanas en mantenimiento, luego reanudar déficit. Alternativa: refeed 1-2 días/semana con +300-500 kcal en CHO. No tocar proteína.',
        papers_clave: ['Trexler 2014 JISSN', 'Peos 2019 IJSNEM', 'Martínez 2020 Nutrients'],
      })
    }
  }

  // ─ 3. Pérdida de peso excesivamente rápida ─────────────────
  // Helms 2014 — pérdida >0.7 kg/semana = riesgo muscular
  if (
    datos.variacion_peso_4s !== null &&
    datos.variacion_peso_4s < -1.5 &&
    checkins4s.length >= 4
  ) {
    const semanas = Math.ceil(checkins4s.length / 2)
    const kg_por_semana = Math.abs(datos.variacion_peso_4s) / semanas
    flags.push({
      codigo: 'PERDIDA_RAPIDA',
      severidad: kg_por_semana > 1.0 ? 'critico' : 'alto',
      titulo: 'Pérdida de peso excesivamente rápida',
      evidencia: [
        `Pérdida: ${Math.abs(datos.variacion_peso_4s).toFixed(1)} kg en ~${semanas} semanas`,
        `Tasa: ${kg_por_semana.toFixed(2)} kg/semana (máx. recomendado: 0.5-0.7 kg/semana)`,
      ],
      implicacion:
        'Por encima de 0.7 kg/semana se compromete masa muscular (Helms 2014). Aumentar proteína y reducir déficit.',
      accion:
        'Reducir déficit al máximo 500 kcal/día. Aumentar proteína a mínimo 2.2 g/kg. Revisar si el cliente está reportando adherencia correctamente.',
      papers_clave: ['Helms 2014 IJSNEM', 'Moon 2020 JISSN'],
    })
  }

  // ─ 4. Déficit sueño crónico ────────────────────────────────
  // Dattilo 2011 — sueño y catabolismo muscular
  if (datos.sueno_medio > 0 && datos.sueno_medio < 6.5 && checkins4s.length >= 4) {
    flags.push({
      codigo: 'DEFICIT_SUENO_CRONICO',
      severidad: datos.sueno_medio < 5.5 ? 'critico' : 'alto',
      titulo: 'Déficit de sueño crónico',
      evidencia: [
        `Media sueño últimas 4 semanas: ${datos.sueno_medio.toFixed(1)} horas`,
        `Umbral clínico: <6.5 horas (Dattilo 2011)`,
      ],
      implicacion:
        'Sueño <7h aumenta cortisol, reduce GH e IGF-1, eleva grelina +15% (Spiegel 2004). Catabolismo muscular aumentado y reducción de adherencia dietética. Objetivo de composición corporal comprometido.',
      accion:
        'Aumentar proteína a 2.2+ g/kg (protección muscular). Considerar casein protein antes de dormir (Res 2012). No aumentar déficit calórico mientras persista. Incluir CHO complejo en última comida (efecto triptófano→serotonina).',
      papers_clave: ['Dattilo 2011 Med Hyp', 'Spiegel 2004 Sleep', 'Res 2012 Med Sci Sports'],
    })
  }

  // ─ 5. Energía baja crónica ────────────────────────────────
  if (datos.energia_media > 0 && datos.energia_media < 5 && checkins4s.length >= 4) {
    flags.push({
      codigo: 'ENERGIA_BAJA_CRONICA',
      severidad: datos.energia_media < 4 ? 'alto' : 'medio',
      titulo: 'Energía percibida crónicamente baja',
      evidencia: [
        `Media energía últimas 4 semanas: ${datos.energia_media.toFixed(1)}/10`,
        `Umbral de alerta: <5/10 de forma sostenida`,
      ],
      implicacion:
        'Energía baja persistente puede indicar: hipocalórico real, timing nutricional inadecuado, déficit de CHO peri-entrenamiento, o inicio de sobreentrenamiento.',
      accion:
        'Revisar CHO antes/durante/después del entrenamiento. Si energía baja coincide con días de entrenamiento: priorizar CHO esa mañana. Si es general: subir kcal 150-200 y evaluar.',
      papers_clave: ['Burke 2011 JSSM', 'Jeukendrup 2014 Sports Med'],
    })
  }

  // ─ 6. Riesgo abandono alto ────────────────────────────────
  if (ctx.perfil_aprendizaje && ctx.perfil_aprendizaje.riesgo_abandono > 0.65) {
    flags.push({
      codigo: 'RIESGO_ABANDONO_ALTO',
      severidad: ctx.perfil_aprendizaje.riesgo_abandono > 0.80 ? 'critico' : 'alto',
      titulo: 'Riesgo de abandono elevado',
      evidencia: [
        `Score riesgo abandono: ${(ctx.perfil_aprendizaje.riesgo_abandono * 100).toFixed(0)}%`,
        `Semanas sin mejora percibida: ${ctx.perfil_aprendizaje.semanas_sin_mejora}`,
      ],
      implicacion:
        'Tipping point de abandono en intervenciones de cambio de hábitos: semanas 4-8 y 12-16. Sin señal de progreso visible, la adherencia colapsa (Teixeira 2015).',
      accion:
        'Simplificar plan al mínimo viable. Priorizar win rápido visible (hidratación, energía, báscula). Mensaje motivacional con dato concreto de progreso. No añadir restricciones.',
      papers_clave: ['Teixeira 2015 Int J Behav Nutr', 'Ryan 2009 Int J Obes'],
    })
  }

  // ─ 7. Adherencia estructuralmente baja ────────────────────
  if (datos.adherencia_media_4s > 0 && datos.adherencia_media_4s < 55) {
    flags.push({
      codigo: 'ADHERENCIA_BAJA',
      severidad: datos.adherencia_media_4s < 40 ? 'alto' : 'medio',
      titulo: 'Adherencia estructuralmente baja',
      evidencia: [
        `Adherencia media 4 semanas: ${datos.adherencia_media_4s.toFixed(0)}%`,
        `Umbral funcional: >60% para resultados significativos`,
      ],
      implicacion:
        'No tiene sentido ajustar macros si el problema es de adherencia, no de plan. Ajustar kcal con <55% adherencia es contraproducente.',
      accion:
        'NO ajustar macros hacia abajo. Identificar barreras: ¿qué días falla? (ver peor_dia_semana). Simplificar: menos comidas, más flexibilidad. El plan ideal es el que se sigue.',
      papers_clave: ['Alhassan 2008 Int J Obes', 'Gardner 2018 JAMA'],
    })
  }

  // ─ 8. Deficiencia proteica para el objetivo ───────────────
  // Morton 2018 — 1.6 g/kg mínimo para síntesis proteica
  const objetivoRequiereProteina =
    ctx.cliente.objetivo?.includes('musculo') ||
    ctx.cliente.objetivo?.includes('fuerza') ||
    ctx.cliente.objetivo?.includes('rendimiento')

  if (
    datos.proteina_plan_g_kg !== null &&
    datos.proteina_plan_g_kg < 1.6 &&
    objetivoRequiereProteina
  ) {
    flags.push({
      codigo: 'DEFICIENCIA_PROTEICA',
      severidad: 'alto',
      titulo: 'Ingesta proteica insuficiente para el objetivo',
      evidencia: [
        `Proteína actual: ${datos.proteina_plan_g_kg.toFixed(2)} g/kg`,
        `Mínimo para síntesis muscular óptima: 1.6 g/kg (Morton 2018)`,
        `Objetivo declarado: ${ctx.cliente.objetivo}`,
      ],
      implicacion:
        'Por debajo de 1.6 g/kg se limita la síntesis proteica muscular (MPS) incluso con entrenamiento adecuado. El entrenamiento de fuerza sin proteína suficiente es catabolismo neto.',
      accion:
        'Ajustar proteína a mínimo 1.6 g/kg (mantenimiento/salud), 2.0 g/kg (hipertrofia activa), 2.2-2.4 g/kg (déficit calórico + preservación muscular). Distribuir en 4 ingestas de 30-40g cada una.',
      papers_clave: ['Morton 2018 BJSM', 'Stokes 2018 J Physiol', 'Phillips 2012 J Acad Nutr'],
    })
  }

  // ─ 9. Pérdida muscular en déficit ─────────────────────────
  if (
    datos.variacion_peso_4s !== null &&
    datos.variacion_peso_4s < -1.0 &&
    datos.proteina_plan_g_kg !== null &&
    datos.proteina_plan_g_kg < 2.0
  ) {
    flags.push({
      codigo: 'RIESGO_PERDIDA_MUSCULAR',
      severidad: 'alto',
      titulo: 'Riesgo de pérdida muscular en déficit',
      evidencia: [
        `Pérdida de peso rápida (${datos.variacion_peso_4s.toFixed(1)} kg/4 semanas) + proteína sub-óptima (${datos.proteina_plan_g_kg.toFixed(1)} g/kg)`,
        `Con déficit >500 kcal: se necesita mínimo 2.3 g/kg para preservar músculo`,
      ],
      implicacion:
        'Combinación de déficit alto + proteína insuficiente es la causa #1 de pérdida muscular en dietas de pérdida de grasa (Helms 2014, Barakat 2020).',
      accion:
        'Subir proteína a mínimo 2.2 g/kg INMEDIATAMENTE. Si la escala no lo permite por kcal: reducir CHO/grasas para hacer espacio a proteína. Añadir entrenamiento de resistencia si no lo tiene.',
      papers_clave: ['Helms 2014 IJSNEM', 'Barakat 2020 Strength Cond J'],
    })
  }

  // ─ 10. Semanas sin mejora (señal de estancamiento) ────────
  if (ctx.perfil_aprendizaje && ctx.perfil_aprendizaje.semanas_sin_mejora >= 4) {
    flags.push({
      codigo: 'ESTANCAMIENTO_PROLONGADO',
      severidad: ctx.perfil_aprendizaje.semanas_sin_mejora >= 8 ? 'alto' : 'medio',
      titulo: 'Estancamiento prolongado sin mejora',
      evidencia: [
        `${ctx.perfil_aprendizaje.semanas_sin_mejora} semanas sin mejora percibida`,
        `Tendencia peso: ${ctx.perfil_aprendizaje.peso_tendencia}`,
      ],
      implicacion:
        'Más de 6 semanas sin progreso perceptible aumenta exponencialmente el riesgo de abandono. Necesita cambio visible: recomposición, medidas, rendimiento, o simplemente un ajuste que genere momentum.',
      accion:
        'Cambiar métrica de progreso si la báscula está bloqueada. Introducir medidas corporales, fotos, rendimiento en entrenos. Ajustar plan para generar un cambio visible en ≤2 semanas.',
      papers_clave: ['Burke 2011 JSSM', 'Teixeira 2015 Int J Behav Nutr'],
    })
  }

  // ─ 11. Sobreentrenamiento / sobrecarga ────────────────────
  // Meeusen 2013 — ECSS/ACSM consensus
  if (
    datos.sueno_medio > 0 && datos.sueno_medio < 6.5 &&
    datos.energia_media > 0 && datos.energia_media < 5 &&
    datos.adherencia_media_4s > 60 &&  // está intentándolo pero no puede
    checkins4s.length >= 6
  ) {
    flags.push({
      codigo: 'SOBRECARGA_ENTRENAMIENTO',
      severidad: 'alto',
      titulo: 'Patrón compatible con sobrecarga de entrenamiento',
      evidencia: [
        `Sueño <6.5h + energía <5/10 con adherencia >60%`,
        `Cliente está intentando cumplir pero no se recupera`,
      ],
      implicacion:
        'Tríada: sueño reducido + energía baja + alta carga de entrenamiento = síndrome de sobreentrenamiento funcional (Meeusen 2013). El cuerpo no puede recuperarse entre sesiones.',
      accion:
        'Reducir volumen de entrenamiento 20-30% esta semana. Aumentar CHO (glucógeno muscular). Priorizar sueño sobre entrenamiento. No aumentar déficit calórico.',
      papers_clave: ['Meeusen 2013 Med Sci Sports', 'Kreher 2012 Sports Health'],
    })
  }

  // ─ 12. Bajo rendimiento peri-entrenamiento ────────────────
  if (
    ctx.perfil_entreno &&
    ctx.plan_activo &&
    datos.dias_entrenamiento_semana !== null &&
    datos.dias_entrenamiento_semana >= 4
  ) {
    const choPorKg = ctx.plan_activo.carbohidratos_objetivo / peso
    if (choPorKg < 3.0) {
      flags.push({
        codigo: 'CHO_INSUFICIENTE_ATLETA',
        severidad: 'medio',
        titulo: 'Carbohidratos insuficientes para volumen de entrenamiento',
        evidencia: [
          `CHO actual: ${choPorKg.toFixed(1)} g/kg (total diario)`,
          `Con ${datos.dias_entrenamiento_semana} sesiones/semana: necesario ≥3.5 g/kg`,
          `Recomendación ISSN: 3-7 g/kg según intensidad`,
        ],
        implicacion:
          'CHO <3 g/kg con 4+ sesiones semanales = glucógeno muscular comprometido. Rendimiento, recuperación y composición corporal afectados (Burke 2011).',
        accion:
          'Aplicar periodización de CHO: días entrenamiento +1-2 g/kg, días descanso reducir grasas para compensar. No necesariamente subir kcal totales.',
        papers_clave: ['Burke 2011 JSSM', 'Thomas 2016 J Acad Nutr', 'Hearris 2018 Nutrients'],
      })
    }
  }

  // ─ 13. Patrón de caída de adherencia en fin de semana ─────
  if (
    ctx.perfil_aprendizaje?.peor_dia_semana &&
    ['sábado', 'domingo', 'viernes'].includes(ctx.perfil_aprendizaje.peor_dia_semana.toLowerCase())
  ) {
    flags.push({
      codigo: 'CAIDA_FIN_SEMANA',
      severidad: 'bajo',
      titulo: 'Patrón de caída de adherencia en fin de semana',
      evidencia: [
        `Peor día de adherencia: ${ctx.perfil_aprendizaje.peor_dia_semana}`,
        `Patrón social documentado — comidas fuera, eventos sociales`,
      ],
      implicacion:
        'Patrón muy común. La solución no es más restricción el fin de semana sino flexibilidad planificada (Gardner 2018).',
      accion:
        'Añadir comida libre 1 vez/semana (fin de semana). Enseñar a compensar: si cena fuera el sábado, reducir CHO/grasas en almuerzo ese día. El 80/20 sostenido supera al 100/0 que colapsa.',
      papers_clave: ['Gardner 2018 JAMA', 'Alhassan 2008 Int J Obes'],
    })
  }

  // ─ 14. Adaptación metabólica a largo plazo ────────────────
  // >12 semanas de déficit continuo
  if (checkins.length >= 20 && datos.adherencia_media_total > 60) {
    const semanasDeficit = Math.floor(checkins.length / 2)
    if (semanasDeficit >= 12 && datos.variacion_peso_4s !== null && datos.variacion_peso_4s > -0.3) {
      flags.push({
        codigo: 'ADAPTACION_METABOLICA_LARGA',
        severidad: 'medio',
        titulo: 'Adaptación metabólica después de déficit prolongado',
        evidencia: [
          `${semanasDeficit} semanas en déficit con adherencia media: ${datos.adherencia_media_total.toFixed(0)}%`,
          `Progreso reciente (<0.3 kg/4 semanas) a pesar de adherencia histórica sólida`,
        ],
        implicacion:
          'Después de 12+ semanas en déficit, la tasa metabólica basal puede reducirse 10-15% (Rosenbaum 2008). Seguir bajando kcal es un callejón sin salida.',
        accion:
          'Fase de mantenimiento obligatoria: 4-6 semanas en TDEE mantenimiento, luego nuevo ciclo. Introducir HIIT para aumentar EPOC. Revisar masa muscular — puede estar necesitando una fase de construcción.',
        papers_clave: ['Rosenbaum 2008 Obesity', 'Fothergill 2016 Obesity', 'Trexler 2014 JISSN'],
      })
    }
  }

  // ─ 15. Condición de salud especial no abordada ────────────
  const condicionesEspeciales: Record<string, { titulo: string; accion: string; papers: string[] }> = {
    diabet: {
      titulo: 'Diabetes / resistencia a la insulina',
      accion: 'Periodización de CHO obligatoria. Priorizar índice glucémico bajo. Monitorizar respuesta glucémica. No ayuno prolongado sin supervisión médica.',
      papers: ['American Diabetes Assoc 2023', 'Ley 2014 Lancet'],
    },
    hipotiroid: {
      titulo: 'Hipotiroidismo / tiroides',
      accion: 'Déficit calórico máximo 300 kcal (hipotiroidismo reduce TMB). No keto/very low CHO sin supervisión. Asegurar selenio, zinc, yodo.',
      papers: ['Jonklaas 2014 Thyroid', 'Mullur 2014 Physiol Rev'],
    },
    sop: {
      titulo: 'SOP / Síndrome de ovario poliquístico',
      accion: 'CHO bajo/moderado con índice glucémico controlado. Inositol como suplemento (evidencia nivel 1). Déficit moderado <500 kcal. Priorizar pérdida 5-10% del peso inicial.',
      papers: ['Unfer 2012 Gynecol Endocrinol', 'Moran 2011 Hum Reprod'],
    },
    menop: {
      titulo: 'Menopausia / perimenopausia',
      accion: 'Aumentar proteína a 2.0+ g/kg (protección masa muscular con déficit estrogénico). Calcio 1200 mg/día. Vitamina D 2000 UI. Ejercicio de impacto para densidad ósea.',
      papers: ['Tieland 2012 J Am Med Dir', 'Lowe 2010 Menopause'],
    },
  }

  if (ctx.cliente.condiciones_salud) {
    const texto = ctx.cliente.condiciones_salud.toLowerCase()
    for (const [keyword, datos_cond] of Object.entries(condicionesEspeciales)) {
      if (texto.includes(keyword)) {
        flags.push({
          codigo: `CONDICION_${keyword.toUpperCase()}`,
          severidad: 'alto',
          titulo: datos_cond.titulo,
          evidencia: [`Condición declarada en onboarding: "${ctx.cliente.condiciones_salud}"`],
          implicacion: `Condición que modifica protocolos nutricionales estándar.`,
          accion: datos_cond.accion,
          papers_clave: datos_cond.papers,
        })
      }
    }
  }

  return flags
}

// ── Parámetros objetivo basados en evidencia + flags ─────────

function calcularParametrosObjetivo(
  ctx: ContextoCompleto,
  flags: FlagClinico[]
): ParametrosObjetivo {
  const peso = ctx.cliente.peso_inicial ?? 65
  const sexo = ctx.cliente.sexo ?? 'hombre'
  const objetivo = ctx.cliente.objetivo ?? ''
  const esMujer = sexo === 'mujer'
  const codigoFlags = new Set(flags.map(f => f.codigo))

  // Proteína: basada en objetivo + flags
  let proteinaMin = 1.6
  let proteinaOptimo = 2.0

  if (objetivo.includes('musculo') || objetivo.includes('fuerza')) {
    proteinaMin = 1.8; proteinaOptimo = 2.2
  }
  if (objetivo.includes('perder') || objetivo.includes('grasa')) {
    proteinaMin = 2.0; proteinaOptimo = 2.4  // Barakat 2020: déficit necesita más proteína
  }
  if (codigoFlags.has('DEFICIT_SUENO_CRONICO')) {
    proteinaMin = Math.max(proteinaMin, 2.2)  // Catabolismo elevado
  }
  if (codigoFlags.has('RIESGO_PERDIDA_MUSCULAR')) {
    proteinaMin = Math.max(proteinaMin, 2.3)
  }
  if (codigoFlags.has('RED_S_RIESGO')) {
    proteinaMin = Math.max(proteinaMin, 2.0)
  }

  // Kcal mínimo absoluto
  let kcalMin = esMujer ? 1500 : 1700
  if (codigoFlags.has('RED_S_RIESGO')) kcalMin = Math.max(kcalMin, peso * 30)
  if (codigoFlags.has('PLATEAU_REAL') || codigoFlags.has('ADAPTACION_METABOLICA_LARGA')) {
    kcalMin = ctx.plan_activo?.kcal_objetivo ?? kcalMin  // No bajar más
  }

  // CHO para atletas
  const diasEntreno = ctx.perfil_entreno?.dias_disponibles ?? 3
  const esAtleta = diasEntreno >= 4
  const choDias = esAtleta ? 3.5 : 2.5
  const choDescanso = esAtleta ? 2.0 : 1.5

  // Frecuencia ingestas
  let frecIngestas = 4
  if (codigoFlags.has('DEFICIT_SUENO_CRONICO')) frecIngestas = 5  // Cortisol elevado → timing más importante
  if (codigoFlags.has('CHO_INSUFICIENTE_ATLETA')) frecIngestas = 5 // Más oportunidades de fueling

  // Timing
  const prioridadesTiming: string[] = ['Proteína distribuida en 4 ingestas (25-40g cada una)']
  if (esAtleta) prioridadesTiming.push('CHO 1-2h antes del entrenamiento', 'CHO+proteína en los 45 min post-entrenamiento')
  if (codigoFlags.has('DEFICIT_SUENO_CRONICO')) prioridadesTiming.push('Casein protein + CHO complejo en última comida del día')
  if (codigoFlags.has('ENERGIA_BAJA_CRONICA')) prioridadesTiming.push('NO saltarse desayuno — CHO por la mañana para energía')

  // Suplementación
  const suplements: string[] = ['Creatina 5g/día (si objetivo fuerza/musculatura)']
  if (esMujer) suplements.push('Hierro + vitamina C (mujeres activas en déficit)')
  if (esAtleta && diasEntreno >= 5) suplements.push('Vitamina D3 2000 UI + K2')
  if (codigoFlags.has('DEFICIT_SUENO_CRONICO')) suplements.push('Magnesio bisglicinato 300mg antes de dormir')
  if (codigoFlags.has('RED_S_RIESGO')) suplements.push('Calcio 1000-1200 mg/día', 'Vitamina D3 2000-4000 UI')

  // Restricciones absolutas
  const restricciones: string[] = []
  if (codigoFlags.has('RED_S_RIESGO')) {
    restricciones.push(`NO bajar de ${(peso * 30).toFixed(0)} kcal/día`)
    restricciones.push('NO protocolos de ayuno intermitente >16h')
  }
  if (codigoFlags.has('PLATEAU_REAL') || codigoFlags.has('ADAPTACION_METABOLICA_LARGA')) {
    restricciones.push('NO reducir más kcal — aplicar break de dieta primero')
  }
  if (codigoFlags.has('PERDIDA_RAPIDA')) {
    restricciones.push('NO déficit >500 kcal/día')
    restricciones.push('NO reducir proteína bajo ningún concepto')
  }
  if (codigoFlags.has('ADHERENCIA_BAJA')) {
    restricciones.push('NO añadir más restricciones al plan — simplificar')
  }

  return {
    kcal_minimo_absoluto: Math.round(kcalMin),
    proteina_g_kg_minimo: proteinaMin,
    proteina_g_kg_optimo: proteinaOptimo,
    cho_g_kg_entreno: esAtleta ? choDias : null,
    cho_g_kg_descanso: esAtleta ? choDescanso : null,
    frecuencia_ingestas: frecIngestas,
    prioridades_timing: prioridadesTiming,
    suplementacion_prioritaria: suplements,
    restricciones_absolutas: restricciones,
  }
}

// ── Síntesis clínica con IA ────────────────────────────────────

async function sintetizarConIA(
  ctx: ContextoCompleto,
  datos: InformeCasoClinico['datos_base'],
  flags: FlagClinico[],
  params: ParametrosObjetivo,
  evidenciaKB: string
): Promise<{ narrativa: string; instrucciones: string; protocolos: ProtocoloClinico[] }> {
  const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions'
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

  const flagsTexto = flags
    .sort((a, b) => (['critico', 'alto', 'medio', 'bajo'].indexOf(a.severidad)) - (['critico', 'alto', 'medio', 'bajo'].indexOf(b.severidad)))
    .map(f => `[${f.severidad.toUpperCase()}] ${f.titulo}: ${f.implicacion} → ACCIÓN: ${f.accion}`)
    .join('\n')

  const systemPrompt = `Eres un médico deportivo y nutricionista clínico senior con 20 años de experiencia. Tu especialidad es la medicina del deporte de precisión: análisis de casos individuales, identificación de patrones complejos y generación de protocolos personalizados basados en evidencia de alto nivel (ISSN, ACSM, IOC).

Tu tarea es leer el análisis pre-procesado de este cliente y sintetizarlo en:
1. Una narrativa clínica profesional (150-200 palabras) que el coach puede compartir en su informe de progreso
2. Instrucciones operativas compactas para el sistema de IA (se inyectarán en cada prompt de generación de plan)
3. Lista de protocolos clínicos específicos aplicados

FORMATO JSON OBLIGATORIO:
{
  "narrativa_clinica": "párrafo profesional en primera persona del médico...",
  "instrucciones_ia": "texto compacto con formato estructurado para inyectar en prompts IA...",
  "protocolos_aplicados": [
    {
      "nombre": "...",
      "categoria": "nutricion|entrenamiento|recuperacion|suplementacion",
      "fuente": "Autor año, Journal",
      "aplicacion": "cómo aplica específicamente a ESTE cliente..."
    }
  ]
}

Las instrucciones_ia deben tener este formato exacto:
━━━ ANÁLISIS CLÍNICO [NOMBRE CLIENTE] ━━━
FLAGS: [lista de flags con emoji de severidad]
PARÁMETROS OBLIGATORIOS:
- Proteína: Xg/kg (mínimo) / Xg/kg (óptimo)
- Kcal mínimo: X kcal [NUNCA BAJAR DE AQUÍ]
- CHO estrategia: [si aplica]
ACCIONES CLÍNICAS PRIORITARIAS:
1. [acción con paper de respaldo]
2. [acción]
RESTRICCIONES ABSOLUTAS:
- [lo que NO hacer]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

  const userPrompt = `CLIENTE: ${ctx.cliente.nombre ?? 'Sin nombre'} | ${ctx.cliente.sexo ?? '?'} | ${ctx.cliente.edad ?? '?'} años
OBJETIVO: ${ctx.cliente.objetivo ?? 'No especificado'}
CONDICIONES DE SALUD: ${ctx.cliente.condiciones_salud ?? 'Ninguna declarada'}

DATOS BASE:
- Peso inicial: ${datos.peso_inicial ?? '?'} kg → Peso actual: ${datos.peso_actual ?? '?'} kg
- Variación total: ${datos.variacion_peso_total !== null ? datos.variacion_peso_total.toFixed(1) + ' kg' : '?'}
- Variación últimas 4 semanas: ${datos.variacion_peso_4s !== null ? datos.variacion_peso_4s.toFixed(1) + ' kg' : '?'}
- Adherencia media total: ${datos.adherencia_media_total.toFixed(0)}% | Últimas 4 semanas: ${datos.adherencia_media_4s.toFixed(0)}%
- Energía media: ${datos.energia_media.toFixed(1)}/10 | Sueño medio: ${datos.sueno_medio.toFixed(1)} horas
- Plan actual: ${datos.kcal_plan_actual ?? '?'} kcal | Proteína: ${datos.proteina_plan_g_kg?.toFixed(1) ?? '?'} g/kg
- Deporte: ${ctx.perfil_entreno?.sport_modality ?? 'no especificado'} | Días/semana: ${datos.dias_entrenamiento_semana ?? '?'}

FLAGS CLÍNICOS DETECTADOS (${flags.length}):
${flagsTexto || 'Ningún flag de riesgo activo — cliente en progreso normal'}

PARÁMETROS CALCULADOS:
- Proteína mínima: ${params.proteina_g_kg_minimo} g/kg | Óptima: ${params.proteina_g_kg_optimo} g/kg
- Kcal mínimo absoluto: ${params.kcal_minimo_absoluto} kcal
- Frecuencia ingestas recomendada: ${params.frecuencia_ingestas}
${params.restricciones_absolutas.length > 0 ? `RESTRICCIONES ABSOLUTAS:\n${params.restricciones_absolutas.map(r => `- ${r}`).join('\n')}` : ''}

EVIDENCIA CIENTÍFICA APLICABLE (base de conocimiento):
${evidenciaKB}

Genera el informe clínico completo en JSON.`

  const res = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? '{}'

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('[informe-clinico] JSON inválido de DeepSeek')
  }

  return {
    narrativa: String(parsed.narrativa_clinica ?? ''),
    instrucciones: String(parsed.instrucciones_ia ?? ''),
    protocolos: (parsed.protocolos_aplicados as ProtocoloClinico[]) ?? [],
  }
}

// ── Función principal: generar y guardar informe ──────────────

export async function generarInformeCasoClinico(clienteId: string): Promise<InformeCasoClinico | null> {
  const ctx = await cargarContextoCompleto(clienteId)
  if (!ctx) return null

  if (ctx.checkins.length < 2) return null  // Sin datos suficientes

  const datos = calcularDatosBase(ctx)
  const flags = detectarFlags(ctx, datos)
  const params = calcularParametrosObjetivo(ctx, flags)

  // Seleccionar evidencia KB relevante para este cliente
  const dbKB = createServiceSupabase()
  const protocolosKB = await seleccionarProtocolos(dbKB, {
    objetivo: ctx.cliente.objetivo ?? undefined,
    tipo_entreno: ctx.perfil_entreno?.sport_modality ?? ctx.cliente.tipo_entreno ?? undefined,
    condiciones_salud: ctx.cliente.condiciones_salud ?? undefined,
    restricciones_alimentarias: ctx.cliente.restricciones_alimentarias ?? undefined,
    edad: ctx.cliente.edad ?? undefined,
    sexo: (ctx.cliente.sexo as 'hombre' | 'mujer' | 'otro') ?? undefined,
  }, 8)
  const evidenciaKB = formatearEvidenciaParaPrompt(protocolosKB)

  // Síntesis IA
  const { narrativa, instrucciones, protocolos } = await sintetizarConIA(
    ctx, datos, flags, params, evidenciaKB
  )

  const informe: InformeCasoClinico = {
    cliente_id: clienteId,
    version: 1,
    generado_at: new Date().toISOString(),
    checkins_analizados: ctx.checkins.length,
    semanas_seguimiento: Math.floor(ctx.checkins.length / 2),
    datos_base: datos,
    flags_activos: flags,
    protocolos_aplicados: protocolos,
    parametros_objetivo: params,
    narrativa_clinica: narrativa,
    instrucciones_ia: instrucciones,
  }

  // Persistir en Supabase (upsert por cliente_id)
  const db = createServiceSupabase()
  const { data: existing } = await db
    .from('informes_caso_clinico')
    .select('id, version')
    .eq('cliente_id', clienteId)
    .single()

  if (existing) {
    await db
      .from('informes_caso_clinico')
      .update({
        version: existing.version + 1,
        flags_activos: flags,
        protocolos_aplicados: protocolos,
        parametros_objetivo: params,
        narrativa_clinica: narrativa,
        instrucciones_ia: instrucciones,
        datos_base: datos,
        checkins_analizados: ctx.checkins.length,
        updated_at: new Date().toISOString(),
      })
      .eq('cliente_id', clienteId)
    informe.version = existing.version + 1
    informe.id = existing.id
  } else {
    const { data: nuevo } = await db
      .from('informes_caso_clinico')
      .insert({
        cliente_id: clienteId,
        version: 1,
        flags_activos: flags,
        protocolos_aplicados: protocolos,
        parametros_objetivo: params,
        narrativa_clinica: narrativa,
        instrucciones_ia: instrucciones,
        datos_base: datos,
        checkins_analizados: ctx.checkins.length,
      })
      .select('id')
      .single()
    if (nuevo) informe.id = nuevo.id
  }

  return informe
}

// ── Obtener informe vigente (sin regenerar) ───────────────────

export async function obtenerInformeVigente(clienteId: string): Promise<InformeCasoClinico | null> {
  const db = createServiceSupabase()
  const { data } = await db
    .from('informes_caso_clinico')
    .select('*')
    .eq('cliente_id', clienteId)
    .single()

  return (data as InformeCasoClinico) ?? null
}

// ── Verificar si necesita regeneración ───────────────────────

export async function necesitaRegeneracion(clienteId: string): Promise<boolean> {
  const db = createServiceSupabase()

  const { data: informe } = await db
    .from('informes_caso_clinico')
    .select('updated_at, checkins_analizados')
    .eq('cliente_id', clienteId)
    .single()

  if (!informe) return true

  const { count } = await db
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)

  const totalCheckins = count ?? 0
  const nuevosCheckins = totalCheckins - (informe.checkins_analizados ?? 0)

  return nuevosCheckins >= 4  // Regenerar cada 4 checkins nuevos
}
