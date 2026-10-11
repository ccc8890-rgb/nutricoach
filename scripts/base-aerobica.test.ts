// scripts/base-aerobica.test.ts
import assert from 'node:assert/strict'
import { calcularBaseAerobica, ritmoAlPulso, type RodajeSuave } from '../lib/rendimiento/base-aerobica'

// ef = m/min por ppm. A 150 ppm con ef 1,0 → 150 m/min → 6:40/km
assert.equal(ritmoAlPulso(1.0, 150), 400)

const hoy = '2026-10-11'
const r = (fecha: string, ef: number, fc = 148): RodajeSuave => ({ fecha, ef, fc_media: fc, ritmo_s_km: 360 })

// Sin pulso de referencia no hay análisis
assert.equal(calcularBaseAerobica([r('2026-10-05', 1)], null, hoy).valoracion, 'sin_datos')

// Menos de 3 rodajes por ventana: sin comparar, pero los puntos sí salen
const poco = calcularBaseAerobica([r('2026-10-05', 1), r('2026-10-01', 1)], 154, hoy)
assert.equal(poco.valoracion, 'sin_datos')
assert.equal(poco.puntos.length, 2)

// Mejora: la eficiencia sube ~5 %
const prev = [r('2026-08-25', 1.0), r('2026-09-01', 1.0), r('2026-09-08', 1.0)]
const rec = [r('2026-10-01', 1.05), r('2026-10-05', 1.05), r('2026-10-09', 1.05)]
const m = calcularBaseAerobica([...prev, ...rec], 154, hoy)
assert.equal(m.valoracion, 'mejora')
assert.equal(m.cambioPct, 5)
assert.ok(m.cambioSeg! < 0) // más rápido al mismo pulso
assert.equal(m.reciente!.ritmoRef, ritmoAlPulso(1.05, 154))

// Ruido (±1 %) = estable; caída del 4 % = retrocede
const est = calcularBaseAerobica([...prev, ...rec.map(x => ({ ...x, ef: 1.01 }))], 154, hoy)
assert.equal(est.valoracion, 'estable')
const peor = calcularBaseAerobica([...prev, ...rec.map(x => ({ ...x, ef: 0.96 }))], 154, hoy)
assert.equal(peor.valoracion, 'retrocede')

console.log('base-aerobica.test.ts OK')
