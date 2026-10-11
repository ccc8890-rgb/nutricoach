// scripts/plan-vs-realidad.test.ts
import assert from 'node:assert/strict'
import { capacidadSemanal } from '../lib/entrenos/capacidad'
import { brechaPlanCapacidad, resumenPlanCarrera } from '../lib/entrenos/plan-vs-realidad'
import { evaluarReglas } from '../lib/rendimiento/reglas'
import { validarSemanaCarrera } from '../lib/entrenos/validar-plan-carrera'
import { construirEntradaMacro } from '../lib/entrenos/macro-desde-cliente'
import { planificarMacrociclo } from '../lib/entrenos/macrociclo'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'
import type { Paso } from '../lib/entrenos/pasos'
import type { EstadoAtleta } from '../lib/rendimiento/estado'

// Capacidad: la media de 4 semanas se hunde con semanas bajas; la mejor semana (80 %) dice lo que tolera
assert.equal(capacidadSemanal([0, 0, 0, 0]), null)
const c = capacidadSemanal([86, 166, 55, 30])! // caso real de Carlos (viajes en medio)
assert.equal(c.media4, 84)
assert.equal(c.capacidad, 133)
assert.ok(c.hayDiferencia)
const estable = capacidadSemanal([100, 100, 100, 100])!
assert.equal(estable.capacidad, 100)
assert.ok(!estable.hayDiferencia)

// Resumen del plan: suma de sesiones de carrera con pasos
const E = { tipo: 'zona', zona: 'E' } as const
const pasosRodaje = (min: number): Paso[] => [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: min * 60 }, objetivo: E }]
const ritmos = ritmosDesdeVdot(45)
const plan = resumenPlanCarrera([{ nombre: 'Rodaje 25', pasos: pasosRodaje(25) }, { nombre: 'Tirada larga 40', pasos: pasosRodaje(40) }, { nombre: 'Híbrida pierna', pasos: null }], ritmos)!
assert.equal(plan.minutos, 65)
assert.equal(plan.tiradaMin, 40)
assert.equal(plan.salidas, 2)
assert.equal(resumenPlanCarrera([{ pasos: null }], ritmos), null)

// Brecha
assert.equal(brechaPlanCapacidad(null, 133, 77), null)
const b = brechaPlanCapacidad({ minutos: 97, tiradaMin: 40, salidas: 3 }, 133, 77)!
assert.equal(b.planCorto!.pct, 73)
assert.deepEqual(b.tiradaCorta, { plan: 40, real: 77 })
assert.equal(brechaPlanCapacidad({ minutos: 130, tiradaMin: 70, salidas: 3 }, 133, 77), null) // a la altura: sin aviso

// Regla del motor: plan corto con atleta sano → propuesta; con lesión, descarga o retorno → ninguna
const sano = (o: Partial<EstadoAtleta> = {}): EstadoAtleta => ({
  hoy: '2026-10-11', carreras6sem: 8, fcUmbral: 176, vdot: 45, ritmos,
  carga: { ctl: 30, atl: 30, tsb: 0, rampa7: 1, carga7d: 150, carga28d: 600, monotonia: 1.2, tension: 100, estado: 'neutral', textoEstado: 'Equilibrado' },
  intensidad: { minutos: 300, pctSuave: 75, pctMedia: 15, pctDura: 10, valoracion: 'bien' }, intensidadPrevia: { minutos: 300, pctSuave: 75, pctMedia: 15, pctDura: 10, valoracion: 'bien' },
  limitesFc: null, deriva: { media: null, n: 0 }, eficiencia: { ultimas3: null, previas3: null }, fuerza28d: 6, fuerzaEnPlan: 3,
  carrerasPorSemana: 3, kmPorSemana: 20, minutosCarreraPorSemana: 84, capacidadCarreraSemana: 133, planCarrera: { minutos: 97, tiradaMin: 40, salidas: 3 },
  ejecucion: { repsEvaluadas: 0, repsLentas: 0, sesionesEvaluadas: 0, sesionesSaltadas: 0 }, diasCompeticion: null, competicion: null,
  perfil: { nivel: 'avanzado', diasDisponibles: 5, lesiones: [], restricciones: null, recuperacion: 'alta' }, retorno: false, semanasParon: 0,
  tiradaLarga: { minutos: 77, pctSemana: 90 }, semanasSinDescarga: 2, enDescarga: false, suaveDaniels: null, alertas: [], ...o,
})
const ids = (e: EstadoAtleta) => evaluarReglas(e).propuestas.map(p => p.regla)
assert.ok(ids(sano()).includes('plan_corto'))
assert.ok(!ids(sano({ retorno: true })).includes('plan_corto'))
assert.ok(!ids(sano({ enDescarga: true })).includes('plan_corto'))
assert.ok(!ids(sano({ perfil: { nivel: 'avanzado', diasDisponibles: 5, lesiones: ['rodilla'], restricciones: null, recuperacion: 'alta' } })).includes('plan_corto'))
assert.ok(!ids(sano({ perfil: { nivel: 'principiante', diasDisponibles: 5, lesiones: [], restricciones: null, recuperacion: 'alta' } })).includes('plan_corto'))
assert.ok(!ids(sano({ carreras6sem: 3 })).includes('plan_corto'), 'sin datos suficientes no se propone')
assert.ok(!ids(sano({ planCarrera: { minutos: 130, tiradaMin: 70, salidas: 3 } })).includes('plan_corto'))
assert.ok(!ids(sano({ alertas: ['rhr_alto'] })).includes('plan_corto'))

