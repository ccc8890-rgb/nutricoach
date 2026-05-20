// lib/nutricion-peri-entreno.ts
// Gap #4 — Nutrición peri-entreno sincronizada con motor de entrenamiento
// Genera recomendaciones de pre-entreno, intra-entreno y post-entreno
// basadas en modalidad deportiva, intensidad, duración y horario.

import type { SportModality } from '@/types'

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface PeriEntrenoInput {
  sportModality?: SportModality
  horaEntreno?: string           // ej: "08:00", "18:30"
  duracionMin: number            // duración de la sesión en minutos
  intensidad: 'baja' | 'moderada' | 'alta'
  volumen: 'bajo' | 'medio' | 'alto'
  tier: 'elite' | 'general'
  pesoKg: number
  edad: number
  objetivo: string
  kcalObjetivo: number
  carbosObjetivo: number
  tipoEntreno?: string[]         // del onboarding
}

export interface RecomendacionPeriEntreno {
  pre_entreno: {
    timing: string               // "2h antes", "45min antes"
    recomendacion: string
    macros: { kcal: number; proteinas: number; carbohidratos: number; grasas: number }
    ejemplos: string[]
  }
  intra_entreno?: {
    timing: string               // "durante la sesión"
    recomendacion: string
    hidratacion: string
    cuando: string               // "si >60min", "si <60min"
    electrolitos?: string
  }
  post_entreno: {
    timing: string               // "dentro de 2h"
    ventana_anabolica: string    // "prioritaria" | "flexible" | "crítica"
    recomendacion: string
    macros: { kcal: number; proteinas: number; carbohidratos: number; grasas: number }
    ejemplos: string[]
  }
  alertas: string[]
}

// ── Lógica ──────────────────────────────────────────────────────────────────

