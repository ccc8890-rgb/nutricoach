import assert from 'node:assert/strict'
import { clientePorDefecto, etiquetarClientes, type ClienteApi } from '../lib/contenido/clientes'

const c = (id: string, nombre: string, apellidos: string, email: string, plan: string | null, activo = true): ClienteApi =>
  ({ id, nombre, apellidos, email, activo, plan_activo: plan ? { id: 'p' + id, nombre: plan } : null })

const lista = [
  c('a', 'Natalia', '', 'n@x.com', 'Plan N'),
  c('b', 'Carlos', '', 'ccc8890@gmail.com', 'Plan rendimiento'),
  c('d', 'Carlos', '', 'otro@x.com', 'Plan mantenimiento híbrido — Carlos'),
  c('e', 'Sin plan', '', 's@x.com', null),
]

// Nombre completo; los repetidos se distinguen por el plan
const et = etiquetarClientes(lista)
assert.equal(et.find(x => x.id === 'a')?.etiqueta, 'Natalia')
assert.equal(et.find(x => x.id === 'b')?.etiqueta, 'Carlos · Plan rendimiento')
assert.equal(et.find(x => x.id === 'd')?.etiqueta, 'Carlos · Plan mantenimiento híbrido — Carlos')
// Sin plan activo no sirven para dieta
assert.equal(et.some(x => x.id === 'e'), false)

// Dos con el mismo nombre completo y mismo plan: se distinguen por el correo
const iguales = etiquetarClientes([c('x', 'Ana', '', 'a1@x.com', 'P'), c('y', 'Ana', '', 'a2@x.com', 'P')])
assert.notEqual(iguales[0].etiqueta, iguales[1].etiqueta)

// Por defecto: lo guardado si sigue existiendo; si no, el coach (apellido Casanova); si no, el primero
assert.equal(clientePorDefecto(et, 'a'), 'a')
// el coach se reconoce por apellido Casanova o por su correo
const coach = [...lista.slice(0, 1), c('z', 'Carlos', 'Casanova', 'otro@y.com', 'Plan Z')]
assert.equal(clientePorDefecto(etiquetarClientes(coach), null, coach), 'z')
assert.equal(clientePorDefecto(et, 'inexistente', lista), 'b')
assert.equal(clientePorDefecto(et, null, lista), 'b')
assert.equal(clientePorDefecto(etiquetarClientes([lista[0]]), null), 'a')
assert.equal(clientePorDefecto([], null), '')
console.log('contenido-clientes OK')
