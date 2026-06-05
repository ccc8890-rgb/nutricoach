import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

type ClienteProfile = {
  nombre?: string | null
  apellidos?: string | null
  email?: string | null
}

type ClienteNegocioRow = {
  id: string
  activo: boolean | null
  created_at: string
  tipo_membresia: 'trimestral' | 'semestral' | 'anual' | null
  fecha_inicio_membresia: string | null
  fecha_fin_membresia: string | null
  stripe_customer_id?: string | null
  stripe_payment_intent_id?: string | null
  plan_tipo?: 'base' | 'pro' | 'ultra' | 'custom' | null
  plan_precio?: number | string | null
  fecha_inicio_plan?: string | null
  pagado_via_stripe?: boolean | null
  profile?: ClienteProfile | ClienteProfile[] | null
}

const PLAN_MESES: Record<string, number> = {
  trimestral: 3,
  semestral: 6,
  anual: 12,
  base: 3,
  pro: 6,
  ultra: 12,
  custom: 1,
}

function profileName(profile?: ClienteProfile | ClienteProfile[] | null) {
  const p = Array.isArray(profile) ? profile[0] : profile
  const nombre = [p?.nombre, p?.apellidos].filter(Boolean).join(' ').trim()
  return nombre || p?.email || 'Cliente'
}

function toNumber(value: number | string | null | undefined) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function daysBetween(date: string | null | undefined, now = new Date()) {
  if (!date) return null
  const target = new Date(date)
  if (Number.isNaN(target.getTime())) return null
  target.setHours(0, 0, 0, 0)
  const base = new Date(now)
  base.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - base.getTime()) / 86_400_000)
}

function monthsFor(cliente: ClienteNegocioRow) {
  return PLAN_MESES[cliente.tipo_membresia ?? ''] ?? PLAN_MESES[cliente.plan_tipo ?? ''] ?? 1
}

export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('clientes')
      .select('id, activo, created_at, tipo_membresia, fecha_inicio_membresia, fecha_fin_membresia, stripe_customer_id, stripe_payment_intent_id, plan_tipo, plan_precio, fecha_inicio_plan, pagado_via_stripe, profile:profiles!profile_id(nombre, apellidos, email)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const now = new Date()
    const clientes = (data ?? []) as ClienteNegocioRow[]
    const activos = clientes.filter(c => c.activo !== false)
    const pagosStripe = clientes
      .filter(c => c.pagado_via_stripe && toNumber(c.plan_precio) > 0 && c.fecha_inicio_plan)
      .sort((a, b) => new Date(b.fecha_inicio_plan ?? 0).getTime() - new Date(a.fecha_inicio_plan ?? 0).getTime())

    const ingresos30d = pagosStripe
      .filter(c => {
        const fecha = new Date(c.fecha_inicio_plan!)
        return now.getTime() - fecha.getTime() <= 30 * 86_400_000
      })
      .reduce((sum, c) => sum + toNumber(c.plan_precio), 0)

    const ingresosMesActual = pagosStripe
      .filter(c => {
        const fecha = new Date(c.fecha_inicio_plan!)
        return fecha.getFullYear() === now.getFullYear() && fecha.getMonth() === now.getMonth()
      })
      .reduce((sum, c) => sum + toNumber(c.plan_precio), 0)

    const renovaciones = activos
      .map(c => {
        const dias = daysBetween(c.fecha_fin_membresia, now)
        return {
          cliente_id: c.id,
          cliente_nombre: profileName(c.profile),
          tipo_membresia: c.tipo_membresia,
          fecha_fin_membresia: c.fecha_fin_membresia,
          dias,
          importe_estimado: toNumber(c.plan_precio),
          href: `/clientes/${c.id}`,
        }
      })
      .filter(r => r.dias !== null && r.dias <= 30)
      .sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999))

    const pagosPendientes = activos
      .flatMap(c => {
        const rows = []
        const diasFin = daysBetween(c.fecha_fin_membresia, now)

        if (!c.tipo_membresia && !c.pagado_via_stripe) {
          rows.push({
            id: `sin-setup-${c.id}`,
            cliente_id: c.id,
            cliente_nombre: profileName(c.profile),
            motivo: 'Sin membresía ni pago Stripe',
            severity: 'media',
            importe_estimado: toNumber(c.plan_precio),
            href: `/clientes/${c.id}`,
          })
        }

        if (diasFin !== null && diasFin < 0) {
          rows.push({
            id: `caducada-${c.id}`,
            cliente_id: c.id,
            cliente_nombre: profileName(c.profile),
            motivo: `Membresía caducada hace ${Math.abs(diasFin)}d`,
            severity: 'alta',
            importe_estimado: toNumber(c.plan_precio),
            href: `/clientes/${c.id}`,
          })
        }

        return rows
      })
      .sort((a, b) => (a.severity === 'alta' ? -1 : 1) - (b.severity === 'alta' ? -1 : 1))

    const mrrEstimado = activos.reduce((sum, c) => {
      const precio = toNumber(c.plan_precio)
      if (!precio) return sum
      return sum + precio / monthsFor(c)
    }, 0)

    const transaccionesRecientes = pagosStripe.slice(0, 12).map(c => ({
      id: c.stripe_payment_intent_id ?? c.id,
      cliente_id: c.id,
      cliente_nombre: profileName(c.profile),
      importe: toNumber(c.plan_precio),
      fecha: c.fecha_inicio_plan,
      estado: 'pagado',
      origen: c.stripe_payment_intent_id ? 'stripe' : 'stripe_sin_intent',
      plan_tipo: c.plan_tipo,
      href: `/clientes/${c.id}`,
    }))

    const nuevosSinPago = clientes.filter(c => {
      const created = new Date(c.created_at)
      return now.getTime() - created.getTime() <= 30 * 86_400_000 && !c.pagado_via_stripe
    }).length

    return NextResponse.json({
      resumen: {
        ingresos_30d: round2(ingresos30d),
        ingresos_mes_actual: round2(ingresosMesActual),
        mrr_estimado: round2(mrrEstimado),
        transacciones_30d: pagosStripe.filter(c => now.getTime() - new Date(c.fecha_inicio_plan!).getTime() <= 30 * 86_400_000).length,
        clientes_membresia_activa: activos.filter(c => {
          const d = daysBetween(c.fecha_fin_membresia, now)
          return c.tipo_membresia && (d === null || d >= 0)
        }).length,
        membresias_7d: renovaciones.filter(r => r.dias !== null && r.dias >= 0 && r.dias <= 7).length,
        membresias_30d: renovaciones.filter(r => r.dias !== null && r.dias >= 0 && r.dias <= 30).length,
        clientes_sin_membresia: activos.filter(c => !c.tipo_membresia).length,
      },
      transacciones_recientes: transaccionesRecientes,
      pagos_pendientes: pagosPendientes.slice(0, 12),
      renovaciones: renovaciones.slice(0, 12),
      embudo: {
        nuevos_sin_pago: nuevosSinPago,
        links_generados: clientes.filter(c => c.stripe_customer_id || c.stripe_payment_intent_id).length,
        pagos_completados: pagosStripe.length,
        clientes_activados: activos.length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[dashboard/negocio] Error:', error)
    return NextResponse.json({ error: 'Error al cargar negocio' }, { status: 500 })
  }
}
