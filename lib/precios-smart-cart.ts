// lib/precios-smart-cart.ts
// ═══════════════════════════════════════════════════════════════
// Smart Cart — Optimización multi-supermercado, detección de
// ofertas, exportación WhatsApp y heurísticas de ahorro real.
// ═══════════════════════════════════════════════════════════════

import type { IngredienteSemanal, PrecioOpcion, AsignacionOptimizada, ResultadoOptimizacion, ResumenOptimizacionSuper } from '@/types'

// ── Helpers ─────────────────────────────────────────────────

function formatearEuro(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n)
}

// ── 1. Optimización multi-supermercado ──────────────────────
// Para CADA ingrediente, escoge el supermercado más barato.
// Esto produce la cesta de la compra óptima: cada producto al
// menor precio posible, aunque sea en distintos supermercados.

export function calcularOptimizacionMultiSuper(
  ingredientes: IngredienteSemanal[]
): ResultadoOptimizacion {
  const asignaciones: AsignacionOptimizada[] = []
  const costeMap = new Map<string, number>()     // super_id → coste
  const numIngMap = new Map<string, number>()    // super_id → count
  const superInfo = new Map<string, { nombre: string; color?: string }>()

  for (const ing of ingredientes) {
    if (ing.precios.length === 0) continue

    // El más barato para este ingrediente
    const mejor = ing.precios[0] // ya vienen ordenados por precio
    const coste = (ing.cantidad_gramos_total / 1000) * mejor.precio_por_kg

    // Calcular ahorro respecto a la selección actual del usuario
    let ahorroVsActual = 0
    if (ing.seleccion?.supermercado_id && ing.seleccion.supermercado_id !== mejor.supermercado_id) {
      const precioActual = ing.precios.find(p => p.supermercado_id === ing.seleccion!.supermercado_id)
      if (precioActual) {
        ahorroVsActual = ((ing.cantidad_gramos_total / 1000) * precioActual.precio_por_kg) - coste
      }
    }

    // Detectar si es una oferta: precio inferior a la media de todos los supers
    const mediaPrecios = ing.precios.reduce((s, p) => s + p.precio_por_kg, 0) / ing.precios.length
    const esOferta = mejor.precio_por_kg < mediaPrecios * 0.85 // 15% por debajo de la media

    asignaciones.push({
      alimento_id: ing.alimento_id,
      alimento_nombre: ing.alimento_nombre,
      cantidad_gramos: ing.cantidad_gramos_total,
      supermercado_id: mejor.supermercado_id,
      supermercado_nombre: mejor.supermercado_nombre,
      supermercado_color: mejor.supermercado_color,
      precio_por_kg: mejor.precio_por_kg,
      coste_euros: Math.round(coste * 100) / 100,
      es_oferta: esOferta,
      ahorro_vs_super_actual: Math.round(ahorroVsActual * 100) / 100,
    })

    // Acumular por supermercado
    costeMap.set(mejor.supermercado_id, (costeMap.get(mejor.supermercado_id) ?? 0) + coste)
    numIngMap.set(mejor.supermercado_id, (numIngMap.get(mejor.supermercado_id) ?? 0) + 1)
    if (!superInfo.has(mejor.supermercado_id)) {
      superInfo.set(mejor.supermercado_id, {
        nombre: mejor.supermercado_nombre,
        color: mejor.supermercado_color,
      })
    }
  }

  // Construir resumen por supermercado
  const resumen: ResumenOptimizacionSuper[] = Array.from(costeMap.entries())
    .map(([id, coste]) => ({
      supermercado_id: id,
      supermercado_nombre: superInfo.get(id)?.nombre ?? id,
      supermercado_color: superInfo.get(id)?.color,
      coste: Math.round(coste * 100) / 100,
      num_ingredientes: numIngMap.get(id) ?? 0,
    }))
    .sort((a, b) => a.coste - b.coste)

  // Calcular coste si compraras todo en un único super (el más barato / más caro)
  const costeUnicoSuper = (superId: string): number => {
    let total = 0
    for (const ing of ingredientes) {
      const p = ing.precios.find(pr => pr.supermercado_id === superId)
      if (p) total += (ing.cantidad_gramos_total / 1000) * p.precio_por_kg
    }
    return total
  }

  // Encontrar el mejor y peor super como super único
  let mejorSuperId = ''
  let mejorCoste = Infinity
  let peorSuperId = ''
  let peorCoste = -Infinity

  const supersUnicos = new Set(ingredientes.flatMap(i => i.precios.map(p => p.supermercado_id)))
  for (const sid of supersUnicos) {
    const c = costeUnicoSuper(sid)
    if (c > 0 && c < mejorCoste) { mejorCoste = c; mejorSuperId = sid }
    if (c > peorCoste) { peorCoste = c; peorSuperId = sid }
  }

  const mejorSuper = ingredientes
    .flatMap(i => i.precios)
    .find(p => p.supermercado_id === mejorSuperId)

  const peorSuper = ingredientes
    .flatMap(i => i.precios)
    .find(p => p.supermercado_id === peorSuperId)

  const costeTotalMultiSuper = asignaciones.reduce((s, a) => s + a.coste_euros, 0)
  const numOfertas = asignaciones.filter(a => a.es_oferta).length

  return {
    ingredientes: asignaciones,
    coste_total_multi_super: Math.round(costeTotalMultiSuper * 100) / 100,
    ahorro_vs_mejor_super: Math.round((mejorCoste - costeTotalMultiSuper) * 100) / 100,
    ahorro_vs_peor_super: Math.round((peorCoste - costeTotalMultiSuper) * 100) / 100,
    mejor_super_nombre: mejorSuper?.supermercado_nombre ?? '',
    peor_super_nombre: peorSuper?.supermercado_nombre ?? '',
    num_ofertas: numOfertas,
    resumen_por_super: resumen,
  }
}

