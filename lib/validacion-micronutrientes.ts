// lib/validacion-micronutrientes.ts
// Gap #7 — Validación activa de micronutrientes post-generación del plan
// Verifica que cada comida cumple los targets de sodio, fibra, azúcares
// según condiciones de salud del cliente. Emite alertas si se exceden umbrales.

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface ValidacionMicronutrientesInput {
  comidas: Array<{
    nombre: string
    recetas: Array<{
      kcal: number
      proteinas: number
      carbohidratos: number
      grasas: number
      fibra?: number
      azucares?: number
      sodio_mg?: number
      cantidad_porciones: number
    }>
  }>
  condicionesSalud?: string[]
  edad: number
  objetivo: string
}

export interface AlertaMicronutriente {
  tipo: 'sodio' | 'azucares' | 'fibra' | 'grasas_saturadas'
  nivel: 'leve' | 'moderada' | 'critica'
  mensaje: string
  valor: number
  limite: number
  comida?: string
}

export interface ResultadoValidacionMicronutrientes {
  alertas: AlertaMicronutriente[]
  totales: {
    sodio_mg: number
    azucares_g: number
    fibra_g: number
    grasa_saturada_estimada: number
  }
  limite: {
    sodio_mg: number
    azucares_g: number
    fibra_g: number
  }
  cumple_sodio: boolean
  cumple_azucares: boolean
  cumple_fibra: boolean
  resumen: string
}

// ── Umbrales por condición ──────────────────────────────────────────────────

interface Umbrales {
  sodio_max_mg: number
  azucares_max_g: number
  fibra_min_g: number
}

const UMBRALES_BASE: Umbrales = {
  sodio_max_mg: 2000,
  azucares_max_g: 25,    // OMS: <10% kcal totales (~2000 kcal → <50g, usamos <25g como óptimo)
  fibra_min_g: 25,       // OMS: 25-30g/día
}

const UMBRALES_POR_CONDICION: Record<string, Umbrales> = {
  hta: { sodio_max_mg: 1500, azucares_max_g: 25, fibra_min_g: 30 },
  hipertension: { sodio_max_mg: 1500, azucares_max_g: 25, fibra_min_g: 30 },
  diabetes: { sodio_max_mg: 2000, azucares_max_g: 15, fibra_min_g: 35 },
  'diabetes tipo 2': { sodio_max_mg: 2000, azucares_max_g: 15, fibra_min_g: 35 },
  resistencia_insulina: { sodio_max_mg: 2000, azucares_max_g: 15, fibra_min_g: 35 },
  dislipemia: { sodio_max_mg: 2000, azucares_max_g: 20, fibra_min_g: 30 },
  colesterol: { sodio_max_mg: 2000, azucares_max_g: 20, fibra_min_g: 30 },
  'higado graso': { sodio_max_mg: 2000, azucares_max_g: 15, fibra_min_g: 30 },
  nafld: { sodio_max_mg: 2000, azucares_max_g: 15, fibra_min_g: 30 },
  renal: { sodio_max_mg: 1200, azucares_max_g: 25, fibra_min_g: 22 },
  enfermedad_renal: { sodio_max_mg: 1200, azucares_max_g: 25, fibra_min_g: 22 },
}

const CONDICIONES_RENALES = ['renal', 'enfermedad_renal', 'insuficiencia_renal']

// ── Función principal ───────────────────────────────────────────────────────

