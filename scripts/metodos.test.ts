import assert from 'node:assert/strict'
import { validarMetodo, normalizarUrl, huellaMetodo, puedeAprobar, transicionMetodo, disponibleIaPermitido, filtrarMetodos } from '../lib/metodos/esquema'
import type { BloqueMetodo, EjercicioMetodo, EstadoMetodo } from '../lib/metodos/constantes'

const ej = (extra: Partial<EjercicioMetodo> = {}): EjercicioMetodo => ({ texto_original: 'Sentadilla búlgara', ejercicio_id: null, series: 3, reps: '8', duracion_seg: null, pausa_seg: 90, intensidad: null, nota: null, ...extra })
const bloque = (extra: Partial<BloqueMetodo> = {}): BloqueMetodo => ({ tipo: 'principal', ejercicios: [ej()], ...extra })
const base = (extra: Record<string, unknown> = {}) => ({ tipo: 'sesion', titulo: 'Pierna con búlgaras', modalidad: 'fuerza', ...extra })

// ── normalizarUrl / huellaMetodo ──
{
  const a = 'https://www.instagram.com/reel/ABC123/?igsh=xyz&utm_source=ig'
  const b = 'http://instagram.com/reel/ABC123'
  assert.equal(normalizarUrl(a), normalizarUrl(b))
  assert.equal(normalizarUrl(''), null)
  assert.equal(normalizarUrl('no es url'), null)
  assert.equal(normalizarUrl(null), null)
  assert.notEqual(normalizarUrl('https://youtube.com/watch?v=Q'), normalizarUrl('https://youtube.com/watch?v=R'))
  assert.equal(huellaMetodo({ autor: 'Coach X', url_origen: a, titulo: 'a' }), huellaMetodo({ autor: 'Coach X', url_origen: b, titulo: 'otro título' }))
  assert.notEqual(huellaMetodo({ autor: 'Coach X', url_origen: a, titulo: 'a' }), huellaMetodo({ autor: 'Coach X', url_origen: 'https://instagram.com/reel/ZZZ', titulo: 'a' }))
  // sin URL: autor + título sin tildes ni mayúsculas
  assert.equal(huellaMetodo({ autor: 'Coach X', url_origen: null, titulo: 'Sentadilla Búlgara' }), huellaMetodo({ autor: 'coach x', url_origen: null, titulo: 'sentadilla bulgara' }))
  assert.notEqual(huellaMetodo({ autor: 'Coach X', url_origen: null, titulo: 'A' }), huellaMetodo({ autor: 'Coach X', url_origen: null, titulo: 'B' }))
}

// ── validarMetodo: lo que se acepta y lo que se ignora ──
{
  const r = validarMetodo(base({ estado: 'aprobada', coach_id: 'z', huella: 'h', disponible_ia: true, id: 'x' }), 'crear')
  assert.ok(r.ok)
  if (r.ok) for (const k of ['estado', 'coach_id', 'huella', 'disponible_ia', 'id']) assert.ok(!(k in r.valor), `no debe colarse ${k}`)
  const ok = validarMetodo(base({ estructura: [bloque()], tags: ['pierna'], material: ['barra', 'banco'], duracion_min: 60, url_origen: 'https://instagram.com/reel/A', video_url: 'https://instagram.com/reel/A' }), 'crear')
  assert.ok(ok.ok)
}

// ── validarMetodo: rechazos ──
{
  const no = (entrada: unknown, modo: 'crear' | 'editar' = 'crear') => assert.equal(validarMetodo(entrada, modo).ok, false, JSON.stringify(entrada).slice(0, 120))
  no(base({ titulo: '' }))
  no(base({ titulo: 'x'.repeat(161) }))
  no(base({ tipo: 'otro' }))
  no(base({ modalidad: 'yoga' }))
  no(base({ modalidad: undefined }))
  no(base({ duracion_min: -5 }))
  no(base({ duracion_min: 601 }))
  no(base({ tags: Array.from({ length: 13 }, (_, i) => `t${i}`) }))
  no(base({ tags: ['x'.repeat(41)] }))
  no(base({ material: ['catapulta'] }))
  no(base({ video_url: 'ftp://x.com/v' }))
  no(base({ url_origen: 'javascript:alert(1)' }))
  no(base({ estructura: [bloque({ ejercicios: [ej({ texto_original: '' })] })] }))
  no(base({ estructura: [bloque({ ejercicios: [ej({ series: 21 })] })] }))
  no(base({ estructura: [bloque({ ejercicios: [ej({ series: 0 })] })] }))
  no(base({ estructura: [{ tipo: 'inventado', ejercicios: [] }] }))
  no(base({ estructura: Array.from({ length: 13 }, () => bloque()) }))
  no(base({ estructura: [bloque({ ejercicios: Array.from({ length: 41 }, () => ej()) })] }))
  no('no soy un objeto')
  no(null)
  no({}, 'editar')
  assert.equal(validarMetodo({ resumen: 'nuevo resumen' }, 'editar').ok, true)
  assert.equal(validarMetodo({ titulo: '' }, 'editar').ok, false)
  // en editar solo se devuelven los campos recibidos
  const parcial = validarMetodo({ resumen: 'x' }, 'editar')
  assert.ok(parcial.ok && Object.keys(parcial.valor).join() === 'resumen')
}

