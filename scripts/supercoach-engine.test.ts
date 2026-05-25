import assert from 'node:assert/strict'
import { crearAccionesSupercoach } from '../lib/agentes/supercoach-engine'

const accionesCarga = crearAccionesSupercoach({
  clienteId: 'cliente-1',
  planNutricion: {
    kcal_objetivo: 2200,
    proteinas_objetivo: 145,
    carbohidratos_objetivo: 240,
    grasas_objetivo: 70,
  },
  planEntreno: {
    nombre: 'Hyrox build',
    sesiones_por_semana: 5,
  },
  perfilEntreno: {
    sport_modality: 'hyrox',
    dias_disponibles: 5,
    capacidad_recuperacion: 'media',
  },
  actividad: {
    resumen: {
      tiene_datos: true,
      tdee_media: 2850,
      tss_total: 460,
      readiness_media: 42,
      hrv_media: 38,
      sesiones: 6,
      minutos_alta_intensidad_total: 190,
    },
    flags: [
      { tipo: 'tdee_alto', severidad: 'media', titulo: 'TDEE alto', accion: 'Subir carbohidratos' },
      { tipo: 'carga_alta', severidad: 'alta', titulo: 'Carga alta', accion: 'Descargar intensidad' },
    ],
  },
  rendimiento: {
    sesiones_7d: 5,
    sesiones_objetivo_semana: 5,
    adherencia_7d_pct: 100,
    rpe_media_7d: 8.1,
  },
  evidencia: [
    {
      id: 'kb_1',
      titulo: 'Carbohydrate periodization for endurance performance',
      tags: ['carbohidratos', 'rendimiento'],
      resumen: 'Los carbohidratos alrededor de sesiones clave sostienen disponibilidad energética y calidad de entrenamiento.',
      referencias: ['Burke LM et al. Sports nutrition guidelines. 2019.'],
    },
  ],
})

const ajusteNutricion = accionesCarga.find(a => a.tipo === 'ajuste_nutricion_carga')
assert.ok(ajusteNutricion)
assert.equal(ajusteNutricion?.agente, 'supercoach')
assert.equal(ajusteNutricion?.payload.accion_aplicable, 'actualizar_macros')
assert.equal((ajusteNutricion?.payload.ajustes as { kcal?: number }).kcal, 2400)
assert.equal((ajusteNutricion?.payload.ajustes as { carbohidratos?: number }).carbohidratos, 290)
assert.equal(ajusteNutricion?.prioridad, 2)
assert.equal(ajusteNutricion?.fuentes[0].año, 2019)
assert.deepEqual(ajusteNutricion?.payload.evidencia_aplicada, ['Carbohydrate periodization for endurance performance'])

const accionesAdherencia = crearAccionesSupercoach({
  clienteId: 'cliente-2',
  planNutricion: null,
  planEntreno: {
    nombre: 'Running base',
    sesiones_por_semana: 5,
  },
  perfilEntreno: {
    sport_modality: 'running',
    dias_disponibles: 4,
    capacidad_recuperacion: 'baja',
  },
  actividad: {
    resumen: {
      tiene_datos: true,
      tdee_media: 2100,
      tss_total: 90,
      readiness_media: 72,
      hrv_media: 55,
      sesiones: 2,
      minutos_alta_intensidad_total: 20,
    },
    flags: [],
  },
  rendimiento: {
    sesiones_7d: 2,
    sesiones_objetivo_semana: 5,
    adherencia_7d_pct: 40,
    rpe_media_7d: 5.4,
  },
})

const ajusteEntreno = accionesAdherencia.find(a => a.tipo === 'actualizacion_plan')
assert.ok(ajusteEntreno)
assert.equal(ajusteEntreno?.payload.accion_aplicable, 'actualizar_plan_entreno')
assert.equal((ajusteEntreno?.payload.plan_update as { sesiones_por_semana?: number }).sesiones_por_semana, 4)
assert.equal(ajusteEntreno?.requiere_aprobacion, true)

console.log('supercoach-engine.test.ts OK')