// Validador: avisa de un plan por debajo de la realidad (y no en retorno)
const sesion = (nombre: string, min: number, dia: string) => ({ nombre, dia_semana: dia, tipo_sesion: 'carrera', duracion_min: min })
const sesiones = [sesion('Rodaje fácil', 25, 'jueves'), sesion('Series', 35, 'martes'), sesion('Tirada larga', 40, 'sábado')]
const v = validarSemanaCarrera(sesiones, { ritmos, minutosRealesSemana: 84, capacidadSemana: 133, tiradaRealMin: 77 })
assert.ok(v.hallazgos.some(h => h.codigo === 'plan_por_debajo_realidad'))
assert.ok(v.hallazgos.some(h => h.codigo === 'tirada_por_debajo_realidad'))
const vr = validarSemanaCarrera(sesiones, { ritmos, minutosRealesSemana: 84, capacidadSemana: 133, tiradaRealMin: 77, planConservador: true })
assert.ok(!vr.hallazgos.some(h => h.codigo.endsWith('por_debajo_realidad')))

// Macrociclo: el volumen de partida sube a la capacidad (no a la media hundida por semanas bajas)
const hoy = '2026-10-11'
const dia = (n: number) => new Date(Date.parse(`${hoy}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
const carrera = (n: number, min: number) => ({ fecha: dia(n), tipo: 'running', duracion_s: min * 60 })
// Semanas completas (lun-dom) anteriores a hoy (domingo 11-10): 28-09→04-10 = 86 min, 21→27-09 = 166, 14→20-09 = 55, 07→13-09 = 30
const entrenos = [carrera(8, 86), carrera(15, 166), carrera(22, 55), carrera(29, 30)]
const datos = (nivel: string, extra = {}) => ({
  hoy, cliente: { nivel, edad: 36, sexo: 'hombre' },
  perfil: { nivel, vdot: 45, dias_disponibles: 5, patron_lesiones: [], restricciones_temporales: null, capacidad_recuperacion: 'alta' },
  competicion: null, onboarding: null, entrenos, sesionesFuerzaFijas: 3, ...extra,
})
const avanzado = construirEntradaMacro(datos('avanzado'))
assert.equal(avanzado.entrada.minutosSemanaActuales, 133)
assert.ok(avanzado.supuestos.some(s => s.includes('mejor semana reciente')))
assert.ok(planificarMacrociclo(avanzado.entrada).semanas[0].minutos >= 120, 'la semana 1 ya no queda en ~100 min')
// Principiante o con lesión: se mantiene la media (prudencia)
assert.equal(construirEntradaMacro(datos('principiante')).entrada.minutosSemanaActuales, 84)
assert.equal(construirEntradaMacro(datos('avanzado', { perfil: { nivel: 'avanzado', vdot: 45, dias_disponibles: 5, patron_lesiones: ['rodilla'], restricciones_temporales: null, capacidad_recuperacion: 'alta' } })).entrada.minutosSemanaActuales, 84)

// El otro lado: plan muy por encima de lo que sostiene → regla plan_excesivo (y la corta no salta a la vez)
const exceso = ids(sano({ planCarrera: { minutos: 200, tiradaMin: 80, salidas: 3 } }))
assert.ok(exceso.includes('plan_excesivo') && !exceso.includes('plan_corto'))
assert.ok(!ids(sano({ planCarrera: { minutos: 150, tiradaMin: 65, salidas: 3 } })).some(r => r === 'plan_excesivo' || r === 'plan_corto'), '150 sobre capacidad 133 es razonable')
assert.ok(!ids(sano({ planCarrera: { minutos: 200, tiradaMin: 80, salidas: 3 }, retorno: true })).includes('plan_excesivo'))

// Validador: el salto se mide contra la capacidad, no contra la media hundida (150 sobre media 84 sería +78 %: error falso)
const sesion150 = [sesion('Series', 45, 'martes'), sesion('Rodaje fácil', 40, 'jueves'), sesion('Tirada larga', 65, 'sábado')]
const conMedia = validarSemanaCarrera(sesion150, { ritmos, minutosRealesSemana: 84 })
assert.ok(conMedia.hallazgos.some(h => h.codigo === 'salto_volumen'), 'sin capacidad se compara con la media')
const conCap = validarSemanaCarrera(sesion150, { ritmos, minutosRealesSemana: 84, capacidadSemana: 133, tiradaRealMin: 77 })
assert.ok(!conCap.hallazgos.some(h => h.codigo === 'salto_volumen' || h.codigo === 'subida_volumen' || h.codigo.endsWith('por_debajo_realidad')))

console.log('plan-vs-realidad.test.ts OK')
