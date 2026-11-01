// lib/platos/macros.ts
// Macros de un plato a partir de sus líneas. Lo que no está enlazado a un alimento no suma y marca el plato como incompleto.

export type LineaMacros = {
  cantidad_gramos: number
  alimento: { calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function calcularMacrosPlato(lineas: LineaMacros[]): { kcal: number; proteinas: number; carbohidratos: number; grasas: number; incompleto: boolean } {
  let kcal = 0, p = 0, c = 0, g = 0
  let incompleto = lineas.length === 0
  for (const l of lineas) {
    if (!l.alimento) { incompleto = true; continue }
    const f = l.cantidad_gramos / 100
    kcal += l.alimento.calorias * f
    p += l.alimento.proteinas * f
    c += l.alimento.carbohidratos * f
    g += l.alimento.grasas * f
  }
  return { kcal: r1(kcal), proteinas: r1(p), carbohidratos: r1(c), grasas: r1(g), incompleto }
}
