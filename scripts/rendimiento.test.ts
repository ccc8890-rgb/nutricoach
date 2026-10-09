import assert from 'node:assert/strict'
import { calcularTss, velocidadUmbralMs } from '../lib/rendimiento/carga'
import { serieCarga, resumenCarga, estadoForma } from '../lib/rendimiento/pmc'

const u = { fcUmbral: 176, fcMax: 194, velUmbralMs: 3.69 }

// Garmin guarda la velocidad en décimas de m/s
assert.equal(velocidadUmbralMs(0.369443), 3.69443)
assert.equal(velocidadUmbralMs(3.7), 3.7)
assert.equal(velocidadUmbralMs(null), null)

// Una hora justo al ritmo de umbral = 100 TSS
const hora = calcularTss({ tipo: 'running', duracion_s: 3600, velocidadMs: 3.69, fc_media: null, tiempo_zona_fc: null }, u)
assert.equal(hora?.metodo, 'ritmo')
assert.equal(Math.round(hora!.tss), 100)

// Media hora a ritmo suave (2,9 m/s ≈ 5:45/km) pesa mucho menos
const suave = calcularTss({ tipo: 'running', duracion_s: 1800, velocidadMs: 2.9, fc_media: null, tiempo_zona_fc: null }, u)
assert.ok(suave!.tss > 20 && suave!.tss < 40, `suave ${suave!.tss}`)

// Serie con pausas: el ritmo medio es bajo pero el pulso en Z4-Z5 la delata; gana la lectura mayor
const series = calcularTss({ tipo: 'track_running', duracion_s: 2281, velocidadMs: 3.19, fc_media: 175, tiempo_zona_fc: [9, 17, 98, 683, 1471] }, u)
assert.equal(series?.metodo, 'pulso')
assert.ok(series!.tss > 50 && series!.tss < 90, `series ${series!.tss}`)

// En cinta el ritmo no es fiable (10 km en 31 min): se usa solo el pulso
const cinta = calcularTss({ tipo: 'treadmill_running', duracion_s: 1883, velocidadMs: 5.3, fc_media: 153, tiempo_zona_fc: null }, u)
assert.equal(cinta?.metodo, 'pulso')
assert.ok(cinta!.tss < 60, `cinta ${cinta!.tss}`)

// Sin ritmo ni pulso: estimación por duración
const sin = calcularTss({ tipo: 'strength_training', duracion_s: 3600, velocidadMs: null, fc_media: null, tiempo_zona_fc: null }, u)
assert.equal(sin?.metodo, 'duracion')
assert.equal(sin?.tss, 40)
// Fuerza con RPE: el pulso del gimnasio infravalora y gana el esfuerzo percibido (60 min a RPE 7 ≈ 49)
const fuerzaRpe = calcularTss({ tipo: 'strength_training', duracion_s: 3600, velocidadMs: null, fc_media: 97, tiempo_zona_fc: null, rpe: 7 }, u)
assert.equal(fuerzaRpe?.metodo, 'rpe')
assert.equal(fuerzaRpe?.tss, 49)
const fuerzaSinRpe = calcularTss({ tipo: 'strength_training', duracion_s: 3600, velocidadMs: null, fc_media: 97, tiempo_zona_fc: null }, u)
assert.equal(fuerzaSinRpe?.metodo, 'pulso')
assert.ok(fuerzaSinRpe!.tss < fuerzaRpe!.tss)
// RPE fuera de rango o nulo se ignora
assert.equal(calcularTss({ tipo: 'strength_training', duracion_s: 3600, velocidadMs: null, fc_media: null, tiempo_zona_fc: null, rpe: 11 }, u)?.metodo, 'duracion')
assert.equal(calcularTss({ tipo: 'strength_training', duracion_s: 3600, velocidadMs: null, fc_media: null, tiempo_zona_fc: null, rpe: null }, u)?.metodo, 'duracion')
assert.equal(calcularTss({ tipo: 'running', duracion_s: 0, velocidadMs: 3, fc_media: 150, tiempo_zona_fc: null }, u), null)

