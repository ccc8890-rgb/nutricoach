import assert from 'node:assert/strict'
import { estadoAnalisis, etiquetaDecision, glosarSiglas, porQueResumen, resumirPropuesta, titularDe, TEXTO_ESTADO } from '../lib/rendimiento/presentacion'
import type { PayloadPlanEntrenoIA } from '../lib/entrenos/planificar-con-ia'

// ── Etiqueta única por decisión ──
assert.equal(etiquetaDecision({ segura: true, riesgo: 'bajo', fiabilidad: { nivel: 'alta' } }), 'seguro')
assert.equal(etiquetaDecision({ segura: false, riesgo: 'medio', fiabilidad: { nivel: 'media' } }), 'mirar')
assert.equal(etiquetaDecision({ riesgo: 'alto' }), 'revisar')
assert.equal(etiquetaDecision({ segura: true, riesgo: 'alto' }), 'revisar', 'el riesgo alto manda aunque venga marcada como segura')
assert.equal(etiquetaDecision({ segura: false, fiabilidad: { nivel: 'baja' } }), 'revisar')
assert.equal(etiquetaDecision({}), 'mirar', 'un análisis antiguo sin esos campos se muestra como «mirar»')

// ── Estado del análisis ──
const dec = (o: object) => o as never
assert.equal(estadoAnalisis({ decisiones: [dec({ segura: true, riesgo: 'bajo' })] }), 'ok')
assert.equal(estadoAnalisis({ decisiones: [dec({ segura: true, riesgo: 'bajo' }), dec({ riesgo: 'medio' })] }), 'mirar')
assert.equal(estadoAnalisis({ decisiones: [dec({ segura: true, riesgo: 'bajo' })], preguntas_al_coach: ['¿Haces la fuerza?'] }), 'mirar')
assert.equal(estadoAnalisis({ decisiones: [], alerta_prioritaria: 'Sube la fatiga' }), 'revisar')
assert.equal(estadoAnalisis({ decisiones: [dec({ riesgo: 'alto' })] }), 'revisar')
assert.equal(estadoAnalisis({}), 'ok')
assert.deepEqual(TEXTO_ESTADO, { ok: 'Todo en orden', mirar: 'Hay algo que mirar', revisar: 'Revisa antes de aprobar' })

// ── Titular: primera frase, sin cortar decimales, con tope ──
assert.equal(titularDe('Carlos está fresco con TSB -1.3 y sin riesgo. Lo que se juega esta semana es otra cosa.'), 'Carlos está fresco con TSB -1.3 y sin riesgo.')
assert.equal(titularDe(undefined), '')
assert.equal(titularDe('   '), '')
const larga = 'Una frase muy larga '.repeat(20)
const t = titularDe(larga, 60)
assert.ok(t.length <= 60 && t.endsWith('…'), t)
assert.ok(!t.includes('  '))

// ── Siglas explicadas (sin duplicar) ──
assert.equal(glosarSiglas('Con CTL 16 y TSB -1.3'), 'Con forma (CTL) 16 y frescura (TSB) -1.3')
assert.equal(glosarSiglas('la fatiga (ATL) sube'), 'la fatiga (ATL) sube')
assert.equal(glosarSiglas('ATL 17'), 'fatiga (ATL) 17')

// ── «Por qué» resumido ──
assert.equal(porQueResumen({ estudios: [{}, {}, {}, {}] as never, fiabilidad: { nivel: 'alta' } }), '4 estudios · fiabilidad alta')
assert.equal(porQueResumen({ estudios: [{}] as never, fiabilidad: { nivel: 'media' } }), '1 estudio · fiabilidad media')
assert.equal(porQueResumen({ estudios: [], fiabilidad: { nivel: 'media' } }), 'criterio de entrenador · fiabilidad media')
assert.equal(porQueResumen({ confianza: 0.72 }), 'confianza 72 %')