export function generarRecomendacionPeriEntreno(input: PeriEntrenoInput): RecomendacionPeriEntreno {
  const alertas: string[] = []
  const isMujer = input.objetivo === 'ganar_musculo' // heuristic: will be refined with actual sex
  const isCardio = ['running', 'ciclismo', 'natacion', 'triatlon', 'hyrox'].includes(input.sportModality ?? '')
  const isFuerza = ['gym_fuerza', 'gym_estetica', 'calistenia'].includes(input.sportModality ?? '')
  const isLargaDuracion = input.duracionMin >= 60
  const isIntensa = input.intensidad === 'alta'
  const necesitaIntra = isLargaDuracion || (isCardio && isIntensa)

  // ── Pre-entreno ─────────────────────────────────────────────────────────
  let preTiming: string
  let preRecomendacion: string
  let preMacros: { kcal: number; proteinas: number; carbohidratos: number; grasas: number }
  let preEjemplos: string[]

  if (input.horaEntreno && parseInt(input.horaEntreno.split(':')[0]) < 9) {
    // Entreno matinal temprano — ayuno parcial o carga rápida
    preTiming = '30-45 min antes (entreno matinal)'
    preRecomendacion = 'Comida ligera pre-entreno: carbohidratos de rápida absorción + proteína moderada. Evitar grasas para no ralentizar digestión.'
    preMacros = {
      kcal: Math.round(input.pesoKg * 2.5),
      proteinas: Math.round(input.pesoKg * 0.2),
      carbohidratos: Math.round(input.pesoKg * 0.4),
      grasas: 3,
    }
    preEjemplos = [
      'Plátano + 30g proteína whey',
      'Tostada fina integral + mermelada sin azúcar + café',
      'Batido: 200ml leche desnatada + 40g avena + 1/2 plátano',
    ]
    alertas.push('Entreno matinal: asegurar carga de carbohidratos nocturna (cena rica en carbos complejos)')
  } else if (isCardio && isLargaDuracion) {
    // Cardio largo — carga significativa
    preTiming = '2-3h antes'
    preRecomendacion = 'Comida completa pre-entreno: carbohidratos complejos + proteína moderada + baja grasa.'
    preMacros = {
      kcal: Math.round(input.pesoKg * 4),
      proteinas: Math.round(input.pesoKg * 0.25),
      carbohidratos: Math.round(input.pesoKg * 0.8),
      grasas: 8,
    }
    preEjemplos = [
      'Arroz integral + pechuga pollo + verduras',
      'Pasta integral + pavo + salsa tomate natural',
      'Avena + claras de huevo + fruta',
    ]
  } else if (isFuerza && input.tier === 'elite') {
    // Fuerza élite — timing preciso
    preTiming = '1.5-2h antes'
    preRecomendacion = 'Carga de carbohidratos moderada con proteína. Evitar fibra excesiva para reducir molestias digestivas.'
    preMacros = {
      kcal: Math.round(input.pesoKg * 3),
      proteinas: Math.round(input.pesoKg * 0.3),
      carbohidratos: Math.round(input.pesoKg * 0.5),
      grasas: 5,
    }
    preEjemplos = [
      'Arroz blanco + pollo + patata cocida',
      'Batido: 300ml leche + 50g avena + scoop proteína',
      'Tortitas de avena + claras + plátano',
    ]
    alertas.push('Élite fuerza: programar comida pre-entreno 2h antes, sin fibra ni grasas.')
  } else {
    // General
    preTiming = '1-2h antes'
    preRecomendacion = 'Comida pre-entreno estándar: carbohidratos complejos + proteína moderada.'
    preMacros = {
      kcal: Math.round(input.pesoKg * 2.8),
      proteinas: Math.round(input.pesoKg * 0.2),
      carbohidratos: Math.round(input.pesoKg * 0.5),
      grasas: 5,
    }
    preEjemplos = [
      'Yogur griego + fruta + granola',
      'Tostada integral + aguacate + huevo',
      'Batido de fruta + avena + proteína',
    ]
  }

  // ── Intra-entreno ────────────────────────────────────────────────────────
  let intraEntreno: RecomendacionPeriEntreno['intra_entreno'] | undefined

  if (necesitaIntra) {
    let hidratacion: string
    let electrolitos: string | undefined

    if (isCardio && isLargaDuracion && input.tier === 'elite') {
      hidratacion = '500-750ml/h de agua + electrolitos (Na: 500-700mg/L, K: 150-250mg/L)'
      electrolitos = 'Repositor hidratación deportiva con 6-8% carbohidratos'
    } else if (isIntensa) {
      hidratacion = '400-600ml/h de agua'
      electrolitos = 'Considerar electrolitos si sudoración alta o >5% pérdida peso'
    } else {
      hidratacion = '300-500ml de agua durante la sesión'
    }

    intraEntreno = {
      timing: 'durante la sesión',
      recomendacion: isCardio
        ? 'Mantener hidratación constante. Si >90min, tomar carbohidratos de rápida absorción (30-60g/h).'
        : 'Hidratación entre series. Si >75min, añadir BCAAs o carbohidratos líquidos.',
      hidratacion,
      cuando: isCardio ? 'si >60 minutos' : 'si >75 minutos',
      electrolitos,
    }

    if (isCardio && isLargaDuracion) {
      alertas.push(`Cardio prolongado (${input.duracionMin}min): programar 30-60g/h carbohidratos intra-entreno.`)
    }
  }

  // ── Post-entreno ─────────────────────────────────────────────────────────
  const ventanaAnabolica = input.tier === 'elite' || (isFuerza && input.objetivo === 'ganar_musculo')
    ? 'crítica' : input.objetivo === 'rendimiento' || input.objetivo === 'perder_grasa'
      ? 'prioritaria' : 'flexible'

  const postProteina = input.objetivo === 'ganar_musculo' || input.tier === 'elite'
    ? Math.round(input.pesoKg * 0.4)
    : Math.round(input.pesoKg * 0.25)

  const postCarbos = ventanaAnabolica === 'crítica'
    ? Math.round(input.pesoKg * 0.8)
    : ventanaAnabolica === 'prioritaria'
      ? Math.round(input.pesoKg * 0.5)
      : Math.round(input.pesoKg * 0.3)

  let postRecomendacion: string
  let postEjemplos: string[]

  if (ventanaAnabolica === 'crítica') {
    postRecomendacion = 'VENTANA ANABÓLICA CRÍTICA: consumir proteína + carbohidratos dentro de 45-60min. Optimizar recaptación de glucógeno y síntesis proteica.'
    postEjemplos = [
      'Batido: 2 scoops proteína + 80g dextrosa/maltodextrina',
      'Arroz blanco + pollo + batata',
      'Recuperación: 500ml leche chocolate desnatada + plátano',
    ]
  } else if (ventanaAnabolica === 'prioritaria') {
    postRecomendacion = 'Comida post-entreno dentro de 2h: proteína completa + carbohidratos para recuperación.'
    postEjemplos = [
      'Pollo + arroz integral + verduras',
      'Batido proteína + avena + leche',
      'Tortilla francesa (3 huevos) + pan integral + aguacate',
    ]
  } else {
    postRecomendacion = 'Comida post-entreno dentro de 2-3h: asegurar proteína suficiente para reparación muscular.'
    postEjemplos = [
      'Comida principal equilibrada post-entreno',
      'Ensalada de legumbres + huevo + atún',
      'Yogur griego + frutos secos + fruta',
    ]
  }

  const postTiming = ventanaAnabolica === 'crítica'
    ? '45-60 min post-entreno'
    : 'dentro de 2h post-entreno'

  const postKcal = (postProteina * 4) + (postCarbos * 4) + (10 * 9)
  // ~10g grasa para absorción vitaminas liposolubles

  // ── Alertas adicionales ──────────────────────────────────────────────────
  if (input.tipoEntreno?.includes('hiit') && input.objetivo === 'perder_grasa') {
    alertas.push('HIIT + déficit: priorizar proteína post-entreno para evitar catabolismo. Carbohidratos post-sesión para recuperación.')
  }
  if (input.duracionMin > 120 && input.intensidad === 'alta') {
    alertas.push(`Sesión ultra-intensa (${input.duracionMin}min): riesgo de sobreentrenamiento. Aumentar carbohidratos intra y post-entreno +50%.`)
  }
  if (input.tier === 'elite' && isCardio) {
    alertas.push('Élite cardio: programar carga de carbohidratos los 3 días previos a competición (8-10g/kg CHO).')
  }

  return {
    pre_entreno: {
      timing: preTiming,
      recomendacion: preRecomendacion,
      macros: preMacros,
      ejemplos: preEjemplos,
    },
    intra_entreno: intraEntreno,
    post_entreno: {
      timing: postTiming,
      ventana_anabolica: ventanaAnabolica,
      recomendacion: postRecomendacion,
      macros: { kcal: postKcal, proteinas: postProteina, carbohidratos: postCarbos, grasas: 10 },
      ejemplos: postEjemplos,
    },
    alertas,
  }
}

