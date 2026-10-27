import assert from 'node:assert/strict'
import { validarTecnica, parametrosVacios, resumenParametros, tecnicaDeFormulario, formularioDeTecnica, FORMULARIO_TECNICA_VACIO } from '../lib/tecnicas'
import { FAMILIAS_TECNICA } from '../lib/recetas-constants'

assert.deepEqual([...FAMILIAS_TECNICA], ['Calor y cocción', 'Cortes', 'Emulsiones, espumas y geles', 'Masas y panificación', 'Fermentación y curado', 'Baja temperatura y vacío', 'Ahumado', 'Conservación', 'Pastelería base', 'Maíz y cereales'])

// ── validarTecnica ──
{
  const r = validarTecnica({
    nombre: '  Nixtamalización  ', familia: 'Maíz y cereales', descripcion: 'Cocer el maíz con cal', principio: 'El álcali ablanda el hollejo',
    pasos: '1. Lava\n2. Cuece', errores_tipicos: 'Hervir fuerte', variantes: 'Con ceniza', seguridad: 'Cal: guantes', origen: 'Mesoamérica',
    parametros: { temperatura_c: 90, tiempo_activo_min: 45, tiempo_total_min: 720, proporciones: '1 : 2 : 0,01', nivel: 'Medio', equipo: 'Olla grande', otro: 1 },
    tags: ['Maíz', 'maíz', ' Cal '], url_origen: 'https://example.com/r', estado: 'aprobada', extra: 'x',
  })
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.tecnica.nombre, 'Nixtamalización'); assert.equal(r.tecnica.familia, 'Maíz y cereales')
    assert.deepEqual(r.tecnica.parametros, { temperatura_c: 90, tiempo_activo_min: 45, tiempo_total_min: 720, proporciones: '1 : 2 : 0,01', nivel: 'Medio', equipo: 'Olla grande' })
    assert.deepEqual(r.tecnica.tags, ['Maíz', 'Cal'])                    // sin duplicados (sin distinguir mayúsculas) ni espacios
    assert.equal(r.tecnica.estado, 'aprobada'); assert.ok(!('extra' in r.tecnica))
  }
  assert.equal(validarTecnica({ nombre: '   ' }).ok, false)                                             // el nombre es obligatorio
  assert.equal(validarTecnica({ nombre: 'x', familia: 'Inventada' }).ok, false)                         // familia fuera de la lista
  assert.equal(validarTecnica({ nombre: 'x', estado: 'borrador' }).ok, false)                           // estado fuera de la lista
  assert.equal(validarTecnica(null).ok, false)
  const minima = validarTecnica({ nombre: 'Blanquear' })
  assert.ok(minima.ok && minima.tecnica.estado === 'en_revision' && minima.tecnica.familia === null && parametrosVacios(minima.tecnica.parametros))
  const raros = validarTecnica({ nombre: 'x', parametros: { temperatura_c: -300, tiempo_activo_min: -1, nivel: 'Dios' } })
  assert.ok(raros.ok && parametrosVacios(raros.tecnica.parametros))                                       // valores imposibles se descartan
  const largo = validarTecnica({ nombre: 'x'.repeat(500), pasos: 'p'.repeat(20000) })
  assert.ok(largo.ok && largo.tecnica.nombre.length === 200 && (largo.tecnica.pasos?.length ?? 0) === 10000)
}

// ── resumen de parámetros ──
assert.equal(resumenParametros({ temperatura_c: 90, tiempo_total_min: 720, nivel: 'Medio' }), '90 °C · 12 h · Medio')
assert.equal(resumenParametros({ tiempo_activo_min: 45, proporciones: '1 : 2' }), 'Activo 45 min · 1 : 2')
assert.equal(resumenParametros({}), null)

// ── formulario ↔ técnica ──
{
  const f = { ...FORMULARIO_TECNICA_VACIO, nombre: 'Blanquear', familia: 'Calor y cocción', temperatura_c: '100', tiempo_activo_min: '5', tags: 'verdura, agua' }
  const r = tecnicaDeFormulario(f); assert.ok(r.ok)
  if (r.ok) {
    assert.deepEqual(r.tecnica.parametros, { temperatura_c: 100, tiempo_activo_min: 5 }); assert.deepEqual(r.tecnica.tags, ['verdura', 'agua'])
    const back = formularioDeTecnica(r.tecnica); assert.equal(back.temperatura_c, '100'); assert.equal(back.tags, 'verdura, agua'); assert.equal(back.familia, 'Calor y cocción')
  }
  assert.equal(tecnicaDeFormulario({ ...FORMULARIO_TECNICA_VACIO, nombre: '' }).ok, false)
  const coma = tecnicaDeFormulario({ ...FORMULARIO_TECNICA_VACIO, nombre: 'x', temperatura_c: '62,5' }); assert.ok(coma.ok && coma.tecnica.parametros.temperatura_c === 62.5)   // coma decimal
}

console.log('tecnicas.test OK')
