// lib/entrenos/generar-plan-ia.ts
// Genera (SIN guardar) la propuesta de plan de entreno de un cliente: contexto real, esqueleto del macrociclo, prompt y llamada a DeepSeek.
// El cuerpo de generarPlanEntrenoIA es el que vivía en la ruta proponer-plan-ciencia, movido sin cambios (por eso conserva su sangría).
import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluarPerfilEntreno } from '@/lib/motor-entreno'
import { obtenerInformeVigente } from '@/lib/inteligencia-clinica'
import { siguienteFaseBloque, type FaseBloque } from '@/lib/entrenos/bloques'
import type { PerfilEntrenoCliente } from '@/types'
import { construirContextoRendimiento } from '@/lib/rendimiento/contexto'
import { validarSemanaCarrera, tipoDeSesionCarrera, type ContextoValidacion, type ResultadoValidacion } from '@/lib/entrenos/validar-plan-carrera'
import { DIAS_NOMBRE, diaNumero, repartirHibridas, tieneCarreraTrasEstacion, tieneTrabajoDePierna, validarRepartoSemana } from '@/lib/entrenos/reparto-semana'
import { planificarMacrociclo, type ResultadoMacro } from '@/lib/entrenos/macrociclo'
import { construirEntradaMacro } from '@/lib/entrenos/macro-desde-cliente'
import { formatearRitmo } from '@/lib/entrenos/ritmos'
import { normalizarDuracionSemanas } from '@/lib/entrenos/guardar-plan'
import { estudiosParaPlan } from '@/lib/rendimiento/evidencia'
import { llamarIA } from '@/lib/ia/enrutador'
import { problemasDelPlan, promptDeReparacion } from '@/lib/entrenos/reparar-plan'
import { faseDeBloqueSegunObjetivos, normalizarEstado, normalizarPrioridad, textoObjetivos, type ObjetivoAnual } from '@/lib/entrenos/objetivos-anuales'
import { ESTACIONES_POR_FASE, nombreEstacion, textoPliometriaParaNivel, validarHibridoHyrox } from '@/lib/entrenos/hyrox-estaciones'
import { senalesRecuperacion, textoSenales } from '@/lib/entrenos/senales-recuperacion'
import { extraerJsonPlan, resolverEvidenciaPlan } from '@/lib/entrenos/evidencia-plan'

/** Proveedor y modelo con los que se genera el plan (API compatible con «chat/completions»). Por defecto, DeepSeek; el banco de pruebas de modelos pasa otros. */
export interface ProveedorIA {
  nombre: string
  url: string
  /** Nombre de la variable de entorno con la clave. */
  claveEnv: string
  modelo: string
  maxTokens?: number
  /** Los modelos de razonamiento de OpenAI exigen `max_completion_tokens` y no admiten otra temperatura. */
  razonamientoOpenAI?: boolean
  /** Llamada propia (p. ej. la CLI de Claude): sustituye al `fetch` estándar. Devuelve el texto de la respuesta. */
  llamar?: (sistema: string, usuario: string) => Promise<{ texto: string; uso?: unknown; modelo?: string; intentos?: unknown }>
}
/** Genera con el modelo que toque según `lib/ia/enrutador.ts` (Claude → GPT → DeepSeek, saltando los que no tengan clave o fallen). */
export const PROVEEDOR_POR_DEFECTO: ProveedorIA = {
  nombre: 'enrutado', url: '', claveEnv: '', modelo: 'enrutado',
  llamar: async (sistema, usuario) => {
    const r = await llamarIA('plan_entreno', { sistema, usuario, json: true, presupuestoMs: PRESUPUESTO_PLAN_MS, esfuerzo: process.env.IA_ESFUERZO_PLAN === 'high' ? 'high' : 'medium' })
    return { texto: r.texto, uso: r.uso, modelo: `${r.proveedor}:${r.modelo}`, intentos: r.intentos }
  },
}

/** Tiempo máximo de toda la generación (las rutas dejan 300 s). La corrección solo se intenta si queda margen. */
const PRESUPUESTO_PLAN_MS = 280_000
const MARGEN_PARA_CORREGIR_MS = 130_000

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
  /** Minutos de carrera por semana que hace de verdad (reloj, últimas 4 semanas completas); null si no hay datos. */
  minutosRealesSemana: number | null
  metadata: { rpe_promedio: number | null; ajuste_rpe: string; modalidad: string; recomendacion_motor: unknown; papers_usados: number; generado_con: string; uso?: unknown }
}

