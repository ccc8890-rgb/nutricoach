// lib/entrenos/generar-plan-ia.ts
// Genera (SIN guardar) la propuesta de plan de entreno de un cliente: contexto real, esqueleto del macrociclo, prompt y llamada a DeepSeek.
// El cuerpo de generarPlanEntrenoIA es el que vivía en la ruta proponer-plan-ciencia, movido sin cambios (por eso conserva su sangría).
import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluarPerfilEntreno } from '@/lib/motor-entreno'
import { obtenerInformeVigente } from '@/lib/inteligencia-clinica'
import { siguienteFaseBloque, type FaseBloque } from '@/lib/entrenos/bloques'
import type { PerfilEntrenoCliente } from '@/types'
import { construirContextoRendimiento } from '@/lib/rendimiento/contexto'
import { validarSemanaCarrera, type ContextoValidacion, type ResultadoValidacion } from '@/lib/entrenos/validar-plan-carrera'
import { planificarMacrociclo, type ResultadoMacro } from '@/lib/entrenos/macrociclo'
import { construirEntradaMacro } from '@/lib/entrenos/macro-desde-cliente'
import { formatearRitmo } from '@/lib/entrenos/ritmos'

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'

export class ErrorGeneracionPlan extends Error {
  constructor(public codigo: 'CLIENTE_NO_ENCONTRADO' | 'IA_ERROR' | 'IA_RESPUESTA_INVALIDA', public estado: number, mensaje: string) { super(mensaje) }
}

export interface ResultadoGeneracionPlan {
  planIA: Record<string, unknown>
  nombrePlan: string
  duracionSemanas: number | null
  esHibrido: boolean
  faseBloque: FaseBloque | null
  modalidad: string
  validacion: ResultadoValidacion | null
  macrociclo: ResultadoMacro | null
  metadata: { rpe_promedio: number | null; ajuste_rpe: string; modalidad: string; recomendacion_motor: unknown; papers_usados: number; generado_con: string }
}

