import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { aplicarReporte, quitarMarcasReporte, validarReporte, TAG_REPORTE_CLIENTE } from '../lib/recetas/reportes'
import { contarPlanesActivos } from '../lib/recetas/uso-en-planes'

// validarReporte
const v1 = validarReporte({ aspectos: ['foto', 'inventado'], nota: '', origen: 'propio' })
assert.ok(v1.ok && v1.reporte.aspectos.length === 1 && v1.reporte.aspectos[0] === 'foto')
assert.equal(validarReporte({ aspectos: [], nota: '  ', origen: 'propio' }).ok, false)
assert.equal(validarReporte({ aspectos: ['foto'], nota: '', origen: 'otro' }).ok, false)
const larga = validarReporte({ aspectos: [], nota: 'x'.repeat(900), origen: 'cliente' })
assert.ok(larga.ok && larga.reporte.nota.length === 600)

// aplicarReporte: aprobada → en_revision con marcas
const hoy = new Date('2026-10-17T10:00:00Z')
const rep = { aspectos: ['foto'], nota: 'borrosa', origen: 'cliente' as const }
const a = aplicarReporte({ estado: 'aprobada', tags: ['Pollo'], notas_coach: null }, rep, hoy)
assert.ok(a)
assert.equal(a.estado, 'en_revision')
assert.ok(a.tags.includes('Corregir') && a.tags.includes(TAG_REPORTE_CLIENTE) && a.tags.includes('Pollo'))
assert.ok(a.notas_coach.includes('17/10/2026') && a.notas_coach.includes('A corregir: foto'))
assert.equal(a.yaMarcada, false)

// reportar dos veces: no duplica etiquetas, estado intacto
const b = aplicarReporte({ estado: 'en_revision', tags: ['Corregir'], notas_coach: 'previa' }, { ...rep, origen: 'propio' }, hoy)
assert.ok(b)
assert.equal(b.estado, 'en_revision')
assert.equal(b.tags.filter(t => t === 'Corregir').length, 1)
assert.equal(b.yaMarcada, true)
assert.ok(b.notas_coach.startsWith('previa\n'))

// mismo reporte dos veces el mismo día: la nota no repite la línea
const c = aplicarReporte({ estado: 'en_revision', tags: ['Corregir'], notas_coach: b.notas_coach }, { ...rep, origen: 'propio' }, hoy)
assert.ok(c)
assert.equal(c.notas_coach.split('\n').filter(l => l.includes('A corregir: foto — borrosa')).length, 1)

// descartada: se omite
assert.equal(aplicarReporte({ estado: 'descartada', tags: [], notas_coach: null }, rep, hoy), null)

// quitarMarcasReporte
assert.deepEqual(quitarMarcasReporte(['Pollo', 'Corregir', TAG_REPORTE_CLIENTE]), ['Pollo'])
assert.deepEqual(quitarMarcasReporte(null), [])

// contarPlanesActivos con cliente falso
function fakeDb(tablas: Record<string, unknown[]>) {
  const consulta = (tabla: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'eq', 'not']) q[m] = () => q
    q.then = (resolver: (v: unknown) => void) => resolver({ data: tablas[tabla] ?? [], error: null })
    return q
  }
  return { from: (t: string) => consulta(t) } as unknown as SupabaseClient
}
async function main() {
  const db = fakeDb({
    comidas: [
      { receta_id: 'A', plan_id: 'p1' }, { receta_id: 'A', plan_id: 'p1' }, { receta_id: 'A', plan_id: 'p2' }, { receta_id: 'B', plan_id: 'p3' },
    ],
    planes_nutricion: [{ id: 'p1' }, { id: 'p2' }],
  })
  const uso = await contarPlanesActivos(db, ['A', 'B', 'C'])
  assert.deepEqual(uso, { A: 2, B: 0, C: 0 })
  assert.deepEqual(await contarPlanesActivos(db, []), {})
  console.log('recetas-reportes OK')
}
main().catch(e => { console.error(e); process.exit(1) })