// ── puedeAprobar ──
{
  const m = (extra: Record<string, unknown> = {}) => ({ tipo: 'sesion' as const, titulo: 'T', modalidad: 'fuerza' as const, autor: 'Coach X', url_origen: null as string | null, estructura: [bloque()], ...extra })
  assert.equal(puedeAprobar(m()).ok, true)
  assert.equal(puedeAprobar(m({ estructura: [] })).ok, false)
  assert.equal(puedeAprobar(m({ estructura: [bloque({ ejercicios: [] })] })).ok, false)
  assert.equal(puedeAprobar(m({ tipo: 'principio', estructura: [] })).ok, true)
  assert.equal(puedeAprobar(m({ autor: null, url_origen: null })).ok, false)
  assert.equal(puedeAprobar(m({ autor: null, url_origen: 'https://instagram.com/reel/A' })).ok, true)
  assert.equal(puedeAprobar(m({ autor: '   ', url_origen: null })).ok, false)
  assert.equal(puedeAprobar(m({ modalidad: null })).ok, false)
  const malo = puedeAprobar(m({ estructura: [] }))
  assert.ok(!malo.ok && malo.motivo.length > 10)
}

// ── transicionMetodo ──
{
  const t = (a: EstadoMetodo, b: EstadoMetodo) => transicionMetodo(a, b)
  assert.deepEqual(t('en_revision', 'aprobada'), { ok: true, evento: 'aprobada' })
  assert.deepEqual(t('en_revision', 'descartada'), { ok: true, evento: 'descartada' })
  assert.deepEqual(t('aprobada', 'en_revision'), { ok: true, evento: 'reabierta' })
  assert.deepEqual(t('aprobada', 'descartada'), { ok: true, evento: 'descartada' })
  assert.deepEqual(t('descartada', 'en_revision'), { ok: true, evento: 'reabierta' })
  assert.equal(t('en_revision', 'con_agente').ok, false)
  assert.equal(t('aprobada', 'con_agente').ok, false)
  assert.equal(t('aprobada', 'aprobada').ok, false)
  assert.equal(t('descartada', 'aprobada').ok, false)
}

// ── disponibleIaPermitido ──
{
  assert.equal(disponibleIaPermitido('aprobada', true), true)
  assert.equal(disponibleIaPermitido('en_revision', true), false)
  assert.equal(disponibleIaPermitido('descartada', true), false)
  assert.equal(disponibleIaPermitido('aprobada', false), false)
}

// ── filtrarMetodos ──
{
  const f = (extra: Record<string, unknown> = {}) => ({ titulo: 'Sentadilla búlgara con mancuernas', resumen: 'Unilateral de pierna', autor: 'Coach X', tags: ['pierna'], tipo: 'sesion', modalidad: 'fuerza', nivel: 'intermedio', confianza: 'experto', disponible_ia: false, ...extra })
  const lista = [f(), f({ titulo: 'Rodaje suave en zona 2', tags: ['running'], modalidad: 'running', autor: 'Ana', disponible_ia: true, tipo: 'principio', nivel: null, confianza: 'anecdotico' })]
  assert.equal(filtrarMetodos(lista, { q: 'sentadilla bulgara' }).length, 1)
  assert.equal(filtrarMetodos(lista, { q: 'bulgara sentadilla' }).length, 1)
  assert.equal(filtrarMetodos(lista, { q: 'zona 2' }).length, 1)
  assert.equal(filtrarMetodos(lista, { q: 'inexistente' }).length, 0)
  assert.equal(filtrarMetodos(lista, { q: '' }).length, 2)
  assert.equal(filtrarMetodos(lista, {}).length, 2)
  assert.equal(filtrarMetodos(lista, { soloIa: true }).length, 1)
  assert.equal(filtrarMetodos(lista, { modalidad: 'running' }).length, 1)
  assert.equal(filtrarMetodos(lista, { modalidad: 'running', tipo: 'sesion' }).length, 0)
  assert.equal(filtrarMetodos(lista, { autor: 'ana' }).length, 1)
  assert.equal(filtrarMetodos(lista, { nivel: 'intermedio' }).length, 1)
  assert.equal(filtrarMetodos([], { q: 'x' }).length, 0)
}

// ── la migración usa los mismos vocabularios que el código ──
{
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const c = require('../lib/metodos/constantes') as typeof import('../lib/metodos/constantes')
  const sql = readFileSync('supabase/migrations/20261027120000_biblioteca_metodos.sql', 'utf8')
  const lista = (vals: readonly string[]) => `in (${vals.map(v => `'${v}'`).join(', ')})`
  for (const [nombre, vals] of [['tipo', c.TIPOS_METODO], ['modalidad', c.MODALIDADES], ['objetivo', c.OBJETIVOS], ['nivel', c.NIVELES], ['confianza', c.CONFIANZAS], ['estado', c.ESTADOS_METODO]] as const) {
    assert.ok(sql.includes(`${nombre} ${lista(vals)}`), `la migración no coincide con el vocabulario de ${nombre}`)
  }
  assert.ok(sql.includes(lista(c.TIPOS_EVENTO_METODO)), 'la migración no coincide con los tipos de evento')
}