export async function generarPlanEntrenoIA(sb: SupabaseClient, opts: { clienteId: string; faseBloqueObjetivo?: FaseBloque }): Promise<ResultadoGeneracionPlan> {
    const cliente_id = opts.clienteId
    const faseBloqueObjetivoBody = opts.faseBloqueObjetivo

    // Cargar cliente + onboarding + perfil atleta
    const [clienteRes, perfilEntrenoRes, onboardingRes, sesionesCompletadasRes] = await Promise.all([
      // Bug corregido (25-09-2026): `profiles` no tiene columnas edad/sexo/
      // peso_actual (viven en `clientes`, ya incluidas por el `select('*')`
      // de este mismo query) — el join pedía columnas inexistentes y
      // devolvía 500 en TODA generación de plan, para cualquier cliente.
      sb.from('clientes')
        .select('*, profiles:profiles!profile_id(nombre, apellidos)')
        .eq('id', cliente_id).single(),
      sb.from('perfil_entreno_cliente').select('*').eq('cliente_id', cliente_id).maybeSingle(),
      sb.from('onboarding_responses').select('*').eq('cliente_id', cliente_id).maybeSingle(),
      sb.from('registros_entreno')
        .select('rpe, created_at')
        .eq('cliente_id', cliente_id)
        .not('rpe', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (!clienteRes.data) throw new ErrorGeneracionPlan('CLIENTE_NO_ENCONTRADO', 404, 'Cliente no encontrado')

    const cliente = clienteRes.data
    const perfilEntreno = perfilEntrenoRes.data as PerfilEntrenoCliente | null
    const onboarding = onboardingRes.data
    const sesionesCompletadas = sesionesCompletadasRes.data ?? []

    // Tendencia RPE para ajuste dinámico
    const rpes = sesionesCompletadas.map(s => s.rpe).filter(Boolean) as number[]
    const rpePromedio = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null
    let ajusteRpe = ''
    if (rpePromedio !== null) {
      if (rpePromedio > 8.5) ajusteRpe = `RPE promedio reciente: ${rpePromedio.toFixed(1)}/10 (MUY ALTO). REDUCIR volumen/intensidad un 15-20%.`
      else if (rpePromedio < 6.0) ajusteRpe = `RPE promedio reciente: ${rpePromedio.toFixed(1)}/10 (BAJO). AUMENTAR carga o volumen progresivamente.`
      else ajusteRpe = `RPE promedio reciente: ${rpePromedio.toFixed(1)}/10 (ÓPTIMO). Mantener progresión actual.`
    }

    // Recomendación del motor
    let recomendacion = null
    let modalidadFoco = 'funcional'
    if (perfilEntreno) {
      recomendacion = evaluarPerfilEntreno(perfilEntreno)
      modalidadFoco = perfilEntreno.sport_modality ?? 'funcional'
    }

    // Papeles relevantes de KB según modalidad
    // Bug corregido (25-09-2026): `knowledge_base.referencias` no existe
    // (la cita vive en la columna `fuente`) — el select entero fallaba en
    // silencio (`kbRes.data ?? []`  no comprobaba `.error`), así que TODO
    // plan generado hasta ahora se apoyaba en 0 papers reales pese a haber
    // 307 en la tabla.
    const kbRes = await sb.from('knowledge_base')
      .select('titulo, resumen, fuente, tags')
      .or(`tags.cs.{${modalidadFoco}},tags.cs.{fuerza},tags.cs.{cardio},tags.cs.{hiit}`)
      .limit(5)
    if (kbRes.error) console.error('proponer-plan-ciencia KB error:', kbRes.error)
    const papers = kbRes.data ?? []

    const evidenciasTexto = papers.length > 0
      ? papers.map(p => `• ${p.titulo}\n  ${p.resumen?.slice(0, 200) ?? ''}\n  Fuente: ${p.fuente ?? 'sin cita'}`).join('\n\n')
      : 'Sin papers específicos — usar principios ACSM/NSCA generales.'

    // Informe clínico del cliente (inyectar si existe)
    const informeClinico = await obtenerInformeVigente(cliente_id)
    const informeClinicoBlock = informeClinico?.instrucciones_ia
      ? `\n${informeClinico.instrucciones_ia}\n`
      : ''

    // Perfil del cliente
    const perfil = cliente.profiles as { nombre?: string; apellidos?: string; edad?: number } | null
    const nombre = perfil ? `${perfil.nombre ?? ''} ${perfil.apellidos ?? ''}`.trim() : 'Cliente'
    const diasSemana = perfilEntreno?.dias_disponibles ?? onboarding?.dias_entreno ?? 3
    const objetivo = cliente.objetivo ?? 'salud_general'
    const nivel = cliente.nivel ?? 'principiante'

    // Protocolos específicos por modalidad deportiva
    const SPORT_PROTOCOLS: Record<string, string> = {
      running: `RUNNING — pautas en las que coinciden Daniels (VDOT), Pfitzinger, Fitzgerald (80/20) y Hudson (adaptativo):
• Intensidad: la mayor parte del tiempo es suave (modelo piramidal o polarizado según la fase; Casado 2022); un 15-25 % como máximo de calidad. Daniels: cada intensidad de calidad tiene tope semanal (T ≤10 % del kilometraje, I ≤8 %, R ≤5 %) pensado para 40+ km/semana; con menos volumen manda el reparto por tiempo (~80/20).
• Zonas de pulso orientativas de Daniels: E 65-79 % del pulso máximo, M 80-90 %, T 88-92 %, I 98-100 %. Si se te dan RITMOS CALCULADOS, usa solo esos; no calcules otros.
• Estructura semanal: sesiones de calidad nunca en días consecutivos (alternar duro-fácil), con 4 salidas o menos como máximo 2 de calidad; tirada larga como máximo 2 h 30 min y sin sesión de calidad el día anterior.
• Progresión: sube el volumen de forma gradual desde lo que el atleta corre de verdad (los saltos de más del 30 % semanal se asocian a más lesiones; el «10 %» es solo una heurística), con semana de descarga cada 3-4 semanas.
• Primero base aeróbica, luego calidad; adapta cada sesión al estado actual del atleta (Hudson), sin seguir el plan a ciegas.`,

      gym: `GYM / FUERZA — Metodología Schoenfeld (2010, 2017):
• Hipertrofia: 6-12 reps, 60-75% 1RM, 3-4 sets, 60-90s descanso
• Frecuencia óptima: cada grupo muscular 2x/semana mínimo
• Progresión doble: aumentar reps hasta límite, luego subir peso
• RIR (Reps in Reserve): mantener 2-3 RIR en trabajo base, 0-1 RIR en últimas series
• Periodización ondulada diaria (DUP): variar estímulo entre sesiones`,

      crossfit: `CROSSFIT / FUNCIONAL — GPP (General Physical Preparedness):
• Estructura: Strength + WOD (Workout of the Day)
• Energéticos: ATP-PCr (fuerza), glucolítico (AMRAP/EMOM), aeróbico (Chipper)
• WODs cortos (< 10 min): alta intensidad, escalado para mantener > 85% esfuerzo
• WODs largos (> 15 min): ritmo sostenible, nunca ir al límite en la primera ronda
• Recuperación crítica: 48h entre sesiones de alta intensidad del mismo patrón`,

      hyrox: `HYROX — Protocolo específico (Laursen & Buchheit):
• 8 estaciones: SkiErg, Sled Push, Sled Pull, Burpee Broad Jumps, Row, Farmers Carry, Sandbag Lunges, Wall Balls
• Entrenamiento: combinar resistencia cardiovascular + fuerza funcional
• Simulaciones de carrera: 1km a ritmo objetivo + estación inmediatamente después
• Fuerza base: sentadilla, peso muerto, press militar — base para las estaciones
• 50/50 split: 50% trabajo cardiovascular, 50% fuerza funcional con carga`,

      cycling: `CICLISMO — Metodología Coggan (Training Peaks):
• Zonas FTP: Z1 (<55%), Z2 (56-75%), Z3 (76-90%), Z4 (91-105%), Z5 (>106%)
• Modelo polarizado: >80% en Z1-Z2, bloques Z4-Z5 en días específicos
• Intervalos: 2x20min Z4 (Threshold), 5x5min Z5 (VO2max)
• Progresión TSS: aumentar carga semanal 10% máximo, semana de descarga cada 4ª`,

      natacion: `NATACIÓN — Principios FINA/ASCA:
• Técnica primero: sin técnica correcta el volumen empeora los patrones
• Zonas: A1 (recuperación), A2 (base aeróbica), A3 (umbral), An (anaeróbico)
• Grupos de nado: 50-200m para velocidad, 400m-1km para fondo
• Variedad de estilos para equilibrio muscular y prevención lesiones`,

      funcional: `ENTRENAMIENTO FUNCIONAL — ACSM/NSCA Guidelines:
• Patrones fundamentales: push, pull, squat, hinge, carry, core
• Progresión: peso corporal → carga externa → velocidad → complejidad
• HIIT: 1:2 work:rest ratio para principiante, 1:1 intermedio, 2:1 avanzado
• Movilidad integrada: 5-10 min al inicio, no al final cuando hay fatiga`,
    }

    const MODULACION_POR_FASE: Record<FaseBloque, string> = {
      Base: 'Volumen moderado, técnica ante todo. Carrera dominada por aeróbico Z2. Cargas de híbrido moderadas, sin buscar RM.',
      Fuerza: 'Más carga y menos repeticiones en el bloque de hipertrofia accesoria y en las estaciones Hyrox con peso. Carrera se mantiene en mantenimiento: Z2 + 1 sesión de series corta, sin volumen extra.',
      Resistencia: 'Más volumen y densidad en las estaciones (simulacros tipo "1km + estación"). El tempo run gana peso frente a las series puras.',
      Deload: 'Reduce el volumen total un 30-40% manteniendo la frecuencia. Baja la intensidad. Nada de PRs ni series intensas esta semana.',
    }

    /**
     * Protocolo combinado para el cliente con sport_modality === 'hibrido':
     * 3 sesiones híbridas (Hyrox + hipertrofia accesoria rotando espalda/
     * pecho/bíceps/hombro) y 3 sesiones de carrera (tirada larga fija en fin
     * de semana + series Y tempo run entre semana), modulado por la fase de
     * bloque de 4 semanas en la que está el cliente.
     *
     * Antes eran 2 sesiones de carrera (series O tempo, nunca ambas) — Carlos
     * pidió más peso al running sin recortar las híbridas, así que ahora se
     * incluyen las dos variantes entre semana en vez de elegir una.
     */
    function construirProtocoloHibridoHyroxRunning(fase: FaseBloque): string {
      return `HÍBRIDO HYROX + RUNNING — Bloque actual: ${fase}
${MODULACION_POR_FASE[fase]}

REPARTO SEMANAL OBLIGATORIO — EXACTAMENTE 6 SESIONES EN TOTAL, NI UNA MÁS:
• 3 sesiones HÍBRIDAS (y solo 3): cada una incluye 1-2 estaciones reales de Hyrox (SkiErg, Sled Push, Sled Pull, Burpee Broad Jumps, Farmers Carry, Wall Balls, Row) MÁS un bloque de fuerza/hipertrofia accesoria. La hipertrofia accesoria debe ROTAR entre las 3 sesiones para cubrir espalda, pecho, bíceps y hombro a lo largo de la semana — no repitas el mismo grupo muscular en las 3 sesiones híbridas.
• 1 sesión de CARRERA — tirada larga, en fin de semana (Sábado o Domingo): rodaje continuo a ritmo aeróbico Z2, duración progresiva.
• 1 sesión de CARRERA — series (intervalos) entre semana, según la fase de bloque indicada arriba.
• 1 sesión de CARRERA — tempo run entre semana (día distinto al de series), según la fase de bloque indicada arriba. Total de sesiones de carrera en la semana: exactamente 3.

FUENTES: Laursen & Buchheit (Hyrox/HIIT), Daniels (VDOT running), Schoenfeld 2010/2017 (hipertrofia accesoria).`
    }

    const esHibridoHyroxRunning = modalidadFoco === 'hibrido'

    // Si no se especifica fase de bloque, calcularla a partir del plan más
    // reciente del cliente (activo o no) — así "generar siguiente bloque"
    // funciona sin que el frontend tenga que saber la rotación.
    let faseBloqueObjetivo: FaseBloque = 'Base'
    if (esHibridoHyroxRunning) {
      if (faseBloqueObjetivoBody) {
        faseBloqueObjetivo = faseBloqueObjetivoBody
      } else {
        const { data: planAnterior } = await sb
          .from('planes_entrenamiento')
          .select('id')
          .eq('cliente_id', cliente_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let faseAnterior: FaseBloque | null = null
        if (planAnterior) {
          const { data: sesionPrevia } = await sb
            .from('sesiones_entrenamiento')
            .select('fase_bloque')
            .eq('plan_id', planAnterior.id)
            .not('fase_bloque', 'is', null)
            .limit(1)
            .maybeSingle()
          faseAnterior = (sesionPrevia?.fase_bloque as FaseBloque | undefined) ?? null
        }
        faseBloqueObjetivo = siguienteFaseBloque(faseAnterior)
      }
    }

    const protocoloDeporte = esHibridoHyroxRunning
      ? construirProtocoloHibridoHyroxRunning(faseBloqueObjetivo)
      : (SPORT_PROTOCOLS[modalidadFoco] ?? SPORT_PROTOCOLS.funcional)

    const instruccionDuracion = esHibridoHyroxRunning
      ? `1. Plan de EXACTAMENTE 6 sesiones/semana — CUENTA el array "sesiones" antes de responder: debe tener longitud 6, ni 5 ni 7. Reparto fijo: 3 híbridas + 3 carrera. EXACTAMENTE 4 semanas de duración (este bloque completo, sin semana de descarga adicional — el Deload es un bloque entero cuando corresponda en la rotación)`
      : `1. Plan de ${Math.min(diasSemana, 5)} sesiones/semana, 8-12 semanas de duración`

    const instruccionCargasConcretas = esHibridoHyroxRunning
      ? `\n6. Sin datos de RM/VDOT reales del cliente: ESTIMA pesos de partida conservadores para un atleta de nivel ${nivel} de ~65kg (ej. sentadilla goblet, press banca, remo, dominadas asistidas si hace falta) y ritmos de partida conservadores en min/km para Z2/umbral/series según nivel ${nivel}. Estos valores son un punto de partida — el sistema los ajustará solo según el RPE que registre el cliente en el próximo bloque. NUNCA dejes "peso_estimado_kg" o "ritmo_objetivo" vacíos en ejercicios de fuerza o sesiones de carrera respectivamente.`
      : ''

    // Datos REALES del reloj y ritmos calculados con el VDOT: el plan se diseña sobre lo que el atleta hace de verdad, y los ritmos no los inventa la IA.
    let bloqueReloj = ''
    let macrociclo: ResultadoMacro | null = null
    let macroFaltan: string[] = []
    const contextoValidacion: ContextoValidacion = { ritmos: null, minutosRealesSemana: null }
    try {
      const { estado: e } = await construirContextoRendimiento(sb, cliente_id, new Date().toISOString().slice(0, 10))
      contextoValidacion.ritmos = e.ritmos
      contextoValidacion.minutosRealesSemana = e.minutosCarreraPorSemana > 0 ? e.minutosCarreraPorSemana : null
      const lineas: string[] = []
      if (e.carreras6sem > 0) {
        lineas.push(`- Corre de media ${e.carrerasPorSemana} veces por semana, ${e.kmPorSemana} km y ${e.minutosCarreraPorSemana} minutos por semana (últimas 4 semanas completas, según su reloj).`)
        if (e.intensidad.valoracion !== 'sin_datos') lineas.push(`- Reparto de intensidad actual: ${e.intensidad.pctSuave} % suave, ${e.intensidad.pctMedia} % medio, ${e.intensidad.pctDura} % duro.`)
        if (e.carga) lineas.push(`- Forma (CTL) ${e.carga.ctl}, fatiga (ATL) ${e.carga.atl}, frescura ${e.carga.tsb}.`)
        if (e.retorno) lineas.push('- ⚠️ Vuelve de un parón reciente: volumen y calidad deben empezar bajos y progresar despacio.')
        lineas.push(`- REGLA DURA: el volumen semanal de carrera del plan no puede superar en más de un 20 % lo que ya corre (${e.minutosCarreraPorSemana} min/semana); si hay que subir, hazlo en bloques progresivos.`)
      } else {
        lineas.push('- Sin entrenos de carrera registrados en el reloj: empieza conservador y deja claro que el volumen inicial es una estimación.')
      }
      if (e.ritmos) {
        lineas.push(`- RITMOS DE ENTRENAMIENTO CALCULADOS (Daniels, VDOT ${e.vdot}): fácil/larga ${formatearRitmo(e.ritmos.E)}/km · maratón ${formatearRitmo(e.ritmos.M)}/km · umbral ${formatearRitmo(e.ritmos.T)}/km · intervalos ${formatearRitmo(e.ritmos.I)}/km · repeticiones ${formatearRitmo(e.ritmos.R)}/km. USA ESTOS valores en "ritmo_objetivo"; no calcules otros.`)
      } else {
        lineas.push('- Sin VDOT: indica ritmos orientativos con margen amplio y avisa en las notas de que el coach debe fijarlos con un test o una carrera reciente.')
      }
      bloqueReloj = `\n## DATOS REALES DEL RELOJ Y RITMOS\n${lineas.join('\n')}\n`

      // Esqueleto del macrociclo calculado con reglas (Daniels, Pfitzinger, Fitzgerald…): la IA lo detalla pero no lo cambia.
      if (/running|carrera|hibrido|hyrox|trail|maraton/i.test(modalidadFoco) || e.carreras6sem > 0) {
        const hoyIso = new Date().toISOString().slice(0, 10)
        const [{ data: comp }, { data: onbPro }, { data: entrenosMacro }, { data: planFijo }] = await Promise.all([
          sb.from('competiciones').select('fecha_competicion,disciplina,tiempo_objetivo_min,objetivo').eq('cliente_id', cliente_id).eq('activo', true).gte('fecha_competicion', hoyIso).order('fecha_competicion').limit(1),
          sb.from('onboarding_perfil_profundo').select('condiciones_salud,fecha_competicion,tipo_competicion').eq('cliente_id', cliente_id).maybeSingle(),
          sb.from('entrenos_realizados').select('fecha,tipo,duracion_s').eq('cliente_id', cliente_id).gte('fecha', new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)),
          sb.from('planes_entrenamiento').select('sesiones:sesiones_entrenamiento(nombre)').eq('cliente_id', cliente_id).eq('activo', true).maybeSingle(),
        ])
        const fuerzaFija = esHibridoHyroxRunning ? 3 : ((planFijo?.sesiones as { nombre: string }[] | undefined) ?? []).filter(x => /fuerza|h[ií]brid|gym|hyrox|upper|lower|torso|pierna/i.test(x.nombre ?? '')).length
        const { entrada, faltan } = construirEntradaMacro({
          hoy: hoyIso,
          cliente: { nivel: cliente.nivel ?? null, edad: cliente.edad ?? null, sexo: cliente.sexo ?? null },
          perfil: perfilEntreno as never,
          competicion: (comp?.[0] as never) ?? null,
          onboarding: onbPro as never,
          entrenos: (entrenosMacro ?? []) as never,
          sesionesFuerzaFijas: fuerzaFija,
        })
        // El protocolo híbrido fija 3 sesiones de carrera por semana.
        if (esHibridoHyroxRunning) entrada.diasCorrer = 3
        macrociclo = planificarMacrociclo(entrada)
        macroFaltan = faltan
        const w = macrociclo.semanas[0]
        if (w) {
          contextoValidacion.esqueleto = { minutos: w.minutos, salidas: w.salidas, tiradaMin: w.tiradaMin, sesionesCalidad: w.sesiones.filter(x => ['tempo', 'series', 'ritmo_carrera'].includes(x.tipo)).length }
          const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
          const resumen = macrociclo.semanas.slice(0, 8).map(x => `S${x.n}${x.descarga ? '(descarga)' : ''} ${x.fase} ${x.minutos} min`).join(' · ')
          bloqueReloj += `\n## ESQUELETO CALCULADO DEL MACROCICLO (NO LO CAMBIES)\nLo ha calculado el motor de reglas con los datos reales del atleta. Tu trabajo es detallar la semana tipo (nombres, ritmos, ejercicios, notas), NO modificar su estructura.\n- Fase de esta primera semana: ${w.fase}${w.descarga ? ' (descarga)' : ''}. ${w.salidas} sesiones de carrera, ${w.minutos} min de carrera en total, tirada larga de ${w.tiradaMin} min, ~${w.pctSuave} % del tiempo en intensidad suave.\n- Sesiones de carrera: ${w.sesiones.map(x => `${DIAS[x.dia]}: ${x.tipo.replace('_', ' ')} ${x.minutos} min`).join('; ')}.\n- Progresión prevista: ${resumen}.\n${macrociclo.avisos.length ? `- Avisos del planificador: ${macrociclo.avisos.join(' ')}\n` : ''}${macroFaltan.length ? `- Datos que faltan (dilo en las notas del plan): ${macroFaltan.join('; ')}.\n` : ''}`
        }
      }
    } catch (err) {
      console.error('proponer-plan-ciencia: datos del reloj no disponibles', err instanceof Error ? err.message : err)
    }

    const promptSistema = `Eres un preparador físico y entrenador personal de élite con 20 años de experiencia en España. Tienes certificación NSCA-CSCS (Certified Strength and Conditioning Specialist) y ACSM. Has preparado atletas recreacionales y semi-profesionales en running, CrossFit, Hyrox y triatlón.

TU MISIÓN:
Generar el plan de entrenamiento que un preparador físico de 150-200€/sesión daría — con base científica, periodización real, y explicaciones que el cliente entiende.

LO QUE DEBES HACER:
1. DISEÑAR cada sesión con propósito claro: qué sistema energético trabaja, por qué ese día, cómo encaja en el ciclo semanal
2. ESPECIFICAR carga exacta: RPE objetivo por ejercicio, series/reps precisas, descansos calculados (no genéricos)
3. INCLUIR semana de descarga automáticamente (cada 4ª semana: -30-40% volumen)
4. ESCRIBIR "notas_cliente_entreno": mensaje motivador al cliente explicando su plan (3-4 frases, tono de entrenador cercano)
5. ESCRIBIR "senales_ajuste_coach": 3 indicadores concretos que el coach revisará en 4 semanas

REGLAS ABSOLUTAS:
- Nombres de ejercicios en español (Sentadilla, Press Banca, Peso Muerto, Remo con Barra...)
- RPE nunca > 9 en semanas 1-2 (adaptación inicial)
- Crear el calentamiento como ejercicios reales y específicos dentro del bloque "calentamiento", no esconderlo en notas
- Usar "movilidad" solo si prepara el patrón del día, existe una limitación relevante o la sesión es de recuperación
- Usar "pliometria" solo si objetivo, nivel, fatiga y lesiones permiten trabajo de potencia o economía de carrera
- Reservar "principal" para el estímulo prioritario y "accesorios" para complementos que no compitan con él
- Crear "vuelta_calma" cuando aporte valor por la intensidad o el tipo de trabajo, nunca como relleno
- Deload explícito: al menos una sesión de recuperación activa por semana
- Las notas de cada ejercicio deben decir el POR QUÉ, no solo el cómo

RESPONDE ÚNICAMENTE EN JSON VÁLIDO. Sin texto fuera del JSON.`

    const promptUsuario = `Genera un plan de entrenamiento personalizado para este cliente.

## PERFIL DEL CLIENTE
- Nombre: ${nombre}
- Objetivo: ${objetivo}
- Nivel: ${nivel}
- Días disponibles: ${diasSemana}/semana
- Modalidad principal: ${modalidadFoco}
${perfilEntreno?.vo2max_estimado ? `- VO2max estimado: ${perfilEntreno.vo2max_estimado} ml/kg/min` : ''}
${perfilEntreno?.ftp_watts ? `- FTP ciclismo: ${perfilEntreno.ftp_watts}W` : ''}
${perfilEntreno?.vdot ? `- VDOT running: ${perfilEntreno.vdot} → ritmos de entrenamiento calculables` : ''}
${perfilEntreno?.rm_sentadilla_kg ? `- RM sentadilla: ${perfilEntreno.rm_sentadilla_kg}kg` : ''}
${perfilEntreno?.rm_banca_kg ? `- RM press banca: ${perfilEntreno.rm_banca_kg}kg` : ''}
${perfilEntreno?.rm_peso_muerto_kg ? `- RM peso muerto: ${perfilEntreno.rm_peso_muerto_kg}kg` : ''}
${perfilEntreno?.patron_lesiones?.length ? `- ⚠️ LESIONES: ${perfilEntreno.patron_lesiones.map((l) => `${l.zona} (${l.frecuencia})`).join(', ')} — EVITAR ejercicios que comprometan estas zonas` : ''}

## PROTOCOLO CIENTÍFICO PARA ESTA MODALIDAD
${protocoloDeporte}

## ANÁLISIS MOTOR ENTRENAMIENTO (sistema automatizado)
${recomendacion ? `
- Volumen recomendado: ${recomendacion.volumen}
- Intensidad base: ${recomendacion.intensidad}
- Foco principal: ${recomendacion.foco_principal}
- Advertencias específicas: ${recomendacion.advertencias.join('; ') || 'Ninguna'}
- Ajustes adicionales: ${recomendacion.ajustes_adicionales.join('; ') || 'Ninguno'}
` : '→ Sin perfil atleta configurado. Usar criterios ACSM para nivel principiante-intermedio.'}

## FEEDBACK REAL DE SESIONES PREVIAS
${ajusteRpe || '→ Sin sesiones previas registradas. Empezar conservador (RPE 6-7 primeras 2 semanas).'}

## ANÁLISIS CLÍNICO DEL CLIENTE
${informeClinicoBlock || '→ Sin informe clínico previo. Aplicar protocolos estándar.'}
${bloqueReloj}
## EVIDENCIA CIENTÍFICA BASE
${evidenciasTexto}

## INSTRUCCIONES DE GENERACIÓN
${instruccionDuracion}
2. Semana tipo: distribución coherente (no 2 días fuerza seguidos sin recuperación)
3. Cada sesión: nombre descriptivo, 4-6 ejercicios ordenados (compuestos primero)
4. Cada ejercicio: series, reps exactas, descanso calculado, RPE objetivo, nota con el POR QUÉ
5. Incluir progresión: cómo escalar cada 2 semanas${instruccionCargasConcretas}

## FORMATO JSON EXACTO
{
  "nombre_plan": "nombre descriptivo y específico para este cliente",
  "objetivo": "string",
  "duracion_semanas": number,
  "fundamentacion": "2-3 frases del enfoque científico específico para ${modalidadFoco}",
  "notas_cliente_entreno": "Mensaje personal al cliente (3-4 frases): qué va a conseguir, por qué este plan, qué sentirá en las primeras semanas",
  "sesiones": [
    {
      "nombre": "string — nombre evocador ej: 'Fuerza base tren inferior'",
      "dia_semana": "Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo",
      "tipo": "fuerza|cardio|hiit|tecnica|recuperacion|mixto",
      "tipo_sesion": "hibrido|carrera",
      "ritmo_objetivo": "string — solo si tipo_sesion es 'carrera': ritmo objetivo en min/km, ej. '5:30/km Z2' (omitir o vacío si es híbrida)",
      "duracion_min": number,
      "ejercicios": [
        {
          "nombre": "string — nombre español exacto",
          "bloque": "calentamiento|movilidad|pliometria|principal|accesorios|vuelta_calma",
          "series": number,
          "repeticiones": "string — '8-10' o '30s' o '400m' o '3x5min'",
          "descanso_segundos": number,
          "rpe_objetivo": "string — '7-8' o '8 RIR 2'",
          "peso_estimado_kg": "number — peso de partida estimado en kg. Solo para ejercicios de fuerza; omitir en ejercicios de carrera/cardio",
          "notas": "string — técnica clave + justificación científica de POR QUÉ este ejercicio aquí"
        }
      ]
    }
  ],
  "progresion_semanal": "string — modelo exacto de progresión (ej: +2 reps semana 2-3, +2.5kg semana 4)",
  "semana_deload": "string — descripción de la semana de descarga (cuándo y cómo)",
  "indicadores_mejora": ["métrica 1 medible en 4 semanas", "métrica 2", "métrica 3"],
  "senales_ajuste_coach": {
    "si_rpe_alto": "qué hacer si RPE > 8.5 dos semanas seguidas",
    "si_rpe_bajo": "qué hacer si RPE < 6 dos semanas seguidas",
    "proxima_revision_4_semanas": "qué evaluar específicamente en el check-in de 4 semanas"
  }
}`

    const response = await fetch(DEEPSEEK_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: promptUsuario },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.35,
        max_tokens: 6000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('DeepSeek error:', err)
      throw new ErrorGeneracionPlan('IA_ERROR', 502, 'Error al generar el plan con IA')
    }

    const ds = await response.json()
    const planTexto = ds.choices?.[0]?.message?.content ?? ''
    let planIA: Record<string, unknown>
    try {
      planIA = JSON.parse(planTexto)
    } catch {
      throw new ErrorGeneracionPlan('IA_RESPUESTA_INVALIDA', 502, 'Respuesta IA no válida')
    }

    // Revisión determinista del plan de carrera generado (no lo corrige: dice qué no cuadra para que el coach lo vea).
    const sesionesGeneradas = ((planIA.sesiones as Record<string, unknown>[]) ?? []).map(x => ({
      nombre: String(x.nombre ?? ''), dia_semana: (x.dia_semana as string) ?? null, tipo_sesion: (x.tipo_sesion as string) ?? null,
      ritmo_objetivo: (x.ritmo_objetivo as string) ?? null, duracion_min: typeof x.duracion_min === 'number' ? x.duracion_min : null,
    }))
    const validacion = sesionesGeneradas.some(x => x.tipo_sesion === 'carrera' || /carrera|tirada|rodaje|tempo|series/i.test(x.nombre)) ? validarSemanaCarrera(sesionesGeneradas, contextoValidacion) : null


    return {
      planIA,
      nombrePlan: esHibridoHyroxRunning ? `Híbrido Hyrox + Running — ${faseBloqueObjetivo}` : ((planIA.nombre_plan as string) ?? `Plan IA — ${modalidadFoco}`),
      duracionSemanas: esHibridoHyroxRunning ? 4 : ((planIA.duracion_semanas as number) ?? null),
      esHibrido: esHibridoHyroxRunning,
      faseBloque: esHibridoHyroxRunning ? faseBloqueObjetivo : null,
      modalidad: modalidadFoco,
      validacion,
      macrociclo,
      metadata: { rpe_promedio: rpePromedio, ajuste_rpe: ajusteRpe, modalidad: modalidadFoco, recomendacion_motor: recomendacion, papers_usados: papers.length, generado_con: MODEL },
    }
}
