export type EstadoMicronutriente = 'ok' | 'bajo' | 'alto'

export interface NutrienteGap {
  key: string
  label: string
  unidad: string
  valor: number
  objetivo: number
  pct: number
  estado: EstadoMicronutriente
  direccion: 'min' | 'max'
  sugerencia: string
}

export interface TotalesMicronutrientes {
  fibra_g: number
  azucares_g: number
  azucares_anyadidos_g: number
  sodio_mg: number
  calcio_mg: number
  hierro_mg: number
  magnesio_mg: number
  potasio_mg: number
  zinc_mg: number
  vitamina_d_ug: number
  vitamina_b12_ug: number
  saturados_g: number
}

interface TargetMicronutriente {
  key: keyof TotalesMicronutrientes
  label: string
  unidad: string
  objetivo: number
  direccion: 'min' | 'max'
  sugerencia: string
}

export const TARGETS_MICRONUTRIENTES: TargetMicronutriente[] = [
  { key: 'fibra_g', label: 'Fibra', unidad: 'g', objetivo: 25, direccion: 'min', sugerencia: 'Añadir verdura, legumbres, fruta con piel o avena.' },
  { key: 'calcio_mg', label: 'Calcio', unidad: 'mg', objetivo: 1000, direccion: 'min', sugerencia: 'Revisar lácteos, bebidas enriquecidas, sardina o tofu con calcio.' },
  { key: 'hierro_mg', label: 'Hierro', unidad: 'mg', objetivo: 14, direccion: 'min', sugerencia: 'Añadir legumbres, carne magra, moluscos o combinar vegetal con vitamina C.' },
  { key: 'magnesio_mg', label: 'Magnesio', unidad: 'mg', objetivo: 350, direccion: 'min', sugerencia: 'Subir frutos secos, cacao puro, legumbres o cereales integrales.' },
  { key: 'potasio_mg', label: 'Potasio', unidad: 'mg', objetivo: 3500, direccion: 'min', sugerencia: 'Añadir patata, plátano, legumbres, verduras o fruta.' },
  { key: 'zinc_mg', label: 'Zinc', unidad: 'mg', objetivo: 10, direccion: 'min', sugerencia: 'Revisar carnes, marisco, huevos, lácteos o semillas.' },
  { key: 'vitamina_d_ug', label: 'Vitamina D', unidad: 'ug', objetivo: 15, direccion: 'min', sugerencia: 'Valorar pescado azul, huevos, lácteos enriquecidos o analítica.' },
  { key: 'vitamina_b12_ug', label: 'B12', unidad: 'ug', objetivo: 2.4, direccion: 'min', sugerencia: 'Revisar proteína animal o suplementación si el patrón es vegetal.' },
  { key: 'sodio_mg', label: 'Sodio', unidad: 'mg', objetivo: 2000, direccion: 'max', sugerencia: 'Reducir procesados, embutidos, salsas saladas y sal añadida.' },
  { key: 'azucares_anyadidos_g', label: 'Azúcares añadidos', unidad: 'g', objetivo: 25, direccion: 'max', sugerencia: 'Cambiar productos azucarados por opciones naturales o sin añadido.' },
  { key: 'saturados_g', label: 'Grasa saturada', unidad: 'g', objetivo: 20, direccion: 'max', sugerencia: 'Ajustar quesos grasos, mantequilla, bollería, embutidos o coco.' },
]

function redondear(valor: number): number {
  return Math.round(valor * 10) / 10
}

export function crearTotalesMicronutrientes(): TotalesMicronutrientes {
  return {
    fibra_g: 0,
    azucares_g: 0,
    azucares_anyadidos_g: 0,
    sodio_mg: 0,
    calcio_mg: 0,
    hierro_mg: 0,
    magnesio_mg: 0,
    potasio_mg: 0,
    zinc_mg: 0,
    vitamina_d_ug: 0,
    vitamina_b12_ug: 0,
    saturados_g: 0,
  }
}

export function calcularGapMicronutrientes(totales: TotalesMicronutrientes): NutrienteGap[] {
  return TARGETS_MICRONUTRIENTES.map(target => {
    const valor = redondear(totales[target.key] ?? 0)
    const pctRaw = target.objetivo > 0 ? (valor / target.objetivo) * 100 : 0
    const pct = Math.max(0, Math.min(160, Math.round(pctRaw)))
    const estado: EstadoMicronutriente = target.direccion === 'min'
      ? pctRaw >= 80 ? 'ok' : 'bajo'
      : pctRaw <= 100 ? 'ok' : 'alto'

    return {
      key: target.key,
      label: target.label,
      unidad: target.unidad,
      valor,
      objetivo: target.objetivo,
      pct,
      estado,
      direccion: target.direccion,
      sugerencia: target.sugerencia,
    }
  })
}

export function seleccionarMicronutrientesPrioritarios(gaps: NutrienteGap[], limite = 5): NutrienteGap[] {
  return [...gaps]
    .filter(gap => gap.estado !== 'ok')
    .sort((a, b) => {
      const severidadA = a.direccion === 'min' ? 100 - a.pct : a.pct - 100
      const severidadB = b.direccion === 'min' ? 100 - b.pct : b.pct - 100
      return severidadB - severidadA
    })
    .slice(0, limite)
}