/**
 * Formatea la recomendación peri-entreno para incluir en el prompt de DeepSeek
 */
export function formatearPeriEntrenoParaPrompt(rec: RecomendacionPeriEntreno): string {
  let output = '═══ NUTRICIÓN PERI-ENTRENO ═══\n\n'

  output += `【PRE-ENTRENO】${rec.pre_entreno.timing}\n`
  output += `${rec.pre_entreno.recomendacion}\n`
  output += `Macros: ${rec.pre_entreno.macros.kcal} kcal | ${rec.pre_entreno.macros.proteinas}g prot | ${rec.pre_entreno.macros.carbohidratos}g cho | ${rec.pre_entreno.macros.grasas}g fat\n`
  output += `Ejemplos: ${rec.pre_entreno.ejemplos.join(', ')}\n\n`

  if (rec.intra_entreno) {
    output += `【INTRA-ENTRENO】${rec.intra_entreno.timing} (${rec.intra_entreno.cuando})\n`
    output += `${rec.intra_entreno.recomendacion}\n`
    output += `Hidratación: ${rec.intra_entreno.hidratacion}\n`
    if (rec.intra_entreno.electrolitos) {
      output += `Electrolitos: ${rec.intra_entreno.electrolitos}\n`
    }
    output += '\n'
  }

  output += `【POST-ENTRENO】${rec.post_entreno.timing}\n`
  output += `Ventana anabólica: ${rec.post_entreno.ventana_anabolica}\n`
  output += `${rec.post_entreno.recomendacion}\n`
  output += `Macros: ${rec.post_entreno.macros.kcal} kcal | ${rec.post_entreno.macros.proteinas}g prot | ${rec.post_entreno.macros.carbohidratos}g cho | ${rec.post_entreno.macros.grasas}g fat\n`
  output += `Ejemplos: ${rec.post_entreno.ejemplos.join(', ')}\n\n`

  if (rec.alertas.length > 0) {
    output += `⚠️ Alertas peri-entreno:\n${rec.alertas.map(a => `  - ${a}`).join('\n')}\n`
  }

  return output
}