// Curva de forma/fatiga: 100 TSS diarios durante 60 días converge hacia 100 y la fatiga lo hace antes
const dias = Array.from({ length: 60 }, (_, i) => ({ fecha: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10), tss: 100 }))
const serie = serieCarga(dias, '2026-08-01', '2026-09-29')
assert.equal(serie.length, 60)
const ult = serie[serie.length - 1]
assert.ok(ult.atl > 99.5 && ult.ctl > 70 && ult.ctl < 80, `ctl ${ult.ctl} atl ${ult.atl}`)
assert.ok(ult.atl > ult.ctl)

// Días sin entreno se rellenan a 0 y la serie es continua
const huecos = serieCarga([{ fecha: '2026-10-01', tss: 80 }, { fecha: '2026-10-04', tss: 60 }], '2026-10-01', '2026-10-06')
assert.equal(huecos.length, 6)
assert.equal(huecos[1].tss, 0)
assert.equal(huecos[0].tsb, 0)

// Resumen: un descanso tras carga alta da frescura positiva
const descanso = serieCarga(
  [...dias.slice(0, 40)],
  '2026-08-01',
  '2026-09-18',
)
const res = resumenCarga(descanso)!
assert.ok(res.tsb > 0 && res.carga7d === 0) // 9 días de descanso tras carga constante: llega fresco
assert.equal(res.monotonia, null) // sin variación (todo ceros): no hay monotonía que medir
const cargado = resumenCarga(serie)!
assert.ok(cargado.tsb < 0 && cargado.carga7d === 700)
assert.equal(cargado.monotonia, null) // carga constante: desviación 0
assert.equal(estadoForma(-35).estado, 'sobrecarga')
assert.equal(estadoForma(-20).estado, 'productivo')
assert.equal(estadoForma(0).estado, 'neutral')
assert.equal(estadoForma(10).estado, 'fresco')
assert.equal(estadoForma(30).estado, 'transicion')
assert.equal(resumenCarga([]), null)

console.log('rendimiento: OK')

// ── Panel ──
import { construirPanel, agruparSemanas, lunesDe, type EntrenoPanel } from '../lib/rendimiento/panel'
const e = (fecha: string, tss: number, extra: Partial<EntrenoPanel> = {}): EntrenoPanel => ({
  fecha, tipo: 'running', nombre: null, duracion_s: 3000, distancia_m: 10000, ritmo_medio_s_km: 300, fc_media: 150,
  tss, tss_metodo: 'pulso', carga_garmin: null, vo2max: null, tiempo_zona_fc: null, mejores_parciales: null, raw: null, ...extra,
})
assert.equal(lunesDe('2026-10-09'), '2026-10-05') // viernes → lunes
assert.equal(lunesDe('2026-10-04'), '2026-09-28') // domingo → lunes anterior
const sem = agruparSemanas([e('2026-10-05', 60), e('2026-10-08', 40, { tipo: 'strength_training' })], 3, '2026-10-09')
assert.equal(sem.length, 3)
assert.equal(sem[2].tss, 100)
assert.equal(sem[2].km, 10) // la fuerza no suma km
assert.equal(sem[2].sesiones, 2)
assert.equal(sem[0].tss, 0)
const panel = construirPanel(
  [
    e('2026-10-01', 50, { mejores_parciales: { s1000: 270, s1609: null, s5000: 1400 } }),
    e('2026-10-06', 70, { tipo: 'treadmill_running' }),
  ],
  [],
  '2026-10-09',
  30,
)
assert.equal(panel.serie[panel.serie.length - 1].fecha, '2026-10-09')
assert.equal(panel.parciales.length, 1)
assert.equal(panel.eficiencia.length, 1) // la cinta no cuenta
assert.ok(panel.resumen && panel.resumen.carga7d === 70)
console.log('panel: OK')