export async function generarPlanEntrenoIA(sb: SupabaseClient, opts: { clienteId: string; faseBloqueObjetivo?: FaseBloque; proveedor?: ProveedorIA }): Promise<ResultadoGeneracionPlan> {
    const proveedor = opts.proveedor ?? PROVEEDOR_POR_DEFECTO
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

    // Estudios de la base más relevantes para ESTE caso (modalidad, objetivo, nivel, lesiones, edad, sexo). El plan solo puede citar estos, por clave K#.
    const estudios = await estudiosParaPlan(sb, {
      modalidad: modalidadFoco, objetivo: String(objetivo), nivel: String(nivel),
      lesiones: Array.isArray(perfilEntreno?.patron_lesiones) && perfilEntreno!.patron_lesiones.length > 0,
      edad: typeof cliente.edad === 'number' ? cliente.edad : null, mujer: /mujer|female|femenin/i.test(String(cliente.sexo ?? '')),
    })
    const evidenciasTexto = estudios.length
      ? `Estos son los ÚNICOS estudios que puedes citar (base de conocimiento del coach, con DOI). Cítalos SOLO por su clave [K#] en "evidencia"; no menciones autores ni estudios que no estén en esta lista.\n${estudios.map(e => `[${e.clave}] ${e.titulo}${e.anio ? ` (${e.anio})` : ''} · ${e.nivel}${e.aporta ? ` · ${e.aporta}` : ''}`).join('\n')}`
      : 'Sin estudios específicos en la base para este caso: usa criterio de entrenador y dilo en "decisiones_clave" (tipo "criterio_entrenador").'

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
    function construirProtocoloHibridoHyroxRunning(fase: FaseBloque, carreraDelEsqueleto?: string, nivelAtleta?: string | null): string {
      const lineasCarrera = carreraDelEsqueleto
        ? `• 3 sesiones de CARRERA, EXACTAMENTE las del esqueleto calculado (tipo y duración): ${carreraDelEsqueleto}. No añadas ni cambies tipos: si el esqueleto no incluye series o tempo, NO los incluyas (la calidad está limitada a propósito por el motor). Pon en "tipo_sesion": "carrera" y en el nombre el tipo (Tirada larga, Rodaje, Series, Tempo). El DÍA de cada sesión lo fija el sistema: pon cualquiera.`
        : `• 1 sesión de CARRERA — tirada larga, en fin de semana (Sábado o Domingo): rodaje continuo a ritmo aeróbico Z2, duración progresiva.
• 1 sesión de CARRERA — series (intervalos) entre semana, según la fase de bloque indicada arriba.
• 1 sesión de CARRERA — tempo run entre semana (día distinto al de series), según la fase de bloque indicada arriba. Total de sesiones de carrera en la semana: exactamente 3.`
      return `HÍBRIDO HYROX + RUNNING — Bloque actual: ${fase}
${MODULACION_POR_FASE[fase]}

REPARTO SEMANAL OBLIGATORIO — EXACTAMENTE 6 SESIONES EN TOTAL, NI UNA MÁS:
• 3 sesiones HÍBRIDAS (y solo 3): cada una incluye 2-3 estaciones reales de Hyrox MÁS un bloque de fuerza/hipertrofia accesoria. Las 8 estaciones son: SkiErg, Sled Push, Sled Pull, Burpee Broad Jumps, Remo (Row), Farmers Carry, Sandbag Lunges y Wall Balls. La hipertrofia accesoria debe ROTAR entre las 3 sesiones para cubrir espalda, pecho, bíceps y hombro a lo largo de la semana — no repitas el mismo grupo muscular en las 3 sesiones híbridas.
• ESTACIONES QUE TOCA CUBRIR EN ESTA FASE (${fase}): ${ESTACIONES_POR_FASE[fase].map(nombreEstacion).join(', ')}. Entre Base, Fuerza y Resistencia salen las 8 en un ciclo, así que no repitas siempre las mismas cuatro. Reparto: las estaciones de pierna (Sled Push, Wall Balls, Burpee Broad Jumps, Sandbag Lunges) van en la sesión de Pierna; SkiErg y Sled Pull en una sesión de tren superior; Remo y Farmers Carry en la otra. En Resistencia añade un simulacro parcial: 2-3 estaciones encadenadas con 400-1000 m corriendo entre ellas.
• SOLO UNA de las 3 sesiones híbridas lleva trabajo pesado de PIERNA (sentadilla, peso muerto, zancadas/búlgara, Sled Push, Wall Balls, Burpee Broad Jumps, Sandbag Lunges): ponle «Pierna» en el nombre. Las otras dos usan estaciones de tren superior (SkiErg, Row, Sled Pull, Farmers Carry) e hipertrofia de tren superior o core, SIN ejercicios de pierna: la carrera ya carga las piernas tres veces por semana y el motor necesita piernas frescas para la tirada y la calidad.
• CARRERA COMPROMETIDA (Hyrox real = 8 × 1 km corriendo + estación): en CADA sesión híbrida incluye, justo después de la estación principal, un ejercicio «Carrera continua» de 3-5 series de 400-500 metros (1,5-2,5 km en total) a ritmo de maratón/umbral. Es correr con las piernas cargadas; NO cuenta como una de las 3 sesiones de carrera ni cambia el esqueleto. En la sesión de Pierna, 3-4 series; en las de tren superior, 4-5 series de 400 m.
• TRABAJO COMBINADO («sin parar»): lo que se hace una cosa detrás de otra (estación + carrera, estación + estación como Wall Balls → Burpee Broad Jumps, Farmers Carry → carrera, carrera → estación, superseries o circuitos) se escribe como ejercicios CONSECUTIVOS donde todos menos el último llevan "encadenado": true y descanso_segundos 0, con las MISMAS series (= rondas); la pausa entre rondas (90-120 s) va en el último ejercicio del grupo. La estación seguida de su carrera va siempre encadenada: así se trabaja en fatiga, como en la prueba. Si cada estación se hace con su descanso, NO pongas "encadenado". Máximo 3 ejercicios encadenados seguidos, y explica en las notas del primero el orden y para qué sirve.
• PLIOMETRÍA (saltos, con o sin carga): añade un bloque corto con "bloque": "pliometria" en la sesión de Pierna (antes de la sentadilla: potencia con el sistema nervioso fresco) y en UNA sesión de carrera de calidad (series o tempo) después del calentamiento. NUNCA en rodajes suaves ni en la tirada larga, ni el día antes de la tirada. Contactos según el nivel (abajo), la mitad en Deload. ${textoPliometriaParaNivel(nivelAtleta)} Progresión por fase: Base = bajo impacto y reactivo (pogo jumps, saltos al cajón bajo, skipping, saltos con contramovimiento); Fuerza = potencia con carga ligera (sentadilla con salto con carga, salto con barra hexagonal, box jumps con peso); Resistencia = continuos y elásticos (bounding, saltos de vallas, saltos a una pierna). Evita pliometría si hay lesión de rodilla, tobillo o aquiles. Evidencia: el entrenamiento de saltos mejora la economía de carrera y el rendimiento en contrarreloj en corredores de fondo (Ramírez-Campillo 2021, meta-análisis de 21 estudios), pero su efecto sobre la economía es menor que el de la fuerza máxima con cargas altas (Eihara 2022), por eso es un complemento de la fuerza, no un sustituto.
${lineasCarrera}

FUENTES: Laursen & Buchheit (Hyrox/HIIT), Daniels (VDOT running), Schoenfeld 2010/2017 (hipertrofia accesoria).`
    }

    const esHibridoHyroxRunning = modalidadFoco === 'hibrido'

    // Si no se especifica fase de bloque, calcularla a partir del plan más
    // reciente del cliente (activo o no) — así "generar siguiente bloque"
    // funciona sin que el frontend tenga que saber la rotación.
    // Objetivos del año (confirmados o posibles, A/B/C): marcan la fase del bloque y el pico del macrociclo.
    const hoyObjetivos = new Date().toISOString().slice(0, 10)
    const { data: objetivosBD } = await sb.from('competiciones').select('nombre,fecha_competicion,disciplina,prioridad,estado').eq('cliente_id', cliente_id).eq('activo', true).gte('fecha_competicion', hoyObjetivos).order('fecha_competicion').limit(12)
    const objetivosAnio: ObjetivoAnual[] = (objetivosBD ?? []).map(o => ({ nombre: String(o.nombre), fecha: String(o.fecha_competicion), disciplina: (o.disciplina as string | null) ?? null, prioridad: normalizarPrioridad(o.prioridad), estado: normalizarEstado(o.estado) }))
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
        // Con un objetivo A/B en el calendario manda la fecha de la prueba; sin él, la rotación Base → Fuerza → Resistencia → Descarga.
        faseBloqueObjetivo = faseDeBloqueSegunObjetivos(objetivosAnio, hoyObjetivos) ?? siguienteFaseBloque(faseAnterior)
      }
    }

    let protocoloDeporte = esHibridoHyroxRunning
      ? construirProtocoloHibridoHyroxRunning(faseBloqueObjetivo, undefined, String(nivel))
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
      contextoValidacion.capacidadSemana = e.capacidadCarreraSemana && e.capacidadCarreraSemana > 0 ? e.capacidadCarreraSemana : null
      contextoValidacion.tiradaRealMin = e.tiradaLarga?.minutos ?? null
      contextoValidacion.planConservador = e.retorno || e.enDescarga || e.perfil.lesiones.length > 0 || !!e.perfil.restricciones || /princip|novel|inicia|beginner/i.test(e.perfil.nivel ?? '')
      const lineas: string[] = []
      if (e.carreras6sem > 0) {
        lineas.push(`- Corre de media ${e.carrerasPorSemana} veces por semana, ${e.kmPorSemana} km y ${e.minutosCarreraPorSemana} minutos por semana (últimas 4 semanas completas, según su reloj).`)
        if (e.intensidad.valoracion !== 'sin_datos') lineas.push(`- Reparto de intensidad actual: ${e.intensidad.pctSuave} % suave, ${e.intensidad.pctMedia} % medio, ${e.intensidad.pctDura} % duro.`)
        if (e.carga) lineas.push(`- Forma (CTL) ${e.carga.ctl}, fatiga (ATL) ${e.carga.atl}, frescura ${e.carga.tsb}.`)
        if (e.retorno) lineas.push('- ⚠️ Vuelve de un parón reciente: volumen y calidad deben empezar bajos y progresar despacio.')
        const cap = e.capacidadCarreraSemana && e.capacidadCarreraSemana > 0 ? e.capacidadCarreraSemana : e.minutosCarreraPorSemana
        lineas.push(`- REGLA DURA (dos lados): el volumen semanal de carrera del plan debe estar ENTRE el 90 % y el 120 % de su capacidad demostrada (~${cap} min/semana: es el 80 % de su mejor semana reciente; su media de 4 semanas, ${e.minutosCarreraPorSemana} min, incluye semanas bajas por viajes o descansos). Quedarse por debajo es tan mal fallo como pasarse: un plan que no llega a lo que ya tolera no produce mejora. Si hay que subir, hazlo en bloques progresivos (≤10 %/semana) y nunca bajes por debajo de su carga real salvo parón, lesión o descarga declarada.${e.tiradaLarga ? ` Su salida más larga reciente fue de ${e.tiradaLarga.minutos} min: la tirada del plan no debe quedar muy por debajo.` : ''}`)
      } else {
        lineas.push('- Sin entrenos de carrera registrados en el reloj: empieza conservador y deja claro que el volumen inicial es una estimación.')
      }
      if (e.ritmos) {
        lineas.push(`- RITMOS DE ENTRENAMIENTO CALCULADOS (Daniels, VDOT ${e.vdot}): fácil/larga ${formatearRitmo(e.ritmos.E)}/km · maratón ${formatearRitmo(e.ritmos.M)}/km · umbral ${formatearRitmo(e.ritmos.T)}/km · intervalos ${formatearRitmo(e.ritmos.I)}/km · repeticiones ${formatearRitmo(e.ritmos.R)}/km. USA ESTOS valores en "ritmo_objetivo"; no calcules otros.`)
      } else {
        lineas.push('- Sin VDOT: indica ritmos orientativos con margen amplio y avisa en las notas de que el coach debe fijarlos con un test o una carrera reciente.')
      }
      {
        const desde14 = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10)
        const { data: dias14 } = await sb.from('actividad_externa_cliente').select('fecha,rhr,hrv,sueno_h,training_readiness,body_battery_max')
          .eq('cliente_id', cliente_id).eq('proveedor', 'garmin_connect').gte('fecha', desde14).order('fecha', { ascending: true })
        lineas.push(textoSenales(senalesRecuperacion((dias14 ?? []) as never)))
      }
      bloqueReloj = `\n## DATOS REALES DEL RELOJ Y RITMOS\n${lineas.join('\n')}\n`

      // Esqueleto del macrociclo calculado con reglas (Daniels, Pfitzinger, Fitzgerald…): la IA lo detalla pero no lo cambia.
      if (/running|carrera|hibrido|hyrox|trail|maraton/i.test(modalidadFoco) || e.carreras6sem > 0) {
        const hoyIso = new Date().toISOString().slice(0, 10)
        const [{ data: comp }, { data: onbPro }, { data: entrenosMacro }, { data: planFijo }] = await Promise.all([
          sb.from('competiciones').select('fecha_competicion,disciplina,tiempo_objetivo_min,objetivo').eq('cliente_id', cliente_id).eq('activo', true).in('prioridad', ['A', 'B']).gte('fecha_competicion', hoyIso).order('fecha_competicion').limit(1),
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
          calidadHabitual: e.intensidad.valoracion !== 'sin_datos' && e.intensidad.pctDura >= 5 ? 1 : 0,
        })
        // El protocolo híbrido fija 3 sesiones de carrera por semana.
        if (esHibridoHyroxRunning) entrada.diasCorrer = 3
        macrociclo = planificarMacrociclo(entrada)
        bloqueReloj += textoObjetivos(objetivosAnio, hoyObjetivos)
        macroFaltan = faltan
        const w = macrociclo.semanas[0]
        if (w) {
          if (esHibridoHyroxRunning) {
            const NOMBRE_TIPO: Record<string, string> = { rodaje: 'rodaje fácil', tirada: 'tirada larga', tempo: 'tempo', series: 'series', ritmo_carrera: 'ritmo de carrera', strides: 'rodaje con progresiones' }
            protocoloDeporte = construirProtocoloHibridoHyroxRunning(faseBloqueObjetivo, w.sesiones.map(x => `${NOMBRE_TIPO[x.tipo] ?? x.tipo} ${x.minutos} min`).join(' + '), String(nivel))
          }
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
4a. SERIES DE CALIDAD EN PISTA, EN METROS: en las sesiones de carrera, las series (zona de intervalos o repeticiones) se escriben por DISTANCIA, como se hace en pista: "repeticiones": "400m", "800m", "1000m" (con "series" = número de repeticiones y la pausa en "descanso_segundos", trote suave). NUNCA las pongas en minutos («5 × 2 min» está mal; «5 × 500 m» está bien). Rodaje, tirada larga, tempo y calentamiento/vuelta a la calma sí van en minutos.
5. Incluir progresión: cómo escalar cada 2 semanas
5b. "decisiones_clave": entre 6 y 10, cubriendo OBLIGATORIAMENTE: reparto de intensidad y volumen, progresión y descarga, ordenación de las sesiones (interferencia fuerza-resistencia, pierna antes de tirada), individualización (lesiones, salud, edad, nivel, datos del reloj) y selección de los ejercicios o ritmos clave. En cada una que se apoye en un estudio de la lista, pon tipo "estudio" y sus claves K#; si ninguno aplica, tipo "criterio_entrenador" y evidencia vacía. NUNCA inventes un estudio, un autor ni una clave que no esté en la lista. En "decisiones_clave" NO nombres días de la semana (el sistema coloca los días después): habla de «la sesión de pierna», «las series», «la tirada larga». Si propones autorregular según señales del reloj, usa solo las que el bloque de datos marque como FIABLES.${instruccionCargasConcretas}

## FORMATO JSON EXACTO
{
  "nombre_plan": "nombre descriptivo y específico para este cliente",
  "objetivo": "string",
  "duracion_semanas": number,
  "fundamentacion": "2-3 frases del enfoque científico específico para ${modalidadFoco}",
  "decisiones_clave": [
    {
      "decision": "string — qué se decide y con qué números (ej: 'Una sola sesión de pierna pesada, 72 h antes de la tirada')",
      "motivo": "string — por qué, en 1-2 frases, aplicado a ESTE cliente (no genérico)",
      "tipo": "estudio|criterio_entrenador",
      "evidencia": ["K3", "K7"]
    }
  ],
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
          "encadenado": "boolean — true SOLO si este ejercicio se hace sin parar y enlaza directo con el SIGUIENTE de la lista (misma ronda). Si es true, descanso_segundos = 0 y el siguiente lleva las mismas series. Omitir si no se encadena",
          "rpe_objetivo": "string — UN solo número o rango simple ('7' o '7-8'), sin variantes por semana ni RIR",
          "peso_estimado_kg": "number — peso de partida estimado en kg. Solo para ejercicios de fuerza; omitir en ejercicios de carrera/cardio",
          "notas": "string — UNA frase corta (máx. 120 caracteres) con la clave de ejecución. Sin justificación científica: eso va en decisiones_clave"
        }
      ]
    }
  ],
  "progresion_semanal": "string — modelo exacto de progresión (ej: +2 reps semana 2-3, +2.5kg semana 4)",
  "semana_deload": "string — descripción de la semana de descarga (cuándo y cómo)",
  "indicadores_mejora": ["métrica 1 medible en 4 semanas", "métrica 2", "métrica 3"],
  "mejoras_cliente": ["2-3 frases cortas para el CLIENTE, lenguaje llano y sin siglas ni estudios, de qué notará mejorar al final del bloque (ej: 'Aguantarás la tirada larga con el pulso más tranquilo')"],
  "senales_ajuste_coach": {
    "si_rpe_alto": "qué hacer si RPE > 8.5 dos semanas seguidas",
    "si_rpe_bajo": "qué hacer si RPE < 6 dos semanas seguidas",
    "proxima_revision_4_semanas": "qué evaluar específicamente en el check-in de 4 semanas"
  }
}`

    let planTexto = ''
    let usoIA: unknown = null
    let modeloUsado = proveedor.modelo
    let reparaciones: { antes: string[]; despues: string[] } | null = null
    const t0Generacion = Date.now()
    if (proveedor.llamar) {
      try {
        const r = await proveedor.llamar(promptSistema, promptUsuario)
        planTexto = r.texto
        usoIA = r.uso ?? null
        modeloUsado = r.modelo ?? proveedor.modelo
      } catch (e) {
        console.error(`Error de ${proveedor.nombre}:`, e instanceof Error ? e.message.slice(0, 300) : e)
        throw new ErrorGeneracionPlan('IA_ERROR', 502, 'Error al generar el plan con IA')
      }
    } else {
      const response = await fetch(proveedor.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env[proveedor.claveEnv]}`,
        },
        body: JSON.stringify({
          model: proveedor.modelo,
          messages: [
            { role: 'system', content: promptSistema },
            { role: 'user', content: promptUsuario },
          ],
          response_format: { type: 'json_object' },
          ...(proveedor.razonamientoOpenAI ? { max_completion_tokens: proveedor.maxTokens ?? 6000 } : { temperature: 0.35, max_tokens: proveedor.maxTokens ?? 6000 }),
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        console.error(`Error de ${proveedor.nombre}:`, err.slice(0, 300))
        throw new ErrorGeneracionPlan('IA_ERROR', 502, 'Error al generar el plan con IA')
      }
      const ds = await response.json()
      planTexto = ds.choices?.[0]?.message?.content ?? ''
      usoIA = ds.usage ?? null
    }
    let planIA: Record<string, unknown>
    try {
      planIA = extraerJsonPlan(planTexto)
    } catch {
      throw new ErrorGeneracionPlan('IA_RESPUESTA_INVALIDA', 502, 'Respuesta IA no válida')
    }
    // Las claves K# del plan se resuelven a los estudios reales; una clave inventada se elimina y se cuenta (el modelo no puede atribuir ideas a estudios que no están).
    ;(planIA as Record<string, unknown>)._evidencia = resolverEvidenciaPlan(planIA, estudios)

    // Bucle de corrección: si el plan incumple las reglas del motor, se le devuelve a la IA con la lista de problemas (una vez, si queda tiempo).
    const evaluar = (plan: Record<string, unknown>) => {
      const ses = ((plan.sesiones as Record<string, unknown>[]) ?? []).map(x => ({
        nombre: String(x.nombre ?? ''), dia_semana: (x.dia_semana as string) ?? null, tipo_sesion: (x.tipo_sesion as string) ?? null,
        ritmo_objetivo: (x.ritmo_objetivo as string) ?? null, duracion_min: typeof x.duracion_min === 'number' ? x.duracion_min : null,
      }))
      const hay = ses.some(x => x.tipo_sesion === 'carrera' || /carrera|tirada|rodaje|tempo|series/i.test(x.nombre))
      return problemasDelPlan({
        hallazgos: [...(hay ? validarSemanaCarrera(ses, contextoValidacion).hallazgos : []), ...(esHibridoHyroxRunning ? validarHibridoHyrox((plan.sesiones as Record<string, unknown>[]) ?? [], faseBloqueObjetivo) : [])],
        sesiones: ses.length,
        sesionesEsperadas: esHibridoHyroxRunning ? 6 : null,
        evidencia: resolverEvidenciaPlan(plan, estudios),
        sinDiasEnTexto: esHibridoHyroxRunning,
      })
    }
    if (proveedor.llamar) {
      const antes = evaluar(planIA)
      if (antes.length > 0 && Date.now() - t0Generacion < MARGEN_PARA_CORREGIR_MS) {
        try {
          const r2 = await proveedor.llamar(promptSistema, promptDeReparacion(JSON.stringify(planIA), antes))
          const corregido = extraerJsonPlan(r2.texto)
          const despues = evaluar(corregido)
          // Solo se acepta la versión corregida si de verdad tiene menos problemas que la original.
          if (despues.length < antes.length) {
            planIA = corregido
            modeloUsado = r2.modelo ?? modeloUsado
            usoIA = { primera: usoIA, correccion: r2.uso ?? null }
          }
          reparaciones = { antes, despues }
        } catch (e) {
          console.error('Corrección del plan fallida:', e instanceof Error ? e.message.slice(0, 200) : e)
          reparaciones = { antes, despues: antes }
        }
      }
    }
    ;(planIA as Record<string, unknown>)._evidencia = resolverEvidenciaPlan(planIA, estudios)
    if (reparaciones) (planIA as Record<string, unknown>)._correccion = reparaciones

    // Reparto de días determinista (plan híbrido): la IA redacta las sesiones pero no decide el día de cada una. Las de carrera toman los días del
    // esqueleto del macrociclo y las híbridas se colocan alrededor con reglas fijas (pierna lejos de tirada/calidad, días disponibles, descanso).
    const diasDisponiblesPerfil = perfilEntreno?.dias_disponibles != null && String(perfilEntreno.dias_disponibles) !== '' ? Number(perfilEntreno.dias_disponibles) : null
    type SesionBruta = Record<string, unknown> & { nombre?: string; dia_semana?: string; tipo_sesion?: string; ejercicios?: { nombre?: string; bloque?: string }[] }
    const sesionesBrutas = (planIA.sesiones as SesionBruta[] | undefined) ?? []
    const esCarreraBruta = (x: SesionBruta) => x.tipo_sesion === 'carrera' || (x.tipo_sesion == null && /carrera|tirada|rodaje|tempo|series/i.test(String(x.nombre ?? '')) && !/h[ií]brid|hyrox/i.test(String(x.nombre ?? '')))
    const esqueletoSemana = macrociclo?.semanas[0] ?? null
    if (esHibridoHyroxRunning && esqueletoSemana && sesionesBrutas.length > 0) {
      const cambios: { nombre: string; de: string | null; a: string }[] = []
      const avisosReparto: string[] = []
      const carreras = sesionesBrutas.filter(esCarreraBruta)
      const hibridas = sesionesBrutas.filter(x => !esCarreraBruta(x))
      const tipoMacro = (t: string) => (t === 'strides' ? 'rodaje' : t === 'ritmo_carrera' ? 'tempo' : t)
      let runsFijos: { tipo: string; dia: number }[]
      if (carreras.length === esqueletoSemana.sesiones.length) {
        // Cada sesión de carrera de la IA toma el día de la del esqueleto de su mismo tipo (la más larga con la tirada).
        const libres = [...carreras]
        runsFijos = esqueletoSemana.sesiones.map(sk => {
          let i = libres.findIndex(c => tipoDeSesionCarrera({ nombre: String(c.nombre ?? '') }) === tipoMacro(sk.tipo))
          if (i < 0) i = libres.findIndex(c => tipoDeSesionCarrera({ nombre: String(c.nombre ?? '') }) === 'otra')
          if (i < 0) i = 0
          const c = libres.splice(i, 1)[0]
          const nuevo = DIAS_NOMBRE[sk.dia]
          if (c.dia_semana !== nuevo) cambios.push({ nombre: String(c.nombre ?? ''), de: c.dia_semana ?? null, a: nuevo })
          c.dia_semana = nuevo
          return { tipo: sk.tipo, dia: sk.dia }
        })
      } else {
        avisosReparto.push(`La IA devolvió ${carreras.length} sesiones de carrera y el esqueleto prevé ${esqueletoSemana.sesiones.length}: se respetan los días que puso la IA para la carrera.`)
        runsFijos = carreras.map(c => ({ tipo: tipoMacro(tipoDeSesionCarrera({ nombre: String(c.nombre ?? '') })), dia: diaNumero(c.dia_semana) })).filter(r => r.dia >= 0)
      }
      const rep = repartirHibridas(runsFijos, hibridas.map(h => ({ pierna: tieneTrabajoDePierna({ nombre: String(h.nombre ?? ''), ejercicios: h.ejercicios }), conCarrera: tieneCarreraTrasEstacion({ ejercicios: h.ejercicios }) })), diasDisponiblesPerfil)
      hibridas.forEach((h, i) => {
        const nuevo = DIAS_NOMBRE[rep.dias[i]]
        if (h.dia_semana !== nuevo) cambios.push({ nombre: String(h.nombre ?? ''), de: h.dia_semana ?? null, a: nuevo })
        h.dia_semana = nuevo
      })
      avisosReparto.push(...rep.avisos)
      ;(planIA as Record<string, unknown>)._reparto = { cambios, avisos: avisosReparto }
    }

    // Revisión determinista del plan de carrera generado (no lo corrige: dice qué no cuadra para que el coach lo vea).
    const sesionesGeneradas = ((planIA.sesiones as Record<string, unknown>[]) ?? []).map(x => ({
      nombre: String(x.nombre ?? ''), dia_semana: (x.dia_semana as string) ?? null, tipo_sesion: (x.tipo_sesion as string) ?? null,
      ritmo_objetivo: (x.ritmo_objetivo as string) ?? null, duracion_min: typeof x.duracion_min === 'number' ? x.duracion_min : null,
    }))
    const validacion = sesionesGeneradas.some(x => x.tipo_sesion === 'carrera' || /carrera|tirada|rodaje|tempo|series/i.test(x.nombre)) ? validarSemanaCarrera(sesionesGeneradas, contextoValidacion) : null
    if (validacion && esHibridoHyroxRunning) {
      validacion.hallazgos.push(...validarHibridoHyrox(sesionesBrutas, faseBloqueObjetivo))
      validacion.hallazgos.push(...validarRepartoSemana(sesionesBrutas.map(x => ({ nombre: String(x.nombre ?? ''), dia_semana: x.dia_semana ?? null, ejercicios: x.ejercicios, esCarrera: esCarreraBruta(x), tipoCarrera: esCarreraBruta(x) ? tipoDeSesionCarrera({ nombre: String(x.nombre ?? '') }) : undefined })), diasDisponiblesPerfil))
    }


    return {
      planIA,
      nombrePlan: esHibridoHyroxRunning ? `Híbrido Hyrox + Running — ${faseBloqueObjetivo}` : ((planIA.nombre_plan as string) ?? `Plan IA — ${modalidadFoco}`),
      duracionSemanas: esHibridoHyroxRunning ? 4 : normalizarDuracionSemanas(planIA.duracion_semanas),
      esHibrido: esHibridoHyroxRunning,
      faseBloque: esHibridoHyroxRunning ? faseBloqueObjetivo : null,
      modalidad: modalidadFoco,
      validacion,
      macrociclo,
      minutosRealesSemana: contextoValidacion.minutosRealesSemana,
      metadata: { rpe_promedio: rpePromedio, ajuste_rpe: ajusteRpe, modalidad: modalidadFoco, recomendacion_motor: recomendacion, papers_usados: estudios.length, generado_con: modeloUsado, uso: usoIA },
    }
}
