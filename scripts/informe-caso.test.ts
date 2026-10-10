import assert from 'node:assert/strict'
import { construirInformeCaso, ETIQUETA_ESCENARIO, type DatosInforme } from '../lib/informe-caso/construir'
import type { PayloadPlanEntrenoIA } from '../lib/entrenos/planificar-con-ia'

const atleta = (o: Partial<DatosInforme['atleta']> = {}): DatosInforme['atleta'] => ({
  hayDatos: true, minutosCarreraSemana: 89, salidasSemana: 3.5, pctSuave: 36, forma: 16, fatiga: 17.3, frescura: -1.3,
  sesionesCalidadPrevistas: 8, sesionesCalidadHechas: 6, retorno: false, vdot: 45, fuerzaRegistrada: 0, fuerzaEnPlan: 3, alertasAltas: [], ...o,
})
const plan = { nombre: 'Híbrido Hyrox + Running — Deload', semanaActual: 2, semanasTotales: 4, diasRestantes: 18 }
const analisis = {
  resumen: 'Carlos está en descarga con la forma en 16. El plan se ejecuta a medias.',
  alerta_prioritaria: null,
  decisiones: [
    { cambio: 'En los rodajes y la tirada larga, llevar el pulso por debajo de 158 ppm. Objetivo: llegar al 75 % del tiempo en suave en 6-8 semanas.', razon: 'Últimas 4 semanas: 36 % suave, 52 % medio y 12 % duro. Referencia: 75-80 % suave.', segura: true, riesgo: 'bajo' as const, fiabilidad: { nivel: 'alta' as const }, estudios: [{}, {}, {}, {}] },
    { cambio: 'La tirada larga (69 min) concentra el 78 % del tiempo semanal de carrera. No alargarla más.', razon: 'Con 3.5 salidas por semana una sola sesión carga con casi todo el volumen.', segura: false, riesgo: 'medio' as const, fiabilidad: { nivel: 'media' as const }, estudios: [] },
  ],
  preguntas_al_coach: ['¿Hace las sesiones de fuerza?'],
}
const propuesta = {
  modo: 'siguiente_bloque', fase_bloque: 'Base', nombre_plan: 'Híbrido — Base', duracion_semanas: 4, es_hibrido: true,
  plan: { sesiones: [{ nombre: 'Carrera: Rodaje', dia_semana: 'martes', duracion_min: 30 }] },
  macrociclo: { semanasHastaCarrera: null, ritmos: null, avisos: [], supuestos: [], datosFaltantes: [], parametros: { nivel: 'avanzado', salidasSemana: 3, volumenBase: 89, volumenPico: 158, crecimientoSemanal: 0.1, descargaCada: 4 },
    semanas: [{ n: 1, lunes: '2026-10-12', fase: 'base', descarga: false, minutos: 100, salidas: 3, tiradaMin: 40, pctSuave: 95, fuerza: 3, sesiones: [], notas: [] }],
    fundamentos: [{ regla: 'Sesión más larga +10 %', tipo: 'estudio', fuente: 'Frandsen 2025' }, { regla: 'Descarga cada 4 semanas', tipo: 'libro', fuente: 'Fitzgerald' }] },
  validacion: null, generado_en: '2026-10-10T10:00:00Z', contexto: { minutos_reales_semana: 89 },
} as PayloadPlanEntrenoIA
const base = (o: Partial<DatosInforme> = {}): DatosInforme => ({ nombre: 'Carlos Casanova Cordero', atleta: atleta(), plan, analisis: null, propuesta: null, ...o })

// Números del texto = números de los datos (tolerancia por redondeo)
const numerosDe = (t: string) => [...t.matchAll(/\d+(?:[.,]\d+)?/g)].map(m => Number(m[0].replace(',', '.')))
const permitidos = (d: DatosInforme) => [...JSON.stringify(d).matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]))
const sinInventar = (d: DatosInforme, textos: string[]) => {
  const ok = permitidos(d)
  for (const t of textos) for (const n of numerosDe(t)) assert.ok(ok.some(v => Math.abs(v - n) <= 0.06), `número «${n}» no sale de los datos en: ${t}`)
}
const textosDe = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(textosDe) : v && typeof v === 'object' ? Object.values(v).flatMap(textosDe) : [])
const limpio = (i: ReturnType<typeof construirInformeCaso>) => {
  const todo = textosDe(i).join(' | ')
  for (const feo of ['undefined', 'NaN', 'null', '[object']) assert.ok(!todo.includes(feo), `aparece «${feo}»`)
}

