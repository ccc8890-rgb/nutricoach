import assert from 'node:assert/strict'
import { ritmoDeTexto, tipoDeSesionCarrera, validarSemanaCarrera, type SesionPlan } from '../lib/entrenos/validar-plan-carrera'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'

const r45 = ritmosDesdeVdot(45)! // E 5:54 · M 4:49 · T 4:38 · I 4:15 · R 3:52
const s = (nombre: string, dia: string, min: number, ritmo?: string): SesionPlan => ({ nombre, dia_semana: dia, tipo_sesion: 'carrera', duracion_min: min, ritmo_objetivo: ritmo })
const codigos = (ses: SesionPlan[], minReal: number | null = null) => validarSemanaCarrera(ses, { ritmos: r45, minutosRealesSemana: minReal }).hallazgos.map(h => h.codigo)

assert.equal(tipoDeSesionCarrera({ nombre: 'Carrera: Tirada Larga Aeróbica Z2' }), 'tirada')
assert.equal(tipoDeSesionCarrera({ nombre: 'Carrera: Series Cortas en Descarga' }), 'series')
assert.equal(tipoDeSesionCarrera({ nombre: 'Carrera: Tempo Run en Descarga' }), 'tempo')
assert.equal(tipoDeSesionCarrera({ nombre: 'Rodaje fácil' }), 'rodaje')
assert.equal(ritmoDeTexto('5:30/km Z2'), 330)
assert.equal(ritmoDeTexto('sin ritmo'), null)

// Semana razonable (5 salidas): sin hallazgos.
const buena = [s('Rodaje fácil', 'Lunes', 40, '6:00/km'), s('Series 6x800', 'Martes', 55, '4:15/km'), s('Rodaje fácil', 'Jueves', 45, '6:00/km'), s('Tempo 20 min', 'Viernes', 50, '4:40/km'), s('Tirada larga', 'Domingo', 75, '6:00/km')]
assert.deepEqual(codigos(buena), [])
const resumen = validarSemanaCarrera(buena, { ritmos: r45, minutosRealesSemana: null }).resumen
assert.deepEqual(resumen, { carrerasSemana: 5, minutosCarrera: 265, sesionesCalidad: 2, tiradaLargaMin: 75, tiradaLargaPct: 28 })

// Calidad seguida, demasiada calidad y calidad antes de la tirada.
assert.ok(codigos([s('Tempo', 'Martes', 50, '4:40/km'), s('Series', 'Miércoles', 50, '4:15/km'), s('Rodaje', 'Sábado', 40, '6:00/km'), s('Tirada larga', 'Domingo', 70, '6:00/km')]).includes('calidad_seguida'))
assert.ok(codigos([s('Tempo', 'Martes', 50, '4:40/km'), s('Series', 'Jueves', 50, '4:15/km'), s('Fartlek', 'Sábado', 50), s('Tirada larga', 'Domingo', 70, '6:00/km')]).includes('demasiada_calidad'), '3 de calidad con 4 salidas')
assert.ok(codigos([s('Rodaje', 'Martes', 40), s('Series', 'Sábado', 50, '4:15/km'), s('Tirada larga', 'Domingo', 70, '6:00/km')]).includes('calidad_antes_tirada'))
assert.ok(!codigos([s('Tempo', 'Martes', 50, '4:40/km'), s('Series', 'Jueves', 50, '4:15/km'), s('Rodaje', 'Viernes', 30), s('Tirada larga', 'Domingo', 70, '6:00/km'), s('Rodaje', 'Lunes', 30)]).includes('demasiada_calidad'), '2 de calidad con 5 salidas está bien')

