import assert from 'node:assert/strict'
import { sanearSalida } from '../lib/agentes/analisis-rendimiento'

assert.equal(sanearSalida(null), null)
assert.equal(sanearSalida({ resumen: '  ' }), null)
assert.equal(sanearSalida('texto'), null)

const s = sanearSalida({
  resumen: 'Semana de descarga bien ejecutada.',
  lecturas: [{ titulo: 'Forma', detalle: 'CTL 16', dato: '16' }, { titulo: 'x', detalle: 'y', dato: 'z' }, {}, {}, { titulo: 'quinta', detalle: 'se descarta' }],
  decisiones: [
    { sesion: 'Series', cambio: 'Subir a 8×400', razon: 'Frescura positiva', evidencia: 'Banister', confianza: 7 },
    { sesion: 'Tempo', cambio: '', razon: 'sin cambio no vale' },
    { cambio: 'Añadir 10 min suaves', confianza: 'mucha' },
  ],
  alerta_prioritaria: '',
  preguntas_al_coach: ['¿Hay molestias?', '', 'b', 'c', 'd', 'e'],
  prioridad: 99,
  score_confianza: -2,
})!
assert.equal(s.lecturas.length, 3) // las vacías no cuentan; caben hasta 4
assert.equal(s.decisiones.length, 2) // sin 'cambio' no cuenta
assert.equal(s.decisiones[0].confianza, 1) // acotada a 0-1
assert.equal(s.decisiones[1].sesion, 'general') // por defecto
assert.equal(s.decisiones[1].confianza, 0.5) // valor inválido → por defecto
assert.equal(s.alerta, null)
assert.equal(s.preguntas.length, 4)
assert.equal(s.prioridad, 10)
assert.equal(s.confianza, 0)
// Pasos propuestos: se conservan solo con id UUID y formato válido
const buenos = [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 400 }, objetivo: { tipo: 'ritmo', min_seg_km: 255, max_seg_km: 270 } }]
const c = sanearSalida({
  resumen: 'x',
  decisiones: [
    { cambio: 'a', sesion_id: '11111111-2222-3333-4444-555555555555', pasos: buenos },
    { cambio: 'b', sesion_id: 'no-es-uuid', pasos: buenos },
    { cambio: 'c', sesion_id: '11111111-2222-3333-4444-555555555555', pasos: [{ tipo: 'inventado' }] },
    { cambio: 'd', pasos: buenos },
  ],
})!
assert.equal(c.decisiones[0].pasos?.length, 1)
assert.equal(c.decisiones[0].sesion_id, '11111111-2222-3333-4444-555555555555')
assert.equal(c.decisiones[1].pasos, undefined) // id inválido
assert.equal(c.decisiones[2].pasos, undefined) // pasos inválidos
assert.equal(c.decisiones[3].pasos, undefined) // sin id
console.log('analisis-rendimiento: OK')
