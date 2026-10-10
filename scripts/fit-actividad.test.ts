import assert from 'node:assert/strict'
import { Encoder, Profile } from '@garmin/fitsdk'
import { ErrorFit, fechaLocalMadrid, leerActividadFit, mapearActividadFit, potenciaNormalizada, tipoDesdeFit } from '../lib/rendimiento/fit-actividad'

const inicio = new Date(Date.UTC(2026, 6, 4, 6, 30, 0)) // 4-jul-2026 08:30 en Madrid (CEST)

function fitSintetico(opciones: { potencia?: boolean; segundos?: number } = {}): Uint8Array {
  const segundos = opciones.segundos ?? 2400
  const e = new Encoder()
  e.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'development', product: 1, timeCreated: inicio, serialNumber: 1 })
  for (let s = 0; s < segundos; s++) {
    e.onMesg(Profile.MesgNum.RECORD, {
      timestamp: new Date(inicio.getTime() + s * 1000),
      heartRate: 140 + Math.floor(s / 600),
      cadence: 85,
      distance: s * 8,
      speed: 8,
      ...(opciones.potencia === false ? {} : { power: 200 }),
    })
  }
  const fin = new Date(inicio.getTime() + segundos * 1000)
  const mitad = segundos / 2
  e.onMesg(Profile.MesgNum.LAP, { timestamp: new Date(inicio.getTime() + mitad * 1000), startTime: inicio, totalElapsedTime: mitad, totalTimerTime: mitad, totalDistance: mitad * 8, avgHeartRate: 141, avgSpeed: 8, ...(opciones.potencia === false ? {} : { avgPower: 200 }) })
  e.onMesg(Profile.MesgNum.LAP, { timestamp: fin, startTime: new Date(inicio.getTime() + mitad * 1000), totalElapsedTime: mitad, totalTimerTime: mitad, totalDistance: mitad * 8, avgHeartRate: 142, avgSpeed: 8, ...(opciones.potencia === false ? {} : { avgPower: 200 }) })
  e.onMesg(Profile.MesgNum.SESSION, {
    timestamp: fin, startTime: inicio, totalElapsedTime: segundos, totalTimerTime: segundos, totalDistance: segundos * 8,
    sport: 'cycling', subSport: 'road', avgHeartRate: 142, maxHeartRate: 148, avgCadence: 85, totalAscent: 320,
    ...(opciones.potencia === false ? {} : { avgPower: 200, maxPower: 420, totalWork: 480_000 }),
  })
  return e.close()
}

// Lectura completa con potencia.
const a = leerActividadFit(fitSintetico())
assert.equal(a.tipo, 'cycling')
assert.equal(a.duracion_s, 2400)
assert.equal(a.distancia_m, 19200)
assert.equal(a.fc_media, 142)
assert.equal(a.potencia_media, 200)
assert.equal(a.potencia_max, 420)
assert.equal(a.potencia_normalizada, 200) // potencia constante → NP = media
assert.equal(a.cadencia_media, 85)
assert.equal(a.desnivel_m, 320)
assert.equal(a.trabajo_kj, 480)
assert.equal(a.vueltas.length, 2)
assert.equal(a.vueltas[0].potencia_media, 200)
assert.equal(a.inicio.getTime(), inicio.getTime())

// Mapeo: con FTP la carga sale de la potencia. 40 min a IF 0,8 → 0,667 h × 0,64 × 100 = 42,7.
const umbrales = { fcUmbral: 177, fcMax: 193, velUmbralMs: null }
const f = mapearActividadFit(a, 'cli', umbrales, 250, 'Salida')
assert.equal(f.fuente, 'fit_manual')
assert.equal(f.tss_metodo, 'potencia')
assert.ok(Math.abs(f.tss! - 42.7) < 0.2, `tss ${f.tss}`)
assert.equal(f.fecha, '2026-07-04')
assert.equal(f.inicio_local, '2026-07-04T08:30:00')
assert.equal(f.actividad_id, `${inicio.getTime() / 1000}-2400`)
assert.equal(f.raw.ftp_usado, 250)
assert.equal(f.raw.cadencia_ciclismo, 85)
assert.equal(f.ritmo_medio_s_km, null) // en bici no hay ritmo

// Sin FTP o sin potencia: cae al pulso.
assert.equal(mapearActividadFit(a, 'cli', umbrales, null).tss_metodo, 'pulso')
const sinP = leerActividadFit(fitSintetico({ potencia: false }))
assert.equal(sinP.potencia_media, null)
assert.equal(mapearActividadFit(sinP, 'cli', umbrales, 250).tss_metodo, 'pulso')

// Archivos que no son .fit.
assert.throws(() => leerActividadFit(Buffer.from('hola, esto no es un fit')), ErrorFit)
assert.throws(() => leerActividadFit(fitSintetico().slice(0, 200)), ErrorFit)

// Potencia normalizada: una potencia muy variable sube la NP por encima de la media.
const variable = Array.from({ length: 600 }, (_, s) => ({ t: s, w: s % 60 < 30 ? 400 : 0 }))
const np = potenciaNormalizada(variable)!
assert.ok(np > 200 && np < 400, `np ${np}`)
assert.equal(potenciaNormalizada(variable.slice(0, 30)), null)

assert.equal(tipoDesdeFit('cycling', 'indoor_cycling'), 'indoor_cycling')
assert.equal(tipoDesdeFit('cycling', 'mountain'), 'mountain_biking')
assert.equal(tipoDesdeFit('swimming', 'open_water'), 'open_water_swimming')
assert.equal(tipoDesdeFit('swimming', 'lap_swimming'), 'lap_swimming')
assert.equal(tipoDesdeFit('running', 'treadmill'), 'treadmill_running')
assert.equal(tipoDesdeFit('training', 'strength_training'), 'strength_training')

// Invierno (CET): 10:00 UTC → 11:00 en Madrid.
assert.equal(fechaLocalMadrid(new Date(Date.UTC(2026, 0, 15, 10, 0, 0))).inicio_local, '2026-01-15T11:00:00')
// Cerca de medianoche cambia el día local.
assert.equal(fechaLocalMadrid(new Date(Date.UTC(2026, 6, 4, 22, 30, 0))).fecha, '2026-07-05')
console.log('fit-actividad.test OK')
