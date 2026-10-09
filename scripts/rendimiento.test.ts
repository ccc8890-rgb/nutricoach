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
