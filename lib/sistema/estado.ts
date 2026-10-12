// Estado del sistema: ¿corren solos los agentes y la sincronización de relojes?
export type NivelEstado = 'ok' | 'aviso' | 'error'

export interface ComprobacionSistema {
  id: string
  nombre: string
  nivel: NivelEstado
  detalle: string
}

export interface EjecucionAgente {
  modo: 'diario' | 'semanal'
  origen: 'cron' | 'manual' | 'sistema'
  dry_run: boolean
  estado: 'ejecutando' | 'completado' | 'completado_con_errores' | 'fallido'
  errores: string[]
  iniciado_at: string
}

export interface IntegracionSync {
  proveedor: string
  ultima_sync: string | null
  error_ultimo: string | null
}

export interface CronRegistro {
  cron: string
  estado: 'ok' | 'error'
  detalle: string | null
  ejecutado_at: string
}

const HORA = 3_600_000

function hace(ms: number, ahora: number) {
  const h = Math.floor((ahora - ms) / HORA)
  if (h < 1) return 'hace menos de una hora'
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} días`
}

function comprobarAgentes(modo: 'diario' | 'semanal', ejecuciones: EjecucionAgente[], ahora: number, maxHoras: number): ComprobacionSistema {
  const nombre = modo === 'diario' ? 'Revisión diaria de la IA' : 'Revisión semanal de la IA'
  const reales = ejecuciones
    .filter(e => e.modo === modo && !e.dry_run && e.estado !== 'ejecutando')
    .sort((a, b) => Date.parse(b.iniciado_at) - Date.parse(a.iniciado_at))
  const ultima = reales[0]
  if (!ultima) return { id: `agentes-${modo}`, nombre, nivel: 'aviso', detalle: 'Todavía no hay ninguna ejecución registrada.' }
  const t = Date.parse(ultima.iniciado_at)
  if (ultima.estado === 'fallido') return { id: `agentes-${modo}`, nombre, nivel: 'error', detalle: `Falló ${hace(t, ahora)}.` }
  if ((ahora - t) / HORA > maxHoras) return { id: `agentes-${modo}`, nombre, nivel: 'error', detalle: `No se ejecuta desde ${hace(t, ahora)}.` }
  if (ultima.estado === 'completado_con_errores') return { id: `agentes-${modo}`, nombre, nivel: 'aviso', detalle: `Corrió ${hace(t, ahora)} con algún error (${ultima.errores.length}).` }
  return { id: `agentes-${modo}`, nombre, nivel: 'ok', detalle: `Corrió ${hace(t, ahora)}.` }
}

function comprobarRelojes(integraciones: IntegracionSync[], ahora: number): ComprobacionSistema {
  const nombre = 'Sincronización de relojes y apps'
  if (integraciones.length === 0) return { id: 'relojes', nombre, nivel: 'ok', detalle: 'Ningún cliente tiene dispositivos conectados.' }
  const conError = integraciones.filter(i => i.error_ultimo)
  const tiempos = integraciones.map(i => (i.ultima_sync ? Date.parse(i.ultima_sync) : 0))
  const ultima = Math.max(...tiempos)
  if (ultima === 0) return { id: 'relojes', nombre, nivel: 'aviso', detalle: 'Hay dispositivos conectados pero aún no se ha sincronizado ninguno.' }
  if ((ahora - ultima) / HORA > 36) return { id: 'relojes', nombre, nivel: 'error', detalle: `Última sincronización ${hace(ultima, ahora)}.` }
  if (conError.length > 0) return { id: 'relojes', nombre, nivel: 'aviso', detalle: `Sincroniza (${hace(ultima, ahora)}), pero ${conError.length} conexión(es) con error.` }
  return { id: 'relojes', nombre, nivel: 'ok', detalle: `Última sincronización ${hace(ultima, ahora)}.` }
}

const CRONS: { id: string; nombre: string; maxHoras: number }[] = [
  { id: 'enviar-garmin', nombre: 'Envío de sesiones al reloj', maxHoras: 36 },
  { id: 'avisos-rendimiento', nombre: 'Avisos de rendimiento', maxHoras: 36 },
  { id: 'proponer-bloques', nombre: 'Propuesta del siguiente bloque', maxHoras: 36 },
  { id: 'recordatorio-checkin', nombre: 'Recordatorio de check-in', maxHoras: 9 * 24 },
  { id: 'analisis-rendimiento', nombre: 'Análisis semanal de rendimiento', maxHoras: 9 * 24 },
]

function comprobarCrons(registros: CronRegistro[], ahora: number): ComprobacionSistema[] {
  return CRONS.map(({ id, nombre, maxHoras }) => {
    const ultimo = registros
      .filter(r => r.cron === id)
      .sort((a, b) => Date.parse(b.ejecutado_at) - Date.parse(a.ejecutado_at))[0]
    if (!ultimo) return { id, nombre, nivel: 'aviso' as const, detalle: 'Aún sin registro: se anota desde que corra la próxima vez.' }
    const t = Date.parse(ultimo.ejecutado_at)
    if ((ahora - t) / HORA > maxHoras) return { id, nombre, nivel: 'error' as const, detalle: `No corre desde ${hace(t, ahora)}.` }
    if (ultimo.estado === 'error') return { id, nombre, nivel: 'aviso' as const, detalle: `Corrió ${hace(t, ahora)} con errores${ultimo.detalle ? `: ${ultimo.detalle}` : '.'}` }
    return { id, nombre, nivel: 'ok' as const, detalle: `Corrió ${hace(t, ahora)}.` }
  })
}

export function evaluarSistema(
  datos: { ejecuciones: EjecucionAgente[]; integraciones: IntegracionSync[]; crons?: CronRegistro[] },
  ahora: number = Date.now(),
): { nivel: NivelEstado; resumen: string; comprobaciones: ComprobacionSistema[] } {
  const comprobaciones = [
    comprobarAgentes('diario', datos.ejecuciones, ahora, 36),
    comprobarAgentes('semanal', datos.ejecuciones, ahora, 9 * 24),
    comprobarRelojes(datos.integraciones, ahora),
    ...comprobarCrons(datos.crons ?? [], ahora),
  ]
  const errores = comprobaciones.filter(c => c.nivel === 'error')
  const avisos = comprobaciones.filter(c => c.nivel === 'aviso')
  if (errores.length > 0) return { nivel: 'error', resumen: `Atención: ${errores.map(e => e.nombre.toLowerCase()).join(' y ')} ${errores.length > 1 ? 'tienen' : 'tiene'} un problema.`, comprobaciones }
  if (avisos.length > 0) return { nivel: 'aviso', resumen: 'Funciona, con algún detalle que revisar.', comprobaciones }
  return { nivel: 'ok', resumen: 'Todo en marcha.', comprobaciones }
}
