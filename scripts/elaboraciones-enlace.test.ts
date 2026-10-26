import assert from 'node:assert/strict'
import { aplanarLineas, pesoFinal, macrosPor100g, macrosPorRacion, CicloElaboracion, type Linea, type Elaboracion } from '../lib/recetas/elaboraciones'

const al = (id: string, cal: number) => ({ id, nombre: id, calorias: cal, proteinas: cal / 10, carbohidratos: cal / 5, grasas: cal / 20, fibra: 1 })
const HARINA = al('harina', 364), AGUA = al('agua', 0), LEV = al('levadura', 325)
const l = (id: string, alimento: ReturnType<typeof al>, g: number): Linea => ({ id, alimento_id: alimento.id, alimento, cantidad_gramos: g })
const e = (id: string, g: number): Linea => ({ id, elaboracion_id: id, cantidad_gramos: g })
const suma = (ls: Linea[], alimentoId: string) => ls.filter(x => x.alimento_id === alimentoId).reduce((a, x) => a + x.cantidad_gramos, 0)
const cerca = (a: number, b: number, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`)

const masa: Elaboracion = { peso_final_g: null, lineas: [l('m1', HARINA, 300), l('m2', AGUA, 200), l('m3', LEV, 1)] }
assert.equal(pesoFinal(masa), 501)
assert.equal(pesoFinal({ peso_final_g: 450, lineas: masa.lineas }), 450)

// Escala por gramos usados
{
  const r = aplanarLineas([{ id: 'r1', elaboracion_id: 'MASA', cantidad_gramos: 250 }], new Map([['MASA', masa]]))
  cerca(suma(r.lineas, 'harina'), 149.7); cerca(suma(r.lineas, 'agua'), 99.8); cerca(suma(r.lineas, 'levadura'), 0.5)
  assert.deepEqual(r.sinResolver, [])
}
// Con peso_final declarado manda ese peso
{
  const r = aplanarLineas([{ id: 'r1', elaboracion_id: 'MASA', cantidad_gramos: 250 }], new Map([['MASA', { ...masa, peso_final_g: 450 }]]))
  cerca(suma(r.lineas, 'harina'), 166.67)
}
// Elaboración dentro de elaboración
{
  const pool: Elaboracion = { peso_final_g: null, lineas: [l('p1', HARINA, 50), l('p2', AGUA, 50)] }
  const masa2: Elaboracion = { peso_final_g: null, lineas: [l('a1', HARINA, 300), l('a2', AGUA, 200), { id: 'a3', elaboracion_id: 'POOL', cantidad_gramos: 100 }] }
  const r = aplanarLineas([{ id: 'r1', elaboracion_id: 'MASA2', cantidad_gramos: 250 }], new Map([['MASA2', masa2], ['POOL', pool]]))
  cerca(suma(r.lineas, 'harina'), 145.83); assert.deepEqual(r.sinResolver, [])
}
// Tercer nivel: no se expande y se avisa
{
  const A: Elaboracion = { peso_final_g: null, lineas: [{ id: 'la', elaboracion_id: 'B', cantidad_gramos: 100 }] }
  const B: Elaboracion = { peso_final_g: null, lineas: [{ id: 'lb', elaboracion_id: 'C', cantidad_gramos: 100 }] }
  const C: Elaboracion = { peso_final_g: null, lineas: [l('lc', HARINA, 100)] }
  const r = aplanarLineas([e('A', 100)], new Map([['A', A], ['B', B], ['C', C]]))
  assert.deepEqual(r.sinResolver, ['lb']); assert.equal(suma(r.lineas, 'harina'), 0)
}
// Ciclos
{
  const A: Elaboracion = { peso_final_g: null, lineas: [{ id: 'x', elaboracion_id: 'B', cantidad_gramos: 10 }] }
  const B: Elaboracion = { peso_final_g: null, lineas: [{ id: 'y', elaboracion_id: 'A', cantidad_gramos: 10 }] }
  assert.throws(() => aplanarLineas([e('A', 10)], new Map([['A', A], ['B', B]])), CicloElaboracion)
  const S: Elaboracion = { peso_final_g: null, lineas: [{ id: 'z', elaboracion_id: 'S', cantidad_gramos: 10 }] }
  assert.throws(() => aplanarLineas([e('S', 10)], new Map([['S', S]])), CicloElaboracion)
  const C: Elaboracion = { peso_final_g: null, lineas: [{ id: 'w', elaboracion_id: 'RAIZ', cantidad_gramos: 10 }] }
  assert.throws(() => aplanarLineas([e('C', 10)], new Map([['C', C]]), { raiz: 'RAIZ' }), CicloElaboracion)
}
// Peso 0 o elaboración ausente: sin NaN
{
  const vacia: Elaboracion = { peso_final_g: null, lineas: [] }
  const r = aplanarLineas([{ id: 'q1', elaboracion_id: 'V', cantidad_gramos: 50 }, { id: 'q2', elaboracion_id: 'NO', cantidad_gramos: 50 }], new Map([['V', vacia]]))
  assert.deepEqual(r.lineas, []); assert.deepEqual(r.sinResolver, ['q1', 'q2'])
}
// Opcionales a 0 g se conservan y no aportan
{
  const r = aplanarLineas([{ id: 'o', nombre_libre: 'sal', cantidad_gramos: 0, es_opcional: true }, l('h', HARINA, 100)], new Map())
  assert.equal(r.lineas.length, 2)
  assert.equal(macrosPorRacion(r.lineas, 2).kcal, 182)
}
// Macros por 100 g de una elaboración
{
  const m = macrosPor100g(masa.lineas, pesoFinal(masa))
  cerca(m.kcal, (364 * 3 + 3.25) / 501 * 100, 0.01)
  assert.deepEqual(macrosPor100g(masa.lineas, 0), { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 })
}
// La compra no pierde ni duplica: harina propia + harina de la masa en una sola suma
{
  const r = aplanarLineas([l('h', HARINA, 100), { id: 'r1', elaboracion_id: 'MASA', cantidad_gramos: 250 }], new Map([['MASA', masa]]))
  cerca(suma(r.lineas, 'harina'), 249.7); cerca(suma(r.lineas, 'agua'), 99.8)
}
console.log('elaboraciones-enlace.test OK')