// Tirada larga: más de 2 h 30 es error; el peso relativo depende de cuántas salidas haya.
assert.ok(codigos([s('Tirada larga', 'Domingo', 160, '6:00/km'), s('Rodaje', 'Martes', 45), s('Rodaje', 'Jueves', 45)]).includes('tirada_excesiva'))
assert.ok(!codigos([s('Rodaje', 'Martes', 45), s('Rodaje', 'Jueves', 45), s('Tirada larga', 'Domingo', 70, '6:00/km')]).includes('tirada_pesada'), '70/160 = 44 % con 3 salidas se tolera')
assert.ok(codigos([s('Rodaje', 'Martes', 30), s('Rodaje', 'Jueves', 30), s('Tirada larga', 'Domingo', 120, '6:00/km')]).includes('tirada_pesada'), '67 % con 3 salidas es demasiado')
assert.ok(codigos([s('Rodaje', 'Lunes', 30), s('Rodaje', 'Martes', 30), s('Rodaje', 'Jueves', 30), s('Rodaje', 'Viernes', 30), s('Tirada larga', 'Domingo', 90, '6:00/km')]).includes('tirada_pesada'), '43 % con 5 salidas es demasiado')

// Progresión sobre el volumen real: aviso desde el 20 %, error desde el 30 %.
const base = [s('Rodaje', 'Martes', 50), s('Rodaje', 'Jueves', 50)] // 100 min
assert.deepEqual(codigos(base, 100), [])
assert.deepEqual(codigos(base, 90), []) // 100 sobre 90 = +11 %: dentro
assert.deepEqual(codigos(base, 80), ['subida_volumen']) // +25 %
assert.deepEqual(codigos(base, 70), ['salto_volumen']) // +43 %
assert.deepEqual(codigos(base, null), []) // sin volumen real no se compara
assert.deepEqual(codigos(base, 120), []) // bajar volumen siempre vale

// Ritmos frente al VDOT 45 (E 5:54 · M 4:49 · T 4:38 · I 4:15 · R 3:52).
assert.ok(codigos([s('Rodaje fácil', 'Martes', 45, '4:40/km')]).includes('rodaje_rapido'), 'un rodaje a ritmo de umbral')
assert.ok(codigos([s('Tirada larga', 'Domingo', 70, '10:30/km')]).includes('rodaje_lento'), 'más lento que fácil +25 %')
assert.ok(!codigos([s('Rodaje fácil', 'Martes', 45, '5:50/km')]).includes('rodaje_rapido'))
assert.ok(codigos([s('Tempo', 'Jueves', 50, '5:30/km')]).includes('tempo_fuera_de_zona'), 'tempo a ritmo de rodaje')
assert.ok(codigos([s('Tempo', 'Jueves', 50, '3:50/km')]).includes('tempo_fuera_de_zona'), 'tempo a ritmo de repeticiones')
assert.ok(!codigos([s('Tempo', 'Jueves', 50, '4:40/km')]).includes('tempo_fuera_de_zona'))
assert.ok(codigos([s('Series 8x400', 'Martes', 50, '3:20/km')]).includes('series_fuera_de_zona'), 'imposible para su VDOT')
assert.ok(codigos([s('Series 6x1000', 'Martes', 55, '5:10/km')]).includes('series_fuera_de_zona'), 'series a ritmo de rodaje')
assert.ok(!codigos([s('Series 6x1000', 'Martes', 55, '4:15/km')]).includes('series_fuera_de_zona'))
// Sin VDOT no se comprueban ritmos.
assert.deepEqual(validarSemanaCarrera([s('Rodaje fácil', 'Martes', 45, '2:30/km')], { ritmos: null, minutosRealesSemana: null }).hallazgos, [])

// Las híbridas no cuentan como carrera.
const mixta = validarSemanaCarrera([{ nombre: 'Híbrida A: SkiErg + Fuerza', dia_semana: 'Lunes', tipo_sesion: 'hibrido', duracion_min: 60 }, s('Tirada larga', 'Domingo', 60, '6:00/km')], { ritmos: r45, minutosRealesSemana: null })
assert.equal(mixta.resumen.carrerasSemana, 1)
assert.equal(mixta.resumen.minutosCarrera, 60)
// Niveles: tirada excesiva y salto de volumen son errores; el resto, avisos.
const niveles = Object.fromEntries(validarSemanaCarrera([s('Tirada larga', 'Domingo', 170, '6:00/km')], { ritmos: r45, minutosRealesSemana: 100 }).hallazgos.map(h => [h.codigo, h.nivel]))
assert.equal(niveles.tirada_excesiva, 'error')
assert.equal(niveles.salto_volumen, 'error')
console.log('validar-plan-carrera.test OK')