// ── Alertas ──
import { calcularAlertas } from '../lib/rendimiento/alertas'
const rs = (p: Partial<NonNullable<ReturnType<typeof resumenCarga>>>) => ({ ctl: 30, atl: 30, tsb: 0, rampa7: 0, carga7d: 200, carga28d: 800, monotonia: 1, tension: 200, estado: 'neutral' as const, textoEstado: '', ...p })
const sm = (tss: number, sesiones = 3) => ({ semana: '2026-01-01', tss, km: 20, sesiones, minutos: 200 })
const codigos = (x: ReturnType<typeof calcularAlertas>) => x.map(a => a.codigo)
assert.deepEqual(calcularAlertas({ resumen: null, semanas: [], diasParaCompeticion: null }), [])
assert.deepEqual(codigos(calcularAlertas({ resumen: rs({}), semanas: [sm(200), sm(210), sm(100)], diasParaCompeticion: null })), [])
assert.ok(codigos(calcularAlertas({ resumen: rs({ rampa7: 9 }), semanas: [], diasParaCompeticion: null })).includes('rampa_alta'))
assert.ok(codigos(calcularAlertas({ resumen: rs({ rampa7: 6 }), semanas: [], diasParaCompeticion: null })).includes('rampa_vigilar'))
assert.ok(codigos(calcularAlertas({ resumen: rs({ tsb: -35 }), semanas: [], diasParaCompeticion: null })).includes('fatiga_alta'))
assert.ok(codigos(calcularAlertas({ resumen: rs({ tsb: -15 }), semanas: [], diasParaCompeticion: 9 })).includes('llega_cansado'))
assert.ok(!codigos(calcularAlertas({ resumen: rs({ tsb: -15 }), semanas: [], diasParaCompeticion: 40 })).includes('llega_cansado'))
assert.ok(codigos(calcularAlertas({ resumen: rs({ tsb: 30 }), semanas: [], diasParaCompeticion: null })).includes('destrenando'))
assert.ok(!codigos(calcularAlertas({ resumen: rs({ tsb: 30 }), semanas: [], diasParaCompeticion: 5 })).includes('destrenando')) // el tapering es intencionado
assert.ok(codigos(calcularAlertas({ resumen: rs({ monotonia: 2.4 }), semanas: [], diasParaCompeticion: null })).includes('monotonia'))
// la última semana está en curso: el salto se mide entre las dos completas
assert.ok(codigos(calcularAlertas({ resumen: rs({}), semanas: [sm(100), sm(150), sm(20)], diasParaCompeticion: null })).includes('salto_semanal'))
assert.ok(codigos(calcularAlertas({ resumen: rs({}), semanas: [sm(0, 0), sm(0, 0), sm(0, 0), sm(0, 0), sm(50)], diasParaCompeticion: null })).includes('inactividad'))
assert.ok(codigos(calcularAlertas({ resumen: rs({}), semanas: [], diasParaCompeticion: null, rhr: { reciente: 58, base: 51 } })).includes('rhr_alto'))
assert.ok(codigos(calcularAlertas({ resumen: rs({}), semanas: [], diasParaCompeticion: null, pctIntenso28d: 50 })).includes('demasiada_intensidad'))
console.log('alertas: OK')

