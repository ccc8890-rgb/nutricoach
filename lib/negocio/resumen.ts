// Cifras de negocio del coach. Una sola fórmula para el dashboard y para la foto diaria (negocio_snapshots).
export type ClienteNegocio = {
  activo: boolean | null
  tipo_membresia: 'trimestral' | 'semestral' | 'anual' | null
  fecha_fin_membresia: string | null
  plan_tipo?: 'base' | 'pro' | 'ultra' | 'custom' | null
  plan_precio?: number | string | null
  fecha_inicio_plan?: string | null
  pagado_via_stripe?: boolean | null
}

export const PLAN_MESES: Record<string, number> = { trimestral: 3, semestral: 6, anual: 12, base: 3, pro: 6, ultra: 12, custom: 1 }

export function toNumber(value: number | string | null | undefined) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export const round2 = (value: number) => Math.round(value * 100) / 100

export function daysBetween(date: string | null | undefined, now = new Date()) {
  if (!date) return null
  const target = new Date(date)
  if (Number.isNaN(target.getTime())) return null
  target.setHours(0, 0, 0, 0)
  const base = new Date(now)
  base.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - base.getTime()) / 86_400_000)
}

export function monthsFor(c: Pick<ClienteNegocio, 'tipo_membresia' | 'plan_tipo'>) {
  return PLAN_MESES[c.tipo_membresia ?? ''] ?? PLAN_MESES[c.plan_tipo ?? ''] ?? 1
}

export function resumirNegocio(clientes: ClienteNegocio[], now = new Date()) {
  const activos = clientes.filter(c => c.activo !== false)
  const pagos = clientes.filter(c => c.pagado_via_stripe && toNumber(c.plan_precio) > 0 && c.fecha_inicio_plan)
  const suma = (filas: ClienteNegocio[]) => filas.reduce((t, c) => t + toNumber(c.plan_precio), 0)
  return {
    clientes_activos: activos.length,
    ingresos_30d: round2(suma(pagos.filter(c => now.getTime() - new Date(c.fecha_inicio_plan!).getTime() <= 30 * 86_400_000))),
    ingresos_mes_actual: round2(suma(pagos.filter(c => {
      const f = new Date(c.fecha_inicio_plan!)
      return f.getFullYear() === now.getFullYear() && f.getMonth() === now.getMonth()
    }))),
    mrr_estimado: round2(activos.reduce((t, c) => {
      const precio = toNumber(c.plan_precio)
      return precio ? t + precio / monthsFor(c) : t
    }, 0)),
    clientes_membresia_activa: activos.filter(c => {
      const d = daysBetween(c.fecha_fin_membresia, now)
      return c.tipo_membresia && (d === null || d >= 0)
    }).length,
    clientes_sin_membresia: activos.filter(c => !c.tipo_membresia).length,
  }
}
