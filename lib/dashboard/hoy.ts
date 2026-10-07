import type { CommandData } from './tipos'

export type Tono = 'critico' | 'pendiente' | 'ok'

export type CasoHoy = { id: string; titulo: string; detalle: string; href: string }

export type TarjetaHoy = {
  id: 'checkins' | 'riesgo' | 'ia' | 'altas'
  titulo: string
  total: number
  tono: Tono
  href: string
  casos: CasoHoy[]
}

export type ResumenHoy = { tarjetas: TarjetaHoy[]; todoAlDia: boolean }

const MAX_CASOS = 3

function tonoDe(total: number, critico: boolean): Tono {
  if (total === 0) return 'ok'
  return critico ? 'critico' : 'pendiente'
}

export function resumirHoy(c: CommandData): ResumenHoy {
  const accionesCheckin = c.hoy.filter(a => a.tipo === 'checkin' || a.tipo === 'respuesta')
  const totalCheckins = c.operacion.checkins_pendientes + c.operacion.respuestas_pendientes

  const checkins: TarjetaHoy = {
    id: 'checkins',
    titulo: 'Check-ins por revisar',
    total: totalCheckins,
    tono: tonoDe(totalCheckins, accionesCheckin.some(a => a.severity === 'critica')),
    href: '/clientes',
    casos: accionesCheckin.slice(0, MAX_CASOS).map(a => ({ id: a.id, titulo: a.cliente_nombre, detalle: a.title, href: a.href })),
  }

  const riesgo: TarjetaHoy = {
    id: 'riesgo',
    titulo: 'Clientes en riesgo',
    total: c.clientes_riesgo.length,
    tono: tonoDe(c.clientes_riesgo.length, c.clientes_riesgo.some(r => r.riesgo === 'alto')),
    href: '/clientes',
    casos: c.clientes_riesgo.slice(0, MAX_CASOS).map(r => ({ id: r.cliente_id, titulo: r.cliente_nombre, detalle: r.accion, href: r.href })),
  }

  const ia: TarjetaHoy = {
    id: 'ia',
    titulo: 'Listo para aprobar (IA)',
    total: c.inbox_ia.length,
    tono: tonoDe(c.inbox_ia.length, false),
    href: '/entrenos/brain-ia',
    casos: c.inbox_ia.slice(0, MAX_CASOS).map(t => ({ id: t.id, titulo: t.cliente_nombre, detalle: t.tipo.replaceAll('_', ' '), href: t.href })),
  }

  const accionesAltas = c.hoy.filter(a => a.tipo === 'plan' || a.tipo === 'onboarding' || a.tipo === 'competicion')
  const altas: TarjetaHoy = {
    id: 'altas',
    titulo: 'Planes, altas y pruebas',
    total: accionesAltas.length,
    tono: tonoDe(accionesAltas.length, accionesAltas.some(a => a.severity === 'critica')),
    href: '/clientes',
    casos: accionesAltas.slice(0, MAX_CASOS).map(a => ({ id: a.id, titulo: a.cliente_nombre, detalle: a.title, href: a.href })),
  }

  const tarjetas = [checkins, riesgo, ia, altas]
  return { tarjetas, todoAlDia: tarjetas.every(t => t.total === 0) }
}