// ── Cumplimiento ──
import { evaluarCumplimiento, repsPlanificadas, emparejarEntreno, fechaDeLaSemana } from '../lib/rendimiento/cumplimiento'
import { esCarrera } from '../lib/rendimiento/carga'
import type { Paso } from '../lib/entrenos/pasos'
const pasosSeries: Paso[] = [
  { tipo: 'calentamiento', duracion: { unidad: 'metros', valor: 2000 } },
  { tipo: 'repetir', veces: 7, pasos: [
    { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 400 }, objetivo: { tipo: 'ritmo', min_seg_km: 255, max_seg_km: 270 } },
    { tipo: 'recuperacion', duracion: { unidad: 'metros', valor: 200 } },
  ] },
  { tipo: 'enfriamiento', duracion: { unidad: 'metros', valor: 2000 } },
]
assert.equal(repsPlanificadas(pasosSeries).length, 7)
const vuelta = (tipo: string, d: number, t: number) => ({ tipo, paso: null, distancia_m: d, duracion_s: t, fc_media: 160, velocidad_ms: d / t })
// 400 m en 104 s = 4:20/km (dentro de 4:15-4:30); 400 m en 120 s = 5:00/km (lenta); 400 m en 96 s = 4:00/km (rápida)
const buena = evaluarCumplimiento(pasosSeries, [vuelta('WARMUP', 2000, 700), ...Array.from({ length: 7 }, () => [vuelta('ACTIVE', 400, 104), vuelta('RECOVERY', 200, 80)]).flat()], null)!
assert.equal(buena.estado, 'cumplida')
assert.equal(buena.repsHechas, 7)
assert.equal(buena.repsEnRango, 7)
assert.equal(buena.caidaS, 0)
const fade = evaluarCumplimiento(pasosSeries, [104, 104, 108, 112, 116, 120, 124].map(t => vuelta('ACTIVE', 400, t)), null)!
assert.ok(fade.caidaS! > 30, `caída ${fade.caidaS}`)
assert.ok(fade.repsEnRango < 7)
assert.match(fade.resumen, /cae/)
const rapida = evaluarCumplimiento(pasosSeries, [vuelta('ACTIVE', 400, 96)], null)!
assert.equal(rapida.reps[0].estado, 'rapida')
assert.ok(rapida.reps[0].desvio_s_km < 0)
assert.equal(rapida.estado, 'no_cumplida') // 1 de 7
assert.equal(evaluarCumplimiento(pasosSeries, [vuelta('INTERVAL', 1000, 300)], null), null) // rodaje libre: sin repeticiones marcadas
assert.equal(evaluarCumplimiento(pasosSeries, null, null), null)
assert.equal(evaluarCumplimiento(pasosSeries, [vuelta('ACTIVE', 50, 20)], null), null) // vuelta de ruido
// Bloque continuo previsto (tempo 20 min a 5:00 ± 5 s) ejecutado como 6×500 m a 4:49: se evalúa como bloque
const pasosTempo: Paso[] = [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 1200 }, objetivo: { tipo: 'ritmo', min_seg_km: 295, max_seg_km: 305 } }]
const tempo = evaluarCumplimiento(pasosTempo, [147, 134, 139, 140, 147, 160].map(t => vuelta('ACTIVE', 500, t)), null)!
assert.equal(tempo.repsPlanificadas, 1)
assert.equal(tempo.reps.length, 1)
assert.equal(tempo.estado, 'parcial') // solo 14 de 20 min, y algo más rápido
assert.match(tempo.resumen, /6 tramos/)
assert.deepEqual(tempo.tramos, [294, 268, 278, 280, 294, 320]) // el ritmo de cada tramo se conserva (se ve la caída)
const tempoOk = evaluarCumplimiento(pasosTempo, [vuelta('ACTIVE', 4000, 1200)], null)! // 4 km en 20 min = 5:00/km
assert.equal(tempoOk.estado, 'cumplida')
// Emparejar con el día previsto
const e1 = { fecha: '2026-10-12', tipo: 'running', duracion_s: 2800, vueltas: null, raw: null }
const e2 = { fecha: '2026-10-13', tipo: 'running', duracion_s: 3000, vueltas: null, raw: null }
assert.equal(fechaDeLaSemana('2026-10-12', 'Lunes'), '2026-10-12')
assert.equal(fechaDeLaSemana('2026-10-12', 'Domingo'), '2026-10-18')
assert.equal(fechaDeLaSemana('2026-10-12', 'xx'), null)
assert.equal(emparejarEntreno('2026-10-12', '2026-10-20', [e1, e2], esCarrera).estado, 'hecha')
assert.equal(emparejarEntreno('2026-10-14', '2026-10-20', [e1, e2], esCarrera).estado, 'otro_dia') // el 13 está a un día
assert.equal(emparejarEntreno('2026-10-16', '2026-10-20', [e1, e2], esCarrera).estado, 'saltada')
assert.equal(emparejarEntreno('2026-10-25', '2026-10-20', [e1, e2], esCarrera).estado, 'pendiente')
assert.equal(emparejarEntreno('2026-10-12', '2026-10-20', [{ ...e1, tipo: 'strength_training' }], esCarrera).estado, 'saltada') // la fuerza no cuenta como carrera
console.log('cumplimiento: OK')

