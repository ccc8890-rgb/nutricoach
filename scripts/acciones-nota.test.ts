import assert from 'node:assert/strict'
import { reemplazarTermino, validarAcciones } from '../lib/recetas/acciones-nota'

const ctx = { filas: 5, textoOriginal: 'Añade 20 g de aceite de chile y dos dientes de ajo', notaCoach: 'batata se entiende mejor por boniato. el arroz no computa', porciones: 4, palabrasProhibidas: /v[ií]spera|carrera/ }

// Sustituir sin tocar palabras que contienen el término y respetando la mayúscula
assert.deepEqual(reemplazarTermino('Asa la Batata. batata y batatas', 'batata', 'boniato'), { texto: 'Asa la Boniato. boniato y batatas', cambios: 2 })
assert.equal(reemplazarTermino('requesón fresco', 'req', 'x').cambios, 0)
assert.equal(reemplazarTermino(null, 'batata', 'boniato').cambios, 0)

// Acciones válidas
const ok = validarAcciones([
  { tipo: 'renombrar', n: 1, nombre: 'Boniato', termino_anterior: 'batata' },
  { tipo: 'no_computa', n: 2 },
  { tipo: 'reenlazar', n: 3, alimento: 'Panela' },
  { tipo: 'responder', n: 4, texto: 'El vídeo dice 20 g de aceite de chile.' },
], ctx)
assert.equal(ok.validas.length, 4)

// Gramos: solo si la cifra sale de la nota o hay una cita literal del texto original
assert.equal(validarAcciones([{ tipo: 'gramos', n: 4, gramos: 20, evidencia: '20 g de aceite de chile' }], ctx).validas.length, 1)
assert.equal(validarAcciones([{ tipo: 'gramos', n: 4, gramos: 55, evidencia: 'inventado por la IA' }], ctx).validas.length, 0)
assert.equal(validarAcciones([{ tipo: 'gramos', n: 4, gramos: 30, evidencia: 'nota' }], { ...ctx, notaCoach: 'ponle 30 g' }).validas.length, 1)

// Filas inexistentes, tipos raros, títulos prohibidos y órdenes contradictorias
assert.equal(validarAcciones([{ tipo: 'quitar', n: 9 }], ctx).validas.length, 0)
assert.equal(validarAcciones([{ tipo: 'borrar_todo' }], ctx).validas.length, 0)
assert.equal(validarAcciones([{ tipo: 'titulo', valor: 'Tarta de víspera' }], ctx).validas.length, 0)
assert.equal(validarAcciones([{ tipo: 'raciones', valor: 99 }], ctx).validas.length, 0)
const c = validarAcciones([{ tipo: 'quitar', n: 2 }, { tipo: 'no_computa', n: 2 }], ctx)
assert.deepEqual(c.validas.map(a => a.tipo), ['quitar'])
console.log('acciones-nota OK')