export function validarMicronutrientes(input: ValidacionMicronutrientesInput): ResultadoValidacionMicronutrientes {
  const alertas: AlertaMicronutriente[] = []

  // 1. Determinar umbrales según condiciones del cliente
  const condiciones = (input.condicionesSalud ?? [])
    .flatMap(c => c.split(',').map(s => s.trim().toLowerCase()))

  const umbrales = { ...UMBRALES_BASE }
  for (const condicion of condiciones) {
    const umbralCondicion = UMBRALES_POR_CONDICION[condicion]
    if (umbralCondicion) {
      // Los umbrales más restrictivos prevalecen
      umbrales.sodio_max_mg = Math.min(umbrales.sodio_max_mg, umbralCondicion.sodio_max_mg)
      umbrales.azucares_max_g = Math.min(umbrales.azucares_max_g, umbralCondicion.azucares_max_g)
      umbrales.fibra_min_g = Math.max(umbrales.fibra_min_g, umbralCondicion.fibra_min_g)
    }
  }

  // 2. Calcular totales del plan
  let sodioTotal = 0
  let azucaresTotal = 0
  let fibraTotal = 0

  for (const comida of input.comidas) {
    for (const receta of comida.recetas) {
      const porciones = receta.cantidad_porciones || 1
      sodioTotal += (receta.sodio_mg ?? 0) * porciones
      azucaresTotal += (receta.azucares ?? 0) * porciones
      fibraTotal += (receta.fibra ?? 0) * porciones
    }
  }

  // 3. Verificar comida por comida para alertas específicas
  for (const comida of input.comidas) {
    let comidaSodio = 0
    let comidaAzucar = 0
    let comidaFibra = 0

    for (const receta of comida.recetas) {
      const porciones = receta.cantidad_porciones || 1
      comidaSodio += (receta.sodio_mg ?? 0) * porciones
      comidaAzucar += (receta.azucares ?? 0) * porciones
      comidaFibra += (receta.fibra ?? 0) * porciones
    }

    // Alerta: comida muy alta en sodio (>600mg en una sola comida: 1/3 del target HTA)
    if (comidaSodio > 600 && condiciones.some(c => ['hta', 'hipertension'].includes(c))) {
      alertas.push({
        tipo: 'sodio',
        nivel: comidaSodio > 900 ? 'critica' : 'moderada',
        mensaje: `"${comida.nombre}" aporta ${Math.round(comidaSodio)}mg de sodio (>600mg). Considerar reducir o sustituir.`,
        valor: comidaSodio,
        limite: 600,
        comida: comida.nombre,
      })
    }

    // Alerta: comida alta en azúcar (>10g en una comida para diabéticos)
    if (comidaAzucar > 10 && condiciones.some(c => c.includes('diabet') || c.includes('resistencia'))) {
      alertas.push({
        tipo: 'azucares',
        nivel: comidaAzucar > 20 ? 'critica' : 'leve',
        mensaje: `"${comida.nombre}" aporta ${Math.round(comidaAzucar)}g de azúcares (>10g). Vigilar en diabetes/resistencia insulina.`,
        valor: comidaAzucar,
        limite: 10,
        comida: comida.nombre,
      })
    }

    // Alerta: comida sin fibra para objetivos de salud digestiva
    if (comidaFibra < 1 && input.objetivo === 'perder_grasa') {
      alertas.push({
        tipo: 'fibra',
        nivel: 'leve',
        mensaje: `"${comida.nombre}" apenas aporta fibra (<1g). Considerar añadir verduras o fuente de fibra.`,
        valor: comidaFibra,
        limite: 1,
        comida: comida.nombre,
      })
    }
  }

  // 4. Alertas totales
  if (sodioTotal > umbrales.sodio_max_mg) {
    const exceso = ((sodioTotal - umbrales.sodio_max_mg) / umbrales.sodio_max_mg) * 100
    alertas.push({
      tipo: 'sodio',
      nivel: exceso > 50 ? 'critica' : exceso > 25 ? 'moderada' : 'leve',
      mensaje: `Sodio total: ${Math.round(sodioTotal)}mg/día (límite: ${umbrales.sodio_max_mg}mg). ` +
        (condiciones.some(c => c.includes('hta') || c.includes('hipertension'))
          ? 'CRÍTICO: cliente HTA necesita <1500mg/día (DASH). Reducir embutidos, procesados y sal añadida.'
          : 'Reducir alimentos procesados y sal en preparaciones.'),
      valor: sodioTotal,
      limite: umbrales.sodio_max_mg,
    })
  }

  if (azucaresTotal > umbrales.azucares_max_g) {
    alertas.push({
      tipo: 'azucares',
      nivel: 'moderada',
      mensaje: `Azúcares totales: ${Math.round(azucaresTotal)}g/día (límite: ${umbrales.azucares_max_g}g). ` +
        (condiciones.some(c => c.includes('diabet'))
          ? 'CRÍTICO: cliente diabético. Priorizar alimentos con índice glucémico bajo.'
          : 'Limitar azúcares añadidos, fruta muy madura y lácteos azucarados.'),
      valor: azucaresTotal,
      limite: umbrales.azucares_max_g,
    })
  }

  if (fibraTotal < umbrales.fibra_min_g) {
    const deficit = Math.round(umbrales.fibra_min_g - fibraTotal)
    alertas.push({
      tipo: 'fibra',
      nivel: deficit > 15 ? 'critica' : deficit > 8 ? 'moderada' : 'leve',
      mensaje: `Fibra total: ${Math.round(fibraTotal)}g (objetivo: ${umbrales.fibra_min_g}g). Faltan ~${deficit}g/día. Añadir verduras, fruta con piel, legumbres, avena.`,
      valor: fibraTotal,
      limite: umbrales.fibra_min_g,
    })
  }

  // 5. Alerta especial: condición renal + proteína alta
  const tieneCondicionRenal = condiciones.some(c => CONDICIONES_RENALES.includes(c))
  if (tieneCondicionRenal) {
    // Se verifica en otro módulo — aquí solo registramos
    alertas.push({
      tipo: 'sodio',
      nivel: 'critica',
      mensaje: 'CONDICIÓN RENAL DETECTADA: sodio limitado a 1200mg/día. Revisar también proteína (no incluida en esta validación).',
      valor: 1200,
      limite: 1200,
    })
  }

  // 6. Resumen
  const cumpleSodio = sodioTotal <= umbrales.sodio_max_mg
  const cumpleAzucares = azucaresTotal <= umbrales.azucares_max_g
  const cumpleFibra = fibraTotal >= umbrales.fibra_min_g
  const cumplidas = [cumpleSodio, cumpleAzucares, cumpleFibra].filter(Boolean).length

  let resumen: string
  if (cumplidas === 3) {
    resumen = `✅ Plan cumple todos los objetivos de micronutrientes. Sodio: ${Math.round(sodioTotal)}/${umbrales.sodio_max_mg}mg | Azúcares: ${Math.round(azucaresTotal)}/${umbrales.azucares_max_g}g | Fibra: ${Math.round(fibraTotal)}/${umbrales.fibra_min_g}g.`
  } else if (cumplidas >= 1) {
    resumen = `⚠️ Plan cumple ${cumplidas}/3 objetivos de micronutrientes. Sodio: ${Math.round(sodioTotal)}/${umbrales.sodio_max_mg}mg | Azúcares: ${Math.round(azucaresTotal)}/${umbrales.azucares_max_g}g | Fibra: ${Math.round(fibraTotal)}/${umbrales.fibra_min_g}g. ${alertas.length} alertas activas.`
  } else {
    resumen = `❌ Plan NO cumple objetivos de micronutrientes. Sodio: ${Math.round(sodioTotal)}/${umbrales.sodio_max_mg}mg | Azúcares: ${Math.round(azucaresTotal)}/${umbrales.azucares_max_g}g | Fibra: ${Math.round(fibraTotal)}/${umbrales.fibra_min_g}g. Se requieren ajustes.`
  }

  return {
    alertas,
    totales: {
      sodio_mg: Math.round(sodioTotal),
      azucares_g: Math.round(azucaresTotal * 10) / 10,
      fibra_g: Math.round(fibraTotal * 10) / 10,
      grasa_saturada_estimada: Math.round((sodioTotal > 2000 ? 30 : 20) * (fibraTotal > 25 ? 1 : 1.2)),
    },
    limite: {
      sodio_mg: umbrales.sodio_max_mg,
      azucares_g: umbrales.azucares_max_g,
      fibra_g: umbrales.fibra_min_g,
    },
    cumple_sodio: cumpleSodio,
    cumple_azucares: cumpleAzucares,
    cumple_fibra: cumpleFibra,
    resumen,
  }
}

/**
 * Calcula si una comida individual activa MPS basada en leucina estimada (~8% proteína)
 */
export function calcularCalidadComida(proteinas_g: number, edad: number): {
  mps_activada: boolean
  leucina_g: number
  threshold: number
} {
  const leucina = Math.round(proteinas_g * 0.08 * 10) / 10
  const threshold = edad >= 50 ? 3.0 : 2.0 // g leucina para activar MPS
  return {
    mps_activada: leucina >= threshold,
    leucina_g: leucina,
    threshold,
  }
}
