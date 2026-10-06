import assert from 'node:assert/strict'
import { interpretarEntrada, normalizarEnlace } from '../lib/contenido/enlace'
import { ordenarCocinado, resumenTanda } from '../lib/contenido/tanda'

// Enlaces: mismos reels con parámetros de seguimiento, http o www, barra final
assert.equal(normalizarEnlace('https://www.instagram.com/reel/ABC123/?igsh=xyz'), 'instagram.com/reel/ABC123')
assert.equal(normalizarEnlace('http://instagram.com/reel/ABC123'), 'instagram.com/reel/ABC123')
assert.equal(normalizarEnlace('https://instagram.com/reel/ABC123/#frag'), 'instagram.com/reel/ABC123')
assert.equal(normalizarEnlace('https://www.tiktok.com/@user/video/123?is_from_webapp=1'), 'tiktok.com/@user/video/123')
// El id de los ids de Instagram distingue mayúsculas
assert.notEqual(normalizarEnlace('https://instagram.com/reel/AbC'), normalizarEnlace('https://instagram.com/reel/abc'))
// YouTube watch conserva v
assert.equal(normalizarEnlace('https://www.youtube.com/watch?v=Q1w2E3&t=10s'), 'youtube.com/watch?v=Q1w2E3')
assert.equal(normalizarEnlace('https://youtu.be/Q1w2E3?si=zz'), 'youtu.be/Q1w2E3')
// No válidos
assert.equal(normalizarEnlace('no es un enlace'), null)
assert.equal(normalizarEnlace('ftp://x.com/a'), null)
assert.equal(normalizarEnlace(''), null)

// Entrada rápida
assert.deepEqual(interpretarEntrada('bowl salmón teriyaki https://instagram.com/reel/x/'), { titulo: 'bowl salmón teriyaki', enlace: 'https://instagram.com/reel/x/' })
assert.deepEqual(interpretarEntrada('https://www.tiktok.com/@u/video/1'), { titulo: 'Enlace de tiktok.com', enlace: 'https://www.tiktok.com/@u/video/1' })
assert.deepEqual(interpretarEntrada('  gofres de boniato  '), { titulo: 'gofres de boniato', enlace: null })
assert.deepEqual(interpretarEntrada(''), { titulo: '', enlace: null })

// Orden de cocinado: más largo primero, sin tiempo al final, desempate por nombre
const orden = ordenarCocinado([
  { nombre: 'Tostada', tiempo_prep_min: 5 },
  { nombre: 'Sin tiempo', tiempo_prep_min: null },
  { nombre: 'Lasaña', tiempo_prep_min: 90 },
  { nombre: 'Bowl', tiempo_prep_min: 5 },
])
assert.deepEqual(orden.map(r => r.nombre), ['Lasaña', 'Bowl', 'Tostada', 'Sin tiempo'])
assert.deepEqual(ordenarCocinado([]), [])

// Resumen de la tanda
assert.deepEqual(resumenTanda([]), { recetas: 0, minutos: 0, planosPendientes: 0 })
assert.deepEqual(
  resumenTanda([
    { tiempo_prep_min: 30, planos_hechos: [] },
    { tiempo_prep_min: null, planos_hechos: ['plato', 'macros'] },
  ]),
  { recetas: 2, minutos: 30, planosPendientes: 10 },
)

console.log('contenido-enlace-tanda: OK')