// ── Barandillas de cambios de la IA ──
import { validarCambioPasos } from '../lib/rendimiento/cambio-sesion'
const mk = (veces: number, metros: number, min: number, max: number): Paso[] => [
  { tipo: 'calentamiento', duracion: { unidad: 'metros', valor: 2000 } },
  { tipo: 'repetir', veces, pasos: [
    { tipo: 'trabajo', duracion: { unidad: 'metros', valor: metros }, objetivo: { tipo: 'ritmo', min_seg_km: min, max_seg_km: max } },
    { tipo: 'recuperacion', duracion: { unidad: 'metros', valor: 200 } },
  ] },
  { tipo: 'enfriamiento', duracion: { unidad: 'metros', valor: 2000 } },
]
assert.equal(validarCambioPasos(mk(7, 400, 255, 270), mk(5, 400, 262, 275), null).ok, true) // recortar reps y relajar ritmo
const absurdo = validarCambioPasos(mk(7, 400, 255, 270), mk(7, 400, 100, 110), null)
assert.equal(absurdo.ok, false) // 1:40/km no es humano
const ancho = validarCambioPasos(mk(7, 400, 255, 270), mk(7, 400, 250, 300), null)
assert.equal(ancho.ok, false) // rango de 50 s
const enorme = validarCambioPasos(mk(7, 400, 255, 270), mk(40, 1000, 255, 270), null)
assert.equal(enorme.ok, false) // volumen disparado
const diminuto = validarCambioPasos(mk(7, 400, 255, 270), [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 400 } }], null)
assert.equal(diminuto.ok, false) // la sesión casi desaparece
assert.equal(validarCambioPasos(mk(7, 400, 255, 270), 'texto', null).ok, false)
assert.equal(validarCambioPasos(null, mk(7, 400, 255, 270), null).ok, true) // sin pasos previos solo se valida el formato
import { sinCambios } from '../lib/rendimiento/aplicar-decision'
assert.equal(sinCambios(mk(7, 400, 255, 270), mk(7, 400, 255, 270)), true)
const conNota = JSON.parse(JSON.stringify(mk(7, 400, 255, 270))); conNota[0].nota = 'Trote suave'
assert.equal(sinCambios(conNota, mk(7, 400, 255, 270)), true) // solo cambian las notas
assert.equal(sinCambios({ b: 1, a: 2 }, { a: 2, b: 1 }), true) // el orden de las claves no importa
assert.equal(sinCambios(mk(7, 400, 255, 270), mk(6, 400, 255, 270)), false)
assert.equal(sinCambios(mk(7, 400, 255, 270), mk(7, 400, 255, 272)), false)
console.log('cambio-sesion: OK')

// ── VDOT desde esfuerzos reales ──
import { vdotDeMarca, vdotDeUmbral, esfuerzosVdot, recalibrar } from '../lib/rendimiento/vdot'
// Tablas de Daniels: 5K en 20:00 ≈ VDOT 49,8; 10K en 40:00 ≈ 51,9; 5K en 21:25 ≈ 45
assert.ok(Math.abs(vdotDeMarca(5000, 1200)! - 49.8) < 0.3, `5K 20:00 → ${vdotDeMarca(5000, 1200)}`)
assert.ok(Math.abs(vdotDeMarca(10000, 2400)! - 51.9) < 0.4, `10K 40:00 → ${vdotDeMarca(10000, 2400)}`)
assert.ok(vdotDeMarca(5000, 1300)! < vdotDeMarca(5000, 1200)!) // más lento = menos VDOT
assert.ok(Math.abs(vdotDeMarca(5000, 1297)! - 45.4) < 0.4, `5K 21:37 → ${vdotDeMarca(5000, 1297)}`) // el 5K de Copenhague
assert.equal(vdotDeMarca(0, 100), null)
assert.ok(Math.abs(vdotDeUmbral(3.69)! - 46.5) < 0.5)
assert.equal(vdotDeUmbral(null), null)

