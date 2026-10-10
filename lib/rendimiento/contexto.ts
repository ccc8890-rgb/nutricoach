// lib/rendimiento/contexto.ts
// Reúne todo lo que el "entrenador IA" necesita saber de un atleta y lo convierte en texto compacto.
import type { SupabaseClient } from '@supabase/supabase-js'
import { construirPanel, type DiaBienestar, type EntrenoPanel } from './panel'
import { calcularAlertas, type AlertaRendimiento } from './alertas'
import { leerUmbrales } from './garmin-entrenos'
import { ritmosDesdeVdot, formatearRitmo } from '@/lib/entrenos/ritmos'
import { construirEjecucion } from './ejecucion'
import { recalibrar, type EntrenoParaVdot } from './vdot'
import { estudiosParaAnalisis, textoEstudios, type EstudioCitable } from './evidencia'
import { construirEstado, type EstadoAtleta } from './estado'

export interface ContextoRendimiento {
  texto: string
  alertas: AlertaRendimiento[]
  metricas: Record<string, number | string | null>
  /** Hay entrenos recientes suficientes para analizar. */
  hayDatos: boolean
  /** Estudios de la base de conocimiento que el modelo puede citar por clave [K#]. */
  estudios: EstudioCitable[]
  /** Foto numérica del atleta que consume el motor de reglas. */
  estado: EstadoAtleta
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const NOMBRE_TIPO: Record<string, string> = {
  running: 'carrera', track_running: 'pista', treadmill_running: 'cinta', trail_running: 'trail',
  strength_training: 'fuerza', cycling: 'ciclismo', indoor_rowing: 'remo', hiking: 'senderismo', walking: 'caminar',
}

function lineaEntreno(e: EntrenoPanel): string {
  const partes = [
    e.fecha,
    NOMBRE_TIPO[e.tipo ?? ''] ?? e.tipo ?? 'actividad',
    e.nombre ? `"${e.nombre}"` : '',
    e.duracion_s ? `${Math.round(e.duracion_s / 60)}min` : '',
    // En cinta la distancia y el ritmo dependen de una calibración poco fiable: no se muestran.
    e.tipo !== 'treadmill_running' && e.distancia_m && e.distancia_m > 500 ? `${(e.distancia_m / 1000).toFixed(1)}km` : '',
    e.tipo !== 'treadmill_running' && e.ritmo_medio_s_km && /run/.test(e.tipo ?? '') ? `${mmss(e.ritmo_medio_s_km)}/km` : '',
    e.fc_media ? `FC${e.fc_media}` : '',
    e.tss !== null ? `TSS${Math.round(e.tss)}` : '',
  ]
  const z = e.tiempo_zona_fc
  const tot = z ? z.reduce((a, b) => a + b, 0) : 0
  if (z && tot > 0) partes.push(`zonas%[${z.map(s => Math.round((s / tot) * 100)).join('/')}]`)
  return partes.filter(Boolean).join(' ')
}

export async function construirContextoRendimiento(db: SupabaseClient, clienteId: string, hoy: string): Promise<ContextoRendimiento> {
  const desde28 = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10)
  const desde60 = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)

  const ejecucion = await construirEjecucion(db, clienteId, hoy)
  const [{ data: cli }, { data: entrenos }, { data: dBien }, umbrales, { data: perfil }, { data: comps }, { data: plan }, { data: previas }] = await Promise.all([
    db.from('clientes').select('profiles:profiles!profile_id(nombre, apellidos)').eq('id', clienteId).single(),
    db.from('entrenos_realizados').select('fecha,tipo,nombre,duracion_s,distancia_m,ritmo_medio_s_km,fc_media,tss,tss_metodo,carga_garmin,vo2max,tiempo_zona_fc,mejores_parciales,vueltas,raw').eq('cliente_id', clienteId).order('fecha'),
    db.from('actividad_externa_cliente').select('fecha,rhr,training_readiness,body_battery_max,sueno_h,stress_avg').eq('cliente_id', clienteId).eq('proveedor', 'garmin_connect').gte('fecha', desde60).order('fecha'),
    leerUmbrales(db, clienteId),
    db.from('perfil_entreno_cliente').select('vdot,sport_modality,objetivo_especifico,dias_disponibles,capacidad_recuperacion,patron_lesiones,restricciones_temporales').eq('cliente_id', clienteId).maybeSingle(),
    db.from('competiciones').select('nombre,disciplina,fecha_competicion,objetivo,tiempo_objetivo_min').eq('cliente_id', clienteId).eq('activo', true).gte('fecha_competicion', hoy).order('fecha_competicion').limit(3),
    db.from('planes_entrenamiento').select('id,nombre').eq('cliente_id', clienteId).eq('activo', true).maybeSingle(),
    db.from('agente_aprendizaje').select('decision,propuesta_original,propuesta_final,comentario_coach,created_at').eq('cliente_id', clienteId).eq('tipo_tarea', 'analisis_rendimiento').order('created_at', { ascending: false }).limit(5),
  ])

  const todos = (entrenos ?? []) as EntrenoPanel[]
  const bienestar: DiaBienestar[] = (dBien ?? []).map(d => ({
    fecha: d.fecha as string, rhr: d.rhr ?? null, readiness: d.training_readiness ?? null,
    body_battery_max: d.body_battery_max ?? null, sueno_h: d.sueno_h ?? null, stress_avg: d.stress_avg ?? null,
  }))
  const panel = construirPanel(todos, bienestar, hoy, 180, umbrales.fcUmbral)
  const recientes = todos.filter(e => e.fecha >= desde28)

  const proxima = comps?.[0]
  const diasComp = proxima ? Math.round((new Date(`${proxima.fecha_competicion}T12:00:00Z`).getTime() - new Date(`${hoy}T12:00:00Z`).getTime()) / 86_400_000) : null

  const media = (v: (number | null)[]) => { const x = v.filter((n): n is number => typeof n === 'number'); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null }
  const rhrReciente = media(bienestar.slice(-7).map(b => b.rhr))
  const rhrBase = media(bienestar.slice(0, -7).map(b => b.rhr))
  const alertas = calcularAlertas({ resumen: panel.resumen, semanas: panel.semanas, diasParaCompeticion: diasComp, rhr: { reciente: rhrReciente, base: rhrBase } })

  // Sesiones del plan activo
  let sesionesPlan: string[] = []
  let nombresSesionesPlan: string[] = []
  if (plan) {
    const { data: s } = await db.from('sesiones_entrenamiento').select('id,nombre,dia_semana,fase_bloque,contexto_ia,pasos').eq('plan_id', plan.id).order('orden')
    nombresSesionesPlan = (s ?? []).map(x => String(x.nombre ?? ''))
    sesionesPlan = (s ?? []).map(x => `${x.dia_semana}: ${x.nombre}${x.fase_bloque ? ` [${x.fase_bloque}]` : ''}${x.contexto_ia ? ` (${x.contexto_ia})` : ''}${x.pasos ? ` [sesion_id:${x.id}] pasos_actuales=${JSON.stringify(x.pasos)}` : ' [sin pasos estructurados: no modificable]'}`)
  }

  const vdot = perfil?.vdot ? Number(perfil.vdot) : null
  const ritmos = vdot ? ritmosDesdeVdot(vdot) : null
  const r = panel.resumen
  const efs = panel.eficiencia
  const efTexto = efs.length >= 6
    ? `media últimas 3 = ${(efs.slice(-3).reduce((a, b) => a + b.valor, 0) / 3).toFixed(3)} vs 3 anteriores = ${(efs.slice(-6, -3).reduce((a, b) => a + b.valor, 0) / 3).toFixed(3)}`
    : 'pocos datos'
  const mejor5k = panel.parciales.filter(p => p.s5000).sort((a, b) => a.s5000! - b.s5000!)[0]

  const nombrePerfil = cli?.profiles as { nombre?: string } | { nombre?: string }[] | null | undefined
  const nombre = (Array.isArray(nombrePerfil) ? nombrePerfil[0]?.nombre : nombrePerfil?.nombre) || 'el atleta'
  const recal = recalibrar(vdot, todos as unknown as EntrenoParaVdot[], umbrales, hoy)
  const L: string[] = []
  L.push(`ATLETA: ${nombre} (habla de ${nombre} en tercera persona; el lector es el coach)`)
  L.push(`FECHA DE HOY: ${hoy}`)
  L.push(`PERFIL: modalidad ${perfil?.sport_modality ?? 'n/d'}; objetivo: ${perfil?.objetivo_especifico ?? 'n/d'}; días disponibles/sem: ${perfil?.dias_disponibles ?? 'n/d'}; recuperación: ${perfil?.capacidad_recuperacion ?? 'n/d'}; lesiones: ${JSON.stringify(perfil?.patron_lesiones ?? [])}; restricciones: ${perfil?.restricciones_temporales ?? 'ninguna'}`)
  L.push(`UMBRALES: VDOT ${vdot ?? 'n/d'}${ritmos ? ` (E ${formatearRitmo(ritmos.E)}, T ${formatearRitmo(ritmos.T)}, I ${formatearRitmo(ritmos.I)}, R ${formatearRitmo(ritmos.R)} /km)` : ''}; Garmin: pulso umbral ${umbrales.fcUmbral ?? 'n/d'}, ritmo umbral ${umbrales.velUmbralMs ? mmss(1000 / umbrales.velUmbralMs) + '/km' : 'n/d'}, FC máx ${umbrales.fcMax ?? 'n/d'}`)
  L.push(`RECALIBRACIÓN DEL VDOT: ${recal.motivo}${recal.contraste.vdotUmbralGarmin ? ` (el umbral de Garmin equivale a VDOT ${recal.contraste.vdotUmbralGarmin})` : ''}${recal.confianza ? `; confianza ${recal.confianza}` : ''}`)
  L.push(proxima ? `COMPETICIÓN PRÓXIMA: ${proxima.nombre} (${proxima.disciplina}) el ${proxima.fecha_competicion}, en ${diasComp} días; objetivo: ${proxima.objetivo ?? 'n/d'}` : 'COMPETICIÓN PRÓXIMA: ninguna registrada')
  L.push(`PLAN ACTIVO: ${plan?.nombre ?? 'ninguno'}\n${sesionesPlan.map(s => '  - ' + s).join('\n')}`)
  if (r) L.push(`CARGA (TrainingPeaks-like): forma CTL ${r.ctl}, fatiga ATL ${r.atl}, frescura TSB ${r.tsb} (${r.textoEstado}); subida de forma 7d ${r.rampa7}; carga 7d ${Math.round(r.carga7d)}, 28d ${Math.round(r.carga28d)}; monotonía ${r.monotonia ?? 'n/d'}`)
  L.push(`SEMANAS (TSS/km/sesiones, antigua→reciente; la última puede estar en curso): ${panel.semanas.slice(-8).map(s => `${s.semana.slice(5)}:${s.tss}/${s.km}/${s.sesiones}`).join(' | ')}`)
  const ir = panel.intensidad.reciente
  if (ir.valoracion !== 'sin_datos' && panel.intensidad.limites) L.push(`REPARTO DE INTENSIDAD (últimas 4 sem, por pulso de cada vuelta frente al umbral de ${panel.intensidad.limites.mediaHasta} ppm; suave <${panel.intensidad.limites.suaveHasta}, media hasta ${panel.intensidad.limites.mediaHasta}, dura por encima): ${ir.pctSuave}% suave, ${ir.pctMedia}% medio, ${ir.pctDura}% duro. Referencia en corredores de resistencia: ~80% suave`)
  L.push(`EVOLUCIÓN: eficiencia aeróbica ${efTexto}; mejor 5K parcial ${mejor5k ? `${mmss(mejor5k.s5000!)} (${mejor5k.fecha})` : 'n/d'}; VO2max Garmin ${panel.vo2max.at(-1)?.valor ?? 'n/d'}`)
  const lineasEjec = ejecucion.sesiones.filter(x => x.estado !== 'pendiente').map(x => {
    const c = x.cumplimiento
    const base = `${x.fechaPrevista} ${x.nombre}: ${x.estado === 'hecha' ? 'hecha' : x.estado === 'otro_dia' ? `hecha otro día (${x.fechaReal})` : 'NO realizada'}`
    return '  - ' + base + (c ? ` → ${c.estado}: ${c.resumen}; ritmos por ${c.tramos ? 'tramo' : 'rep'} ${(c.tramos ?? c.reps.map(r => r.ritmo_s_km)).map(mmss).join(' ')}` : x.estado !== 'saltada' ? ' (sin repeticiones marcadas por el reloj: no comparable)' : '')
  })
  L.push(`EJECUCIÓN DE LAS SESIONES ESTRUCTURADAS (plan vs realizado, desde que empezó el plan "${ejecucion.planNombre ?? 'n/d'}"):\n${lineasEjec.join('\n') || '  (sin sesiones evaluables)'}`)
  L.push(`BIENESTAR últimos 7 días: ${bienestar.slice(-7).map(b => `${b.fecha.slice(5)} FCreposo ${b.rhr ?? '-'} prepar ${b.readiness ?? '-'} bat ${b.body_battery_max ?? '-'}`).join(' | ')}`)
  L.push(`ENTRENOS ÚLTIMAS 4 SEMANAS:\n${recientes.map(e => '  - ' + lineaEntreno(e)).join('\n') || '  (ninguno)'}`)
  L.push(`ALERTAS AUTOMÁTICAS (hechos calculados, no opiniones):\n${alertas.map(a => `  - [${a.gravedad}] ${a.texto}`).join('\n') || '  (ninguna)'}`)
  if (previas?.length) {
    L.push(`DECISIONES ANTERIORES DEL COACH SOBRE ANÁLISIS PREVIOS (aprende de ellas):\n${previas.map(p => `  - ${p.created_at.slice(0, 10)} ${p.decision}${p.comentario_coach ? ` — comentario: "${p.comentario_coach}"` : ''}${p.decision === 'modificado' && p.propuesta_final ? ` — versión final: "${String(p.propuesta_final).slice(0, 240)}"` : ''}`).join('\n')}`)
  }

  const estado = construirEstado({ hoy, panel, fcUmbral: umbrales.fcUmbral, vdot, diasCompeticion: diasComp, ejecucion: ejecucion.sesiones, nombresSesionesPlan, alertas })
  const estudios = await estudiosParaAnalisis(db)
  const bloqueEstudios = textoEstudios(estudios)
  if (bloqueEstudios) L.push(bloqueEstudios)

  return {
    texto: L.join('\n'),
    alertas,
    metricas: { ctl: r?.ctl ?? null, atl: r?.atl ?? null, tsb: r?.tsb ?? null, rampa7: r?.rampa7 ?? null, carga7d: r?.carga7d ?? null, vdot, pctSuave: panel.intensidad.reciente.valoracion === 'sin_datos' ? null : panel.intensidad.reciente.pctSuave },
    hayDatos: recientes.length > 0,
    estudios,
    estado,
  }
}
