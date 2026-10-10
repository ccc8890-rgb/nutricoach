import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PropuestaPlanEntreno from '../components/clientes/PropuestaPlanEntreno'
import type { PayloadPlanEntrenoIA } from '../lib/entrenos/planificar-con-ia'

// Humo: la propuesta se pinta con el contenido esperado y no revienta con datos incompletos.
const payload = {
  modo: 'siguiente_bloque', fase_bloque: 'Base', nombre_plan: 'Híbrido — Base', duracion_semanas: 4, es_hibrido: true,
  plan: { sesiones: [{ nombre: 'Carrera: Rodaje fácil', dia_semana: 'martes', duracion_min: 30, ritmo_objetivo: '5:40-6:08/km' }] },
  macrociclo: { semanasHastaCarrera: null, ritmos: null, avisos: [], supuestos: [], datosFaltantes: [], parametros: { nivel: 'avanzado', salidasSemana: 3, volumenBase: 89, volumenPico: 158, crecimientoSemanal: 0.1, descargaCada: 4 },
    semanas: [{ n: 1, lunes: '2026-10-12', fase: 'base', descarga: false, minutos: 100, salidas: 3, tiradaMin: 40, pctSuave: 95, fuerza: 3, sesiones: [], notas: [] }],
    fundamentos: [{ regla: 'Sesión más larga +10 %', tipo: 'estudio', fuente: 'Frandsen 2025' }] },
  validacion: { hallazgos: [{ nivel: 'aviso', codigo: 'x', texto: 'Texto del aviso' }], resumen: { carrerasSemana: 3, minutosCarrera: 100, sesionesCalidad: 0, tiradaLargaMin: 40, tiradaLargaPct: 40 } },
  generado_en: '2026-10-10T10:00:00Z', contexto: { minutos_reales_semana: 89 },
} as PayloadPlanEntrenoIA
const html = renderToStaticMarkup(createElement(PropuestaPlanEntreno, { payload }))
for (const texto of ['Siguiente bloque · Base · 4 semanas', 'Hay algo que mirar', 'de 89 a 100 min por semana (+12 %)', 'martes', 'Revisar antes de aprobar', 'Texto del aviso', 'Frandsen 2025', 'Estudio']) assert.ok(html.includes(texto), texto)

// Sin macrociclo ni validación ni sesiones: no revienta.
const minimo = renderToStaticMarkup(createElement(PropuestaPlanEntreno, { payload: { ...payload, macrociclo: null, validacion: null, plan: {} } as unknown as PayloadPlanEntrenoIA }))
assert.ok(minimo.includes('0 sesiones en la semana'))
assert.ok(!minimo.includes('Revisar antes de aprobar'))
console.log('presentacion-render.test OK')