const umb = { fcUmbral: 176, fcMax: 194, velUmbralMs: 3.69 }
const base = { tipo: 'running', mejores_parciales: null, vueltas: null }
const carrera5k = { ...base, fecha: '2026-09-19', duracion_s: 1315, distancia_m: 5079, fc_media: 180 } // la carrera de Copenhague
const rodaje = { ...base, fecha: '2026-09-27', duracion_s: 4166, distancia_m: 12008, fc_media: 159 } // suave: no cuenta
const cintaV = { ...base, tipo: 'treadmill_running', fecha: '2026-10-02', duracion_s: 1883, distancia_m: 9966, fc_media: 175 } // distancia falsa
const seriesV = { ...base, fecha: '2026-10-08', duracion_s: 2871, distancia_m: 9018, fc_media: 176, vueltas: Array.from({ length: 6 }, () => [{ tipo: 'ACTIVE', paso: 1, distancia_m: 500, duracion_s: 140, fc_media: 165, velocidad_ms: 3.5 }, { tipo: 'RECOVERY', paso: 2, distancia_m: 170, duracion_s: 60, fc_media: 162, velocidad_ms: 2.8 }]).flat() }
// Series con vueltas manuales (sin tipo de paso): rápidas y lentas alternadas
const pistaManual = { ...base, fecha: '2026-09-24', duracion_s: 2281, distancia_m: 7270, fc_media: 175, vueltas: [3.9, 2.5, 4.1, 2.4, 4.0, 2.6, 3.9, 2.5].map((v, i) => ({ tipo: 'INTERVAL', paso: null, distancia_m: 400, duracion_s: 400 / v, fc_media: 170, velocidad_ms: v })) }
assert.equal(esfuerzosVdot([pistaManual], umb, '2026-10-09').length, 0)
// Una carrera continua con vueltas parejas sí cuenta
const continua = { ...carrera5k, vueltas: [3.9, 3.85, 3.8, 3.9, 3.95, 3.7].map(v => ({ tipo: 'INTERVAL', paso: null, distancia_m: 1000, duracion_s: 1000 / v, fc_media: 178, velocidad_ms: v })) }
assert.equal(esfuerzosVdot([continua], umb, '2026-10-09').length, 1)
const largo = { ...base, fecha: '2026-10-05', duracion_s: 3000, distancia_m: 10000, fc_media: 172, mejores_parciales: { s1000: 270, s1609: null, s5000: 1380 } }
const ef = esfuerzosVdot([carrera5k, rodaje, cintaV, seriesV], umb, '2026-10-09')
assert.equal(ef.length, 1) // solo la carrera: el rodaje es suave, la cintaV no fía y las seriesV son intervalos
assert.ok(ef[0].vdot > 44.5 && ef[0].vdot < 46, `vdot carrera ${ef[0].vdot}`)
assert.equal(esfuerzosVdot([carrera5k], { ...umb, fcUmbral: null }, '2026-10-09').length, 0)
assert.equal(esfuerzosVdot([{ ...carrera5k, fecha: '2025-01-01' }], umb, '2026-10-09').length, 0) // demasiado antigua
assert.equal(esfuerzosVdot([largo], umb, '2026-10-09').length, 2) // toda la salida + su mejor tramo de 5K

const subir = recalibrar(40, [carrera5k], umb, '2026-10-09')
assert.equal(subir.sugerencia, 'subir')
assert.equal(subir.propuesta, 45.5)
assert.equal(subir.confianza, 'alta') // hace 20 días y a tope
const igual = recalibrar(45, [carrera5k], umb, '2026-10-09')
assert.equal(igual.sugerencia, 'mantener')
assert.equal(igual.propuesta, null)
const nada = recalibrar(45, [rodaje], umb, '2026-10-09')
assert.equal(nada.sugerencia, 'sin_evidencia') // jamás se baja el VDOT por falta de pruebas
const bajo = recalibrar(50, [carrera5k], umb, '2026-10-09')
assert.equal(bajo.sugerencia, 'mantener')
assert.equal(bajo.propuesta, null)
assert.match(bajo.motivo, /no hay base para bajarlo/)
assert.equal(recalibrar(null, [carrera5k], umb, '2026-10-09').sugerencia, 'subir') // sin VDOT previo se propone el estimado
console.log('vdot: OK')

