import assert from 'node:assert/strict'
import { crearDecisionTrainingOS } from '../lib/training/training-os'

const descarga = crearDecisionTrainingOS({
  actividad: {
    integraciones: [],
    actividades: [],
    flags: [{ tipo: 'carga_alta', severidad: 'alta', titulo: 'Carga alta', descripcion: '', accion: '' }],
    resumen: {
      dias: 14,
      tiene_datos: true,
      sesiones: 6,
      pasos_media: 9000,
      calorias_activas_total: 4200,
      tdee_media: 2900,
      tss_total: 480,
      minutos_alta_intensidad_total: 210,
      hrv_media: 38,
      rhr_media: 51,
      fc_media_entreno: 148,
      body_battery_media: 30,
      stress_media: 44,
      readiness_media: 36,
      distancia_entreno_km_total: 38,
      proveedores: ['garmin_connect', 'strava'],
    },
  },
  rendimiento: {
    sesiones_7d: 4,
    sesiones_objetivo_semana: 5,
    adherencia_7d_pct: 80,
    rpe_media_7d: 8,
  },
})

assert.equal(descarga.estado, 'descarga')
assert.equal(descarga.tono, 'critico')
assert.equal(descarga.microciclo.intensidad, 'baja')
assert.equal(descarga.fuentes.usar_externo_para_adherencia, true)

const progresar = crearDecisionTrainingOS({
  actividad: {
    integraciones: [],
    actividades: [],
    flags: [],
    resumen: {
      dias: 14,
      tiene_datos: true,
      sesiones: 4,
      pasos_media: 8500,
      calorias_activas_total: 2700,
      tdee_media: 2500,
      tss_total: 260,
      minutos_alta_intensidad_total: 80,
      hrv_media: 62,
      rhr_media: 48,
      fc_media_entreno: 142,
      body_battery_media: 68,
      stress_media: 28,
      readiness_media: 78,
      distancia_entreno_km_total: 24,
      proveedores: ['strava'],
    },
  },
  rendimiento: {
    sesiones_7d: 4,
    sesiones_objetivo_semana: 4,
    adherencia_7d_pct: 100,
    rpe_media_7d: 6.4,
  },
})

assert.equal(progresar.estado, 'progresar')
assert.equal(progresar.tono, 'ok')
assert.equal(progresar.microciclo.ajuste_volumen_pct, 5)

console.log('training-os.test.ts OK')

