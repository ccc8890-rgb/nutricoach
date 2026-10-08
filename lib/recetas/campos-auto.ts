// Reglas deterministas para deducir campos de una receta (sin IA). Las usa scripts/completar-campos-recetas.mts.
const norm = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function deducirCoccion(instrucciones: string): string | null {
  // quitar negaciones y usos opcionales: «sin horno», «no necesita horno», «también en el microondas»…
  const t = norm(instrucciones)
    .replace(/\b(sin|no (necesita|requiere|usa|hace falta)|nada de|sin necesidad de)( el| la| tu)? (horno|hornear|hornea|microondas|cocinar|cocer|coccion|fuego|sarten|freidora)\b/g, ' ')
    .replace(/\b(opcional\w*|tambien|o bien|si prefieres|si quieres)[^.\n]{0,60}\b(horno|microondas|sarten|freidora|plancha)\b/g, ' ')
  const c = (re: RegExp) => (t.match(re) || []).length
  const pts: [string, number][] = [
    ['Freidora de Aire', c(/\bair ?fryer\b|\bfreidora\b/g) * 3],
    ['Horno', c(/\bhorno\b|\bhornea\w*|\bgratina\w*/g)],
    ['Microondas', c(/\bmicroondas\b/g) * 2],
    ['Sartén', c(/\bsarten\b|\bsaltea\w*|\bwok\b|\bdora\b|\bdorar\b|\bfrie\b|\bfreir\b|\bfrito\b/g)],
    ['Plancha', c(/\bplancha\b|\bgrill\b/g)],
    ['Olla/Cazuela', c(/\bolla\b|\bcazuela\b|\bhierve\b|\bhervir\b|\bcuece\b|\bcocer\b|\bcoce\b|\bcociendo\b/g)],
    ['Vapor', c(/\bal vapor\b|\bvaporera\b/g) * 2],
  ]
  const orden = [...pts].sort((a, b) => b[1] - a[1])
  const best = orden[0]
  if (best[1] > 0) return best[1] > orden[1][1] ? best[0] : null // empate = ambiguo, mejor vacío que equivocado
  return t.trim().length > 40 ? 'No Bake' : null
}

export function normalizarDificultad(v: string | null): string | null {
  const n = norm(v)
  if (n === 'facil') return 'Fácil'
  if (n === 'medio' || n === 'media') return 'Medio'
  if (n === 'dificil') return 'Difícil'
  return null
}

export function deducirDificultad(r: { instrucciones?: string | null; tiempo_prep_min?: number | null; tiempo_coccion_min?: number | null }, nIng: number): string | null {
  const pasos = (r.instrucciones || '').split('\n').filter(l => /^\s*\d+[.)]/.test(l)).length
  const t = (r.tiempo_prep_min || 0) + (r.tiempo_coccion_min || 0)
  if (!pasos && !t) return null
  // umbrales ajustados al criterio real de Carlos (83 % de acierto sobre 461 recetas etiquetadas)
  if (pasos >= 14 || nIng >= 22) return 'Difícil'
  if (pasos >= 12 || t >= 90 || nIng >= 18) return 'Medio'
  return 'Fácil'
}

// Momentos de la dieta donde encaja (solo para recetas con momentos vacíos). Los de entreno/carga NO se deducen.
export const MOMENTOS_POR_TIPO: Record<string, string[]> = {
  Desayuno: ['desayuno'],
  Comida: ['comida'],
  Cena: ['cena'],
  Merienda: ['merienda'],
  Snack: ['media_manana', 'merienda'],
  Postre: ['postre', 'merienda'],
}

// Objetivos deducibles de los macros. Calibrado contra 484 recetas ya etiquetadas (F1 ≈ 0,66-0,68 en
// perdida_grasa/recomposicion). rendimiento y ganancia_muscular NO se deducen (F1 ≈ 0,5).
// salud_general + mantenimiento sirven de base: el planificador penaliza (0,15) las recetas sin objetivos.
export function deducirObjetivos(r: { kcal?: number | null; proteinas?: number | null; nivel_fit?: string | null }): string[] {
  const kcal = r.kcal || 0
  if (kcal <= 0 || r.nivel_fit === 'indulgente' || r.nivel_fit === 'no_fit') return []
  const out: string[] = []
  if (kcal <= 900) out.push('salud_general', 'mantenimiento')
  const dens = (4 * (r.proteinas || 0)) / kcal
  if (kcal <= 700 && dens >= 0.3 && (r.proteinas || 0) >= 10) out.push('perdida_grasa', 'recomposicion')
  return out
}