// ── 2. Detección de ofertas ────────────────────────────────
// Señala aquellos productos cuyo precio está significativamente
// por debajo de la media del mercado (todos los supers).

export interface OfertaDetectada {
  alimento_id: string
  alimento_nombre: string
  supermercado_id: string
  supermercado_nombre: string
  precio_por_kg: number
  media_mercado: number
  ahorro_pct: number        // ej: -20 = 20% más barato que la media
  es_ganga: boolean         // true si es >=30% más barato
}

export function detectarOfertas(
  ingredientes: IngredienteSemanal[]
): OfertaDetectada[] {
  const ofertas: OfertaDetectada[] = []

  for (const ing of ingredientes) {
    if (ing.precios.length < 2) continue // necesita al menos 2 supers para comparar

    const precios = ing.precios.map(p => p.precio_por_kg)
    const media = precios.reduce((s, v) => s + v, 0) / precios.length

    for (const p of ing.precios) {
      const diffPct = ((p.precio_por_kg - media) / media) * 100
      if (diffPct <= -15) { // 15% o más por debajo de la media
        ofertas.push({
          alimento_id: ing.alimento_id,
          alimento_nombre: ing.alimento_nombre,
          supermercado_id: p.supermercado_id,
          supermercado_nombre: p.supermercado_nombre,
          precio_por_kg: p.precio_por_kg,
          media_mercado: Math.round(media * 100) / 100,
          ahorro_pct: Math.round(diffPct * 100) / 100,
          es_ganga: diffPct <= -30,
        })
      }
    }
  }

  // Ordenar: gangas primero, luego por mayor ahorro
  return ofertas.sort((a, b) => {
    if (a.es_ganga && !b.es_ganga) return -1
    if (!a.es_ganga && b.es_ganga) return 1
    return a.ahorro_pct - b.ahorro_pct
  })
}

// ── 3. Proyección de ahorro anual ──────────────────────────
// Estima el ahorro anual si el cliente sigue usando la optimización.

export interface ProyeccionAhorroAnual {
  ahorro_semanal: number
  ahorro_mensual: number
  ahorro_anual: number
  ahorro_pct: number
}

export function calcularProyeccionAnual(
  costeTotal: number,
  costeMultiSuper: number
): ProyeccionAhorroAnual {
  const ahorroSemanal = costeTotal - costeMultiSuper
  return {
    ahorro_semanal: Math.round(ahorroSemanal * 100) / 100,
    ahorro_mensual: Math.round(ahorroSemanal * 4.33 * 100) / 100,
    ahorro_anual: Math.round(ahorroSemanal * 52 * 100) / 100,
    ahorro_pct: costeTotal > 0
      ? Math.round((ahorroSemanal / costeTotal) * 100 * 100) / 100
      : 0,
  }
}

// ── 4. Exportación WhatsApp ────────────────────────────────
// Genera un mensaje formateado y un deep link para compartir
// la lista optimizada por WhatsApp.

export interface MensajeWhatsApp {
  texto: string
  deepLink: string    // https://wa.me/?text=...
}

export function construirMensajeWhatsApp(
  ingredientes: IngredienteSemanal[],
  resultado: ResultadoOptimizacion,
  nombrePlan?: string
): MensajeWhatsApp {
  const lineas: string[] = []
  lineas.push(`🛒 *LISTA DE LA COMPRA INTELIGENTE*${nombrePlan ? ` — ${nombrePlan}` : ''}`)
  lineas.push('')

  // Agrupar por supermercado
  const porSuper = new Map<string, AsignacionOptimizada[]>()
  for (const asig of resultado.ingredientes) {
    const arr = porSuper.get(asig.supermercado_nombre) || []
    arr.push(asig)
    porSuper.set(asig.supermercado_nombre, arr)
  }

  for (const [superNombre, items] of porSuper) {
    lineas.push(`🏪 *${superNombre}*`)
    for (const item of items) {
      const g = item.cantidad_gramos
      const texto = g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`
      const oferta = item.es_oferta ? ' 🔥' : ''
      lineas.push(`  • ${item.alimento_nombre} — ${texto} — ${formatearEuro(item.coste_euros)}${oferta}`)
    }
    const totalSuper = items.reduce((s, i) => s + i.coste_euros, 0)
    lineas.push(`  *Total ${superNombre}:* ${formatearEuro(totalSuper)}`)
    lineas.push('')
  }

  lineas.push(`━━━━━━━━━━━━━━━━━━`)
  lineas.push(`💰 *Total optimizado:* ${formatearEuro(resultado.coste_total_multi_super)}`)

  if (resultado.ahorro_vs_mejor_super > 0) {
    lineas.push(`📉 *Ahorro extra vs mejor super único:* ${formatearEuro(resultado.ahorro_vs_mejor_super)}`)
  }
  if (resultado.ahorro_vs_peor_super > 0) {
    lineas.push(`📉 *Ahorro vs súper más caro:* ${formatearEuro(resultado.ahorro_vs_peor_super)}`)
  }
  if (resultado.num_ofertas > 0) {
    lineas.push(`🔥 *${resultado.num_ofertas} ofertas detectadas*`)
  }

  lineas.push('')
  lineas.push('_Generado por NutriCoach_')

  const texto = lineas.join('\n')

  // Deep link WhatsApp: codificar para URL
  const textoEncoded = encodeURIComponent(texto)
  const deepLink = `https://wa.me/?text=${textoEncoded}`

  return { texto, deepLink }
}
