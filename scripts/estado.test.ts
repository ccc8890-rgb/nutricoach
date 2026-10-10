import assert from 'node:assert/strict'
import { construirEstado, vuelveDeParon } from '../lib/rendimiento/estado'
import type { PanelRendimiento } from '../lib/rendimiento/panel'

const dia = (n: number) => new Date(Date.UTC(2026, 9, 10) - n * 86_400_000).toISOString().slice(0, 10)
const d = (atras: number, pct: number) => ({ fecha: dia(atras), derivaPct: pct, fc1: 150, fc2: 165, ritmo1_s_km: 330, ritmo2_s_km: 330, minutos: 40, valoracion: 'alta' as const })
const intensidad = { valoracion: 'sin_datos' as const, minutos: 0, pctSuave: 0, pctMedia: 0, pctDura: 0 }

const panel = (deriva: ReturnType<typeof d>[], eficiencia: { fecha: string; valor: number }[] = []) => ({
  deportes: [], semanas: [], resumen: null, deriva, eficiencia,
  intensidad: { limites: null, semanas: [], reciente: intensidad, previo: intensidad },
}) as unknown as PanelRendimiento

const base = { hoy: '2026-10-10', fcUmbral: 177, vdot: 45, diasCompeticion: null, ejecucion: [], nombresSesionesPlan: [], alertas: [] }

// La deriva solo cuenta las carreras de las últimas 6 semanas.
const e = construirEstado({ ...base, panel: panel([d(100, 14), d(80, 13), d(50, 12), d(30, 8), d(10, 6)]) })
assert.equal(e.deriva.n, 2)
assert.equal(e.deriva.media, 7)

// Sin carreras recientes no hay deriva (no se arrastra la de hace meses).
const vieja = construirEstado({ ...base, panel: panel([d(120, 14), d(90, 13)]) })
assert.equal(vieja.deriva.n, 0)
assert.equal(vieja.deriva.media, null)

// El panel ordena de más antiguo a más reciente. La eficiencia solo cuenta las últimas 8 semanas y exige al menos 6 puntos para comparar 3 con 3.
const ef = (atras: number, valor: number) => ({ fecha: dia(atras), valor })
const conEf = construirEstado({ ...base, panel: panel([], [ef(200, 0.5), ef(30, 1.1), ef(25, 1.1), ef(20, 1.1), ef(15, 1.2), ef(10, 1.2), ef(5, 1.2)]) })
assert.ok(Math.abs(conEf.eficiencia.ultimas3! - 1.2) < 1e-9 && Math.abs(conEf.eficiencia.previas3! - 1.1) < 1e-9)
assert.equal(construirEstado({ ...base, panel: panel([], [ef(200, 0.5), ef(10, 1.2), ef(5, 1.2)]) }).eficiencia.ultimas3, null)

// Plan: cuenta las sesiones de fuerza o híbridas por el nombre.
const plan = construirEstado({ ...base, panel: panel([]), nombresSesionesPlan: ['Carrera: Tempo', 'Híbrida A: SkiErg + Fuerza', 'Híbrida B', 'Fuerza de hombro', 'Carrera: Tirada larga'] })
assert.equal(plan.fuerzaEnPlan, 3)
// Retorno tras un parón: 2+ semanas seguidas sin correr y menos de 4 de actividad desde entonces.
assert.equal(vuelveDeParon([3, 3, 3, 3, 0, 0, 2, 3]), true) // paró 2 semanas y lleva 2 de vuelta
assert.equal(vuelveDeParon([3, 3, 0, 0, 0, 1, 2, 2]), true) // 3 semanas parado, 3 de vuelta
assert.equal(vuelveDeParon([3, 3, 0, 0, 2, 3, 3, 3]), false) // ya lleva 4 semanas de vuelta
assert.equal(vuelveDeParon([3, 0, 3, 0, 3, 0, 3, 3]), false) // semanas sueltas sin correr no son un parón
assert.equal(vuelveDeParon([3, 3, 3, 3, 3, 3, 3, 3]), false)
assert.equal(vuelveDeParon([0, 0, 0, 0, 0, 0, 0, 0]), false) // sigue parado: no «vuelve»
assert.equal(vuelveDeParon([]), false)
assert.equal(vuelveDeParon([3, 3, 3, 3, 3, 0, 0, 0]), false) // acaba de parar y aún no ha vuelto

// El perfil se normaliza: sin datos queda vacío y las restricciones en blanco no cuentan.
assert.deepEqual(construirEstado({ ...base, panel: panel([]) }).perfil, { nivel: null, diasDisponibles: null, lesiones: [], restricciones: null, recuperacion: null })
const conPerfil = construirEstado({ ...base, panel: panel([]), perfil: { nivel: 'avanzado', diasDisponibles: 5, lesiones: ['rodilla'], restricciones: '   ', recuperacion: 'alta' }, competicion: { dias: 20, disciplina: 'running_hm', tiempoObjetivoMin: 105 } })
assert.equal(conPerfil.perfil.restricciones, null)
assert.deepEqual(conPerfil.perfil.lesiones, ['rodilla'])
assert.equal(conPerfil.competicion?.disciplina, 'running_hm')
console.log('estado.test OK')