// ── Propuesta de plan ──
const base: PayloadPlanEntrenoIA = {
  modo: 'siguiente_bloque', fase_bloque: 'Base', nombre_plan: 'Híbrido Hyrox + Running — Base', duracion_semanas: 4, es_hibrido: true,
  plan: { sesiones: [
    { nombre: 'Híbrida A: SkiErg + Fuerza', dia_semana: 'lunes', ejercicios: [] },
    { nombre: 'Carrera: Rodaje fácil', dia_semana: 'martes', duracion_min: 30, ritmo_objetivo: '5:40-6:08/km' },
    { nombre: 'Carrera: Tirada larga', dia_semana: 'sábado', duracion_min: 40 },
  ] },
  macrociclo: {
    semanasHastaCarrera: null, ritmos: null, avisos: [], supuestos: [], datosFaltantes: ['Competición objetivo'],
    parametros: { nivel: 'avanzado', salidasSemana: 3, volumenBase: 89, volumenPico: 158, crecimientoSemanal: 0.1, descargaCada: 4 },
    semanas: [{ n: 1, lunes: '2026-10-12', fase: 'base', descarga: false, minutos: 100, salidas: 3, tiradaMin: 40, pctSuave: 95, fuerza: 3, sesiones: [{ tipo: 'rodaje', minutos: 30, dia: 1 }, { tipo: 'rodaje', minutos: 30, dia: 3 }, { tipo: 'tirada', minutos: 40, dia: 5 }], notas: [] }],
    fundamentos: [
      { regla: 'Descarga cada 4 semanas', tipo: 'libro', fuente: 'Fitzgerald' },
      { regla: 'Sesión más larga +10 %', tipo: 'estudio', fuente: 'Frandsen 2025' },
      { regla: 'Anemia: +3 %/semana', tipo: 'criterio', fuente: 'Prudencia' },
    ],
  },
  validacion: { hallazgos: [{ nivel: 'aviso', codigo: 'a', texto: 'Aviso de prueba' }, { nivel: 'error', codigo: 'e', texto: 'Error de prueba' }], resumen: { carrerasSemana: 3, minutosCarrera: 100, sesionesCalidad: 0, tiradaLargaMin: 40, tiradaLargaPct: 40 } },
  generado_en: '2026-10-10T10:00:00Z',
  contexto: { minutos_reales_semana: 89 },
}
const r = resumirPropuesta(base)
assert.equal(r.titular, 'Siguiente bloque · Base · 4 semanas')
assert.equal(r.estado, 'revisar', 'un error del validador pide revisar antes de aprobar')
assert.equal(r.queCambia[0], 'Carrera: de 89 a 100 min por semana (+12 %)')
assert.ok(r.queCambia.includes('3 salidas de carrera, la tirada larga de 40 min'))
assert.ok(r.queCambia.includes('Sin sesiones de calidad esta semana'))
assert.ok(r.queCambia.includes('3 de fuerza o híbridas'))
assert.deepEqual(r.semana[1], { dia: 'martes', nombre: 'Carrera: Rodaje fácil', detalle: '30 min · 5:40-6:08/km' })
assert.equal(r.semana[0].detalle, '')
assert.deepEqual(r.revisar.map(x => x.grave), [true, false], 'los errores van primero')
assert.deepEqual(r.fundamentos.map(f => f.tipo), ['Estudio', 'Libro', 'Criterio'])
assert.deepEqual(r.faltan, ['Competición objetivo'])

// Sin datos del reloj para comparar, sin macrociclo, sin avisos
const sinReal = resumirPropuesta({ ...base, contexto: { minutos_reales_semana: null }, validacion: null })
assert.equal(sinReal.queCambia[0], 'Carrera: 100 min por semana (sin datos del reloj para comparar)')
assert.equal(sinReal.estado, 'ok')
const sinMacro = resumirPropuesta({ ...base, macrociclo: null, validacion: null, modo: 'crear', fase_bloque: null, duracion_semanas: null })
assert.equal(sinMacro.titular, 'Primer bloque')
assert.deepEqual(sinMacro.queCambia, ['3 sesiones en la semana'])
assert.equal(sinMacro.estado, 'ok')
const soloAvisos = resumirPropuesta({ ...base, validacion: { hallazgos: [{ nivel: 'aviso', codigo: 'a', texto: 'x' }], resumen: base.validacion!.resumen } })
assert.equal(soloAvisos.estado, 'mirar')

console.log('presentacion.test OK')
