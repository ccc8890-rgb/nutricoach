import type { Macros, ComidaAlimento } from '@/types'

export function calcularMacrosPorCantidad(
  calorias100g: number,
  proteinas100g: number,
  carbos100g: number,
  grasas100g: number,
  fibra100g: number,
  gramos: number
): Macros {
  const factor = gramos / 100
  return {
    calorias: Math.round(calorias100g * factor * 10) / 10,
    proteinas: Math.round(proteinas100g * factor * 10) / 10,
    carbohidratos: Math.round(carbos100g * factor * 10) / 10,
    grasas: Math.round(grasas100g * factor * 10) / 10,
    fibra: Math.round(fibra100g * factor * 10) / 10,
  }
}

export function sumarMacros(macrosArray: Macros[]): Macros {
  return macrosArray.reduce(
    (acc, m) => ({
      calorias: Math.round((acc.calorias + m.calorias) * 10) / 10,
      proteinas: Math.round((acc.proteinas + m.proteinas) * 10) / 10,
      carbohidratos: Math.round((acc.carbohidratos + m.carbohidratos) * 10) / 10,
      grasas: Math.round((acc.grasas + m.grasas) * 10) / 10,
      fibra: Math.round((acc.fibra + m.fibra) * 10) / 10,
    }),
    { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
  )
}

export function calcularMacrosComida(alimentos: ComidaAlimento[]): Macros {
  const macrosIndividuales = alimentos.map((ca) => {
    if (!ca.alimento) return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
    return calcularMacrosPorCantidad(
      ca.alimento.calorias,
      ca.alimento.proteinas,
      ca.alimento.carbohidratos,
      ca.alimento.grasas,
      ca.alimento.fibra,
      ca.cantidad_gramos
    )
  })
  return sumarMacros(macrosIndividuales)
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export const OBJETIVO_LABELS: Record<string, string> = {
  perder_grasa: 'Perder grasa',
  ganar_musculo: 'Ganar músculo',
  recomposicion: 'Recomposición',
  mantenimiento: 'Mantenimiento',
  rendimiento: 'Rendimiento deportivo',
}

export const NIVEL_LABELS: Record<string, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export const COMIDAS_PREDEFINIDAS = [
  'Desayuno',
  'Media mañana',
  'Comida',
  'Merienda',
  'Cena',
  'Post-entreno',
  'Snack',
]

// ── Motor TMB / Mifflin-St Jeor ──────────────────────────────────────────────

export type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo'

export const NIVEL_ACTIVIDAD_LABELS: Record<NivelActividad, string> = {
  sedentario:   'Sedentario (sin ejercicio)',
  ligero:       'Ligero (1-3 días/semana)',
  moderado:     'Moderado (3-5 días/semana)',
  activo:       'Activo (6-7 días/semana)',
  muy_activo:   'Muy activo (2x/día o trabajo físico)',
}

const FACTORES_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario:  1.2,
  ligero:      1.375,
  moderado:    1.55,
  activo:      1.725,
  muy_activo:  1.9,
}

const AJUSTE_OBJETIVO: Record<string, number> = {
  perder_grasa:  -500,
  ganar_musculo:  300,
  recomposicion:    0,
  mantenimiento:    0,
  rendimiento:    200,
}

export function calcularTMB(peso: number, altura: number, edad: number, sexo: 'hombre' | 'mujer'): number {
  // Mifflin-St Jeor: la más precisa en adultos
  const base = 10 * peso + 6.25 * altura - 5 * edad
  return Math.round(sexo === 'hombre' ? base + 5 : base - 161)
}

export function calcularTDEE(tmb: number, actividad: NivelActividad): number {
  return Math.round(tmb * FACTORES_ACTIVIDAD[actividad])
}

export function calcularKcalObjetivo(tdee: number, objetivo: string): number {
  return tdee + (AJUSTE_OBJETIVO[objetivo] ?? 0)
}

export function calcularMacrosObjetivo(
  kcal: number,
  objetivo: string,
  peso: number
): { proteinas: number; carbohidratos: number; grasas: number } {
  const grProt = objetivo === 'ganar_musculo' ? 2.2 : 2.0
  const proteinas = Math.round(peso * grProt)
  const grasas = Math.round((kcal * 0.25) / 9)
  const carbohidratos = Math.max(0, Math.round((kcal - proteinas * 4 - grasas * 9) / 4))
  return { proteinas, carbohidratos, grasas }
}