// ── Escenarios y prioridad ──
assert.equal(construirInformeCaso(base()).escenario, 'sin_cambios')
assert.equal(construirInformeCaso(base({ analisis })).escenario, 'ajustes')
assert.equal(construirInformeCaso(base({ analisis, propuesta })).escenario, 'propuesta_bloque')
assert.equal(construirInformeCaso(base({ analisis, propuesta, atleta: atleta({ alertasAltas: ['La carga sube demasiado deprisa'] }) })).escenario, 'alerta')
assert.equal(construirInformeCaso(base({ analisis: { ...analisis, alerta_prioritaria: 'Dolor reportado' } })).escenario, 'alerta')
assert.deepEqual(Object.keys(ETIQUETA_ESCENARIO).sort(), ['ajustes', 'alerta', 'propuesta_bloque', 'sin_cambios'])

// ── Cada escenario: mensaje, guion y sin números inventados ──
for (const [nombre, d] of Object.entries({
  sin_cambios: base(), ajustes: base({ analisis }), propuesta: base({ analisis, propuesta }),
  alerta: base({ analisis: { ...analisis, alerta_prioritaria: 'La fatiga sube más deprisa de lo normal' } }),
})) {
  const i = construirInformeCaso(d)
  assert.ok(i.mensaje.startsWith('Hola Carlos'), nombre)
  assert.ok(!i.mensaje.includes('Casanova'), 'solo el nombre de pila')
  assert.ok(i.mensaje.length <= 700, `${nombre}: ${i.mensaje.length} caracteres`)
  assert.ok(i.guion.length >= 5 && i.guion.every(g => g.paso && g.texto), nombre)
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(i.mensaje), 'sin emojis')
  sinInventar(d, [i.mensaje, ...i.guion.map(g => g.texto), ...i.cambios])
  limpio(i)
}

// ── Contenido por escenario ──
const sc = construirInformeCaso(base())
assert.match(sc.mensaje, /seguimos con tu plan/)
assert.match(sc.mensaje, /89 minutos por semana/)
assert.match(sc.mensaje, /36 % del tiempo/)
assert.match(sc.mensaje, /De las 8 sesiones de calidad previstas has hecho 6/)
assert.ok(sc.situacion.datos.some(x => x.etiqueta === 'Sesiones de calidad' && x.valor === '6 de 8 hechas'))
assert.deepEqual(sc.cambios, ['Nada cambia por ahora: sigue con el plan actual.'])
const aj = construirInformeCaso(base({ analisis }))
assert.match(aj.mensaje, /Te propongo/)
assert.equal(aj.cambios.length, 2)
assert.ok(aj.porQue.some(p => p.origen.includes('4 estudios')))
const pr = construirInformeCaso(base({ analisis, propuesta }))
assert.match(pr.mensaje, /siguiente bloque/)
assert.match(pr.mensaje, /de 89 a 100 min/)
assert.ok(pr.cambios.some(c => c.includes('de 89 a 100 min')))
assert.ok(pr.porQue.some(p => p.origen.startsWith('Estudio')))
const al = construirInformeCaso(base({ analisis: { ...analisis, alerta_prioritaria: 'La fatiga sube más deprisa de lo normal' } }))
assert.match(al.mensaje, /La fatiga sube más deprisa de lo normal/)
assert.match(al.mensaje, /llamada/)
assert.ok(!al.mensaje.includes('Te propongo'), 'en una alerta no se propone nada que el sistema no sepa')

// ── El mensaje al cliente: las acciones completas, solo lo dirigido al cliente, lo más seguro primero ──
assert.match(aj.mensaje, /No alargarla más/, 'incluye la acción, no solo el diagnóstico')
const conCoach = construirInformeCaso(base({ analisis: { ...analisis, decisiones: [...analisis.decisiones, { cambio: 'Confirmar si las sesiones de fuerza se hacen y se registran.', razon: 'Sin registro no se mide.', segura: false, riesgo: 'bajo' as const }] } }))
assert.ok(!conCoach.mensaje.includes('Confirmar'), 'lo dirigido al coach no va en el mensaje al cliente')
assert.ok(conCoach.cambios.some(c => c.includes('Confirmar')), 'pero sí en el resumen del coach')
assert.ok(aj.mensaje.indexOf('158 ppm') < aj.mensaje.indexOf('No alargarla'), 'la decisión segura va antes')
const soloCoach = construirInformeCaso(base({ analisis: { ...analisis, decisiones: [{ cambio: 'Confirmar si hace la fuerza.', razon: 'x', riesgo: 'bajo' as const }] } }))
assert.match(soloCoach.mensaje, /no cambiamos nada/, 'sin ajustes para el cliente, el mensaje no inventa ninguno')
assert.ok(!soloCoach.mensaje.includes('Te propongo'))
limpio(soloCoach)