// ── Plan hacia un objetivo ──
import { generarPlan, tiempoParaVdot, type PlanObjetivo } from '../lib/rendimiento/plan-objetivo'
import { validarPasos } from '../lib/entrenos/pasos'
// La inversa de la fórmula devuelve el tiempo del que salió el VDOT
for (const [d, t] of [[5000, 1300], [10000, 2640], [21097, 5700], [42195, 12600]] as const) {
  const v = vdotDeMarca(d, t)!
  assert.ok(Math.abs(tiempoParaVdot(d, v) - t) <= Math.max(10, t * 0.003), `inversa ${d} → ${tiempoParaVdot(d, v)} vs ${t}`)
}
const entradaPlan = { hoy: '2026-10-09', objetivo: { distancia_m: 10000, tiempo_s: 2640, fecha: '2026-12-20' }, vdot: 45, cargaSemanalActual: 150, kmSemanaActual: 25, tiradaMaxKm: 12 }
const plan = generarPlan(entradaPlan) as PlanObjetivo
assert.ok(!('error' in plan))
// 09-10 es viernes: arranca el lunes 12-10; la carrera cae en la semana del 14-12 → 10 semanas
assert.equal(plan.semanas.length, 10)
assert.equal(plan.semanas[0].lunes, '2026-10-12')
assert.equal(plan.semanas[9].fase, 'carrera')
assert.equal(plan.semanas[9].lunes, '2026-12-14')
const fases = plan.semanas.map(s => s.fase)
assert.deepEqual(fases.slice(0, 1), ['base'])
assert.ok(fases.includes('construccion') && fases.includes('especifica') && fases.includes('taper'))
// el orden de las fases nunca retrocede
const orden = ['base', 'construccion', 'especifica', 'taper', 'carrera']
for (let i = 1; i < fases.length; i++) assert.ok(orden.indexOf(fases[i]) >= orden.indexOf(fases[i - 1]), `fases ${fases.join(',')}`)
// descarga cada cuarta semana fuera del taper, y esa semana carga menos que la anterior
const descargas = plan.semanas.filter(s => s.descarga)
assert.ok(descargas.length >= 1 && descargas.every(s => s.n % 4 === 0))
for (const s of descargas) {
  assert.ok(s.tssObjetivo < plan.semanas[s.n - 2].tssObjetivo)
  assert.ok(s.kmObjetivo <= plan.semanas[s.n - 2].kmObjetivo * 0.85, `descarga km ${s.kmObjetivo} vs ${plan.semanas[s.n - 2].kmObjetivo}`) // la descarga se nota también en los km
}
// la carga no sube más de ~10 % de una semana normal a la siguiente
for (let i = 1; i < plan.semanas.length; i++) {
  const a = plan.semanas[i - 1], b = plan.semanas[i]
  if (!a.descarga && b.fase !== 'taper' && b.fase !== 'carrera') assert.ok(b.tssObjetivo <= a.tssObjetivo * 1.1 + 5, `salto ${a.tssObjetivo} → ${b.tssObjetivo}`)
}
// en el taper se recorta el volumen y la carrera pesa menos que la semana pico
const pico = Math.max(...plan.semanas.map(s => s.tssObjetivo))
assert.ok(plan.semanas[9].tssObjetivo <= pico * 0.55)
assert.ok(plan.semanas[8].tssObjetivo < pico)
assert.ok(plan.semanas[9].tiradaKm < plan.semanas[5].tiradaKm)
// la tirada nunca pasa del tope de un 10K (16 km)
assert.ok(plan.semanas.every(s => s.tiradaKm <= 16))
// toda sesión clave es válida para el reloj
for (const s of plan.semanas) for (const c of s.claves) assert.equal(validarPasos(c.pasos).ok, true, `${s.n} ${c.titulo}`)
// la fase específica usa el ritmo de carrera del objetivo (44:00 en 10K = 4:24/km = 264 s/km)
assert.equal(plan.ritmoCarrera_s_km, 264)
const esp = plan.semanas.find(s => s.fase === 'especifica')!
assert.match(JSON.stringify(esp.claves[0].pasos), /"min_seg_km":260/)
// viabilidad: 44:00 (VDOT ≈ 46,4) desde 45 es alcanzable; 38:00 no
assert.notEqual(plan.viabilidad.nivel, 'poco_realista')
assert.equal((generarPlan({ ...entradaPlan, objetivo: { ...entradaPlan.objetivo, tiempo_s: 2280 } }) as PlanObjetivo).viabilidad.nivel, 'poco_realista')
assert.equal((generarPlan({ ...entradaPlan, objetivo: { ...entradaPlan.objetivo, tiempo_s: 2760 } }) as PlanObjetivo).viabilidad.nivel, 'realista') // 46:00, más lento que su nivel
// entradas inválidas
assert.ok('error' in (generarPlan({ ...entradaPlan, objetivo: { ...entradaPlan.objetivo, fecha: '2026-10-20' } }) as object)) // menos de 4 semanas
assert.ok('error' in (generarPlan({ ...entradaPlan, objetivo: { ...entradaPlan.objetivo, fecha: '2026-09-01' } }) as object)) // pasada
assert.ok('error' in (generarPlan({ ...entradaPlan, objetivo: { ...entradaPlan.objetivo, fecha: '2028-01-01' } }) as object)) // demasiado lejos
assert.ok('error' in (generarPlan({ ...entradaPlan, objetivo: { ...entradaPlan.objetivo, distancia_m: 800 } }) as object))
// maratón: taper de 3 semanas
const mar = generarPlan({ ...entradaPlan, objetivo: { distancia_m: 42195, tiempo_s: 12600, fecha: '2027-02-21' } }) as PlanObjetivo
assert.equal(mar.semanas.filter(s => s.fase === 'taper' || s.fase === 'carrera').length, 3)
console.log('plan-objetivo: OK')