// ── Acción completa aunque la frase sea larga; sin mayúscula a mitad de frase ──
const real = 'La tirada larga (69 min) concentra el 78 % del tiempo semanal de carrera. No alargarla más y repartir mejor: añadir una salida suave de 30-40 minutos (sin día libre, 20-30 minutos de rodaje suave a continuación de una sesión de fuerza) o acortar ligeramente la tirada, hasta que pese menos del 50 %.'
const iLarga = construirInformeCaso(base({ analisis: { ...analisis, decisiones: [analisis.decisiones[0], { ...analisis.decisiones[1], cambio: real }] } }))
assert.match(iLarga.mensaje, /No alargarla más y repartir mejor[.]/)
assert.ok(!iLarga.mensaje.includes('añadir una salida'), 'el detalle largo no va en el mensaje')
assert.ok(!iLarga.mensaje.includes('Además, La'), 'sin mayúscula a mitad de frase')
assert.match(iLarga.mensaje, /Además, la tirada larga/)

// ── Preguntas: las del cliente y las del coach, separadas y sin repetir ──
assert.ok(!aj.preguntas.includes('¿Hace las sesiones de fuerza?'), 'las preguntas del análisis son para el coach')
assert.deepEqual(aj.preguntasCoach, ['¿Hace las sesiones de fuerza?'])
assert.equal(aj.preguntas.filter(q => /fuerza/i.test(q)).length, 1, 'la de la fuerza no sale dos veces')
const conPreguntaFuerza = construirInformeCaso(base({ analisis: { ...analisis, preguntas_al_coach: ['¿Las sesiones híbridas y de fuerza se están haciendo?'] } }))
assert.equal(conPreguntaFuerza.preguntas.filter(q => /fuerza/i.test(q)).length, 1, 'si el análisis ya pregunta por la fuerza, la nuestra para el cliente sigue siendo una sola')
assert.deepEqual(construirInformeCaso(base()).preguntasCoach, [])

// ── Situación (dónde está) y «lo que no sé» ──
const etiquetas = sc.situacion.datos.map(x => x.etiqueta)
assert.ok(etiquetas.includes('Carrera') && etiquetas.includes('Tiempo en suave') && etiquetas.includes('Forma y fatiga'))
assert.ok(sc.loQueNoSe.some(x => x.includes('fuerza')), 'sin fuerza registrada se declara')
assert.equal(sc.plan, 'Híbrido Hyrox + Running — Deload · semana 2 de 4')

// ── Sin datos de ningún tipo: no revienta y lo dice ──
const vacio = base({ atleta: atleta({ hayDatos: false, minutosCarreraSemana: null, salidasSemana: null, pctSuave: null, forma: null, fatiga: null, frescura: null, sesionesCalidadPrevistas: null, sesionesCalidadHechas: null, vdot: null, fuerzaEnPlan: 0 }), plan: null })
const iv = construirInformeCaso(vacio)
limpio(iv)
assert.equal(iv.escenario, 'sin_cambios')
assert.equal(iv.plan, null)
assert.ok(iv.loQueNoSe.length >= 3)
assert.ok(iv.loQueNoSe.some(x => x.includes('reloj')) && iv.loQueNoSe.some(x => x.includes('plan')) && iv.loQueNoSe.some(x => x.includes('VDOT')))
assert.ok(iv.mensaje.startsWith('Hola Carlos'))
assert.ok(iv.situacion.datos.length === 0)

// ── Texto largo: el mensaje no pasa de 700 caracteres ──
const larga = 'Una frase larguísima que no acaba nunca y sigue y sigue con más detalle del necesario '.repeat(8)
const il = construirInformeCaso(base({ analisis: { ...analisis, decisiones: [{ ...analisis.decisiones[0], cambio: larga }, { ...analisis.decisiones[1], cambio: larga }] } }))
assert.ok(il.mensaje.length <= 700, String(il.mensaje.length))

// ── Nombre raro ──
assert.ok(construirInformeCaso(base({ nombre: '   ' })).mensaje.startsWith('Hola,'))

console.log('informe-caso.test OK')