// ── Aplicar semana ──
import { asignarSesiones, estadoDeItem } from '../lib/rendimiento/aplicar-semana'
const sesCarlos = [
  { nombre: 'Carrera: Tirada Larga Aeróbica Z2', dia_semana: 'Domingo' },
  { nombre: 'Carrera: Tempo Run en Descarga', dia_semana: 'Jueves' },
  { nombre: 'Carrera: Series Cortas en Descarga', dia_semana: 'Lunes' },
]
const asig = asignarSesiones(sesCarlos)
assert.equal(asig.calidad1?.dia_semana, 'Lunes') // primera calidad = la del lunes
assert.equal(asig.calidad2?.dia_semana, 'Jueves')
assert.equal(asig.tirada?.dia_semana, 'Domingo')
// tras renombrar (ya no se llaman Series/Tempo) la asignación se mantiene
const renombradas = [{ nombre: 'Carrera: Tirada larga 13 km', dia_semana: 'Domingo' }, { nombre: 'Carrera: Rodaje con progresiones', dia_semana: 'Jueves' }, { nombre: 'Carrera: Tempo en bloques 2×8 min', dia_semana: 'Lunes' }]
assert.equal(asignarSesiones(renombradas).calidad1?.dia_semana, 'Lunes')
assert.equal(asignarSesiones(renombradas).tirada?.nombre, 'Carrera: Tirada larga 13 km')
// sin nombre de tirada, la del último día
assert.equal(asignarSesiones([{ nombre: 'A', dia_semana: 'Martes' }, { nombre: 'B', dia_semana: 'Jueves' }, { nombre: 'C', dia_semana: 'Sabado' }]).tirada?.nombre, 'C')
assert.equal(asignarSesiones([]).tirada, undefined)
// estado de cada sesión clave
const ok = { ok: true }
assert.equal(estadoDeItem({ fechaSemana: '2026-10-12', proxima: '2026-10-12', validacion: ok, identico: false }).estado, 'aplicable') // el lunes de la semana 1, hoy lunes
assert.equal(estadoDeItem({ fechaSemana: '2026-10-12', proxima: '2026-10-15', validacion: ok, identico: false }).estado, 'aplicable') // la próxima es posterior al inicio
assert.equal(estadoDeItem({ fechaSemana: '2026-10-18', proxima: '2026-10-11', validacion: ok, identico: false }).estado, 'aplazada') // el domingo anterior aún pertenece a la semana vieja
assert.equal(estadoDeItem({ fechaSemana: '2026-10-12', proxima: '2026-10-12', validacion: { ok: false, error: 'x' }, identico: false }).estado, 'invalida')
assert.equal(estadoDeItem({ fechaSemana: '2026-10-12', proxima: '2026-10-12', validacion: ok, identico: true }).estado, 'sin_cambios')
assert.equal(estadoDeItem({ fechaSemana: null, proxima: null, validacion: ok, identico: false }).estado, 'invalida')
console.log('aplicar-semana: OK')
