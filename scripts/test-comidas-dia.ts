/**
 * Test del helper REAL `lib/nutricion/comidas-dia.ts`.
 *
 * Ejecutar: npx tsx scripts/test-comidas-dia.ts
 *
 * Cubre: planes diarios antiguos, planes semanales, mixtos, acentos/mayúsculas,
 * texto desconocido, domingo y día vacío. Verifica la selección y el conteo que
 * alimentan los macros del día.
 *
 * No usa red, BD, env ni datos de clientes.
 */

import {
  comidasDelDia,
  diaActualIndex,
  esComidaDelDia,
  indiceDiaDesdeTexto,
} from '../lib/nutricion/comidas-dia'

interface ComidaTest {
  id: string
  nombre: string
  orden: number
  dia_semana?: string | null
}

let total = 0
let fallos = 0

function check(nombre: string, condicion: boolean) {
  total++
  if (condicion) {
    console.log(`  ✓ ${nombre}`)
  } else {
    fallos++
    console.error(`  ✗ ${nombre}`)
  }
}

function igual(nombre: string, actual: unknown, esperado: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(esperado)
  total++
  if (ok) {
    console.log(`  ✓ ${nombre}`)
  } else {
    fallos++
    console.error(`  ✗ ${nombre} → esperado ${JSON.stringify(esperado)}, recibido ${JSON.stringify(actual)}`)
  }
}

function ids(comidas: ComidaTest[]): string[] {
  return comidas.map(c => c.id)
}

/* ── 1. Plan diario antiguo (sin dia_semana) ─────────────── */
console.log('\n1. Plan diario antiguo (comidas sin dia_semana)')
const planDiario: ComidaTest[] = [
  { id: 'desayuno', nombre: 'Desayuno', orden: 1 },
  { id: 'comida', nombre: 'Comida', orden: 2 },
  { id: 'cena', nombre: 'Cena', orden: 3 },
]
for (let dia = 0; dia < 7; dia++) {
  igual(`día ${dia} selecciona las 3 comidas`, ids(comidasDelDia(planDiario, dia)), ['desayuno', 'comida', 'cena'])
}
igual('conteo diario = 3', comidasDelDia(planDiario, 0).length, 3)

/* ── 2. Plan semanal (solo día indicado) ─────────────────── */
console.log('\n2. Plan semanal (comidas asignadas a un día)')
const planSemanal: ComidaTest[] = [
  { id: 'lun', nombre: 'Lunes', orden: 1, dia_semana: 'Lunes' },
  { id: 'mie', nombre: 'Miércoles', orden: 1, dia_semana: 'Miércoles' },
  { id: 'dom', nombre: 'Domingo', orden: 1, dia_semana: 'Domingo' },
]
igual('lunes → solo lun', ids(comidasDelDia(planSemanal, 0)), ['lun'])
igual('miércoles → solo mie', ids(comidasDelDia(planSemanal, 2)), ['mie'])
igual('domingo → solo dom', ids(comidasDelDia(planSemanal, 6)), ['dom'])
igual('martes → vacío', ids(comidasDelDia(planSemanal, 1)), [])
igual('conteo martes = 0', comidasDelDia(planSemanal, 1).length, 0)

/* ── 3. Plan mixto (recurrentes + asignadas) ─────────────── */
console.log('\n3. Plan mixto (recurrentes + asignadas)')
const planMixto: ComidaTest[] = [
  { id: 'rec', nombre: 'Recurrente', orden: 1 },
  { id: 'lun', nombre: 'Solo lunes', orden: 2, dia_semana: 'Lunes' },
  { id: 'dom', nombre: 'Solo domingo', orden: 3, dia_semana: 'Domingo' },
]
igual('lunes → rec + lun', ids(comidasDelDia(planMixto, 0)), ['rec', 'lun'])
igual('domingo → rec + dom', ids(comidasDelDia(planMixto, 6)), ['rec', 'dom'])
igual('martes → solo rec', ids(comidasDelDia(planMixto, 1)), ['rec'])
igual('conteo martes = 1', comidasDelDia(planMixto, 1).length, 1)

/* ── 4. Acentos y mayúsculas ─────────────────────────────── */
console.log('\n4. Acentos y mayúsculas')
igual('"miércoles" → 2', indiceDiaDesdeTexto('miércoles'), 2)
igual('"MIERCOLES" → 2', indiceDiaDesdeTexto('MIERCOLES'), 2)
igual('" Miércoles " → 2', indiceDiaDesdeTexto(' Miércoles '), 2)
igual('"sábado" → 5', indiceDiaDesdeTexto('sábado'), 5)
igual('"SABADO" → 5', indiceDiaDesdeTexto('SABADO'), 5)
igual('"domingo" → 6', indiceDiaDesdeTexto('domingo'), 6)

const planAcentos: ComidaTest[] = [
  { id: 'mie', nombre: 'Miércoles', orden: 1, dia_semana: 'MIERCOLES' },
  { id: 'sab', nombre: 'Sábado', orden: 2, dia_semana: 'sábado' },
]
igual('MIERCOLES selecciona miércoles', ids(comidasDelDia(planAcentos, 2)), ['mie'])
igual('sábado selecciona sábado', ids(comidasDelDia(planAcentos, 5)), ['sab'])

/* ── 5. Texto desconocido (no pertenece a ningún día) ────── */
console.log('\n5. Texto desconocido')
igual('"Funday" → null', indiceDiaDesdeTexto('Funday'), null)
igual('"Lun" (abreviatura) → null', indiceDiaDesdeTexto('Lun'), null)
igual('"" → null', indiceDiaDesdeTexto(''), null)
igual('"   " → null', indiceDiaDesdeTexto('   '), null)
igual('null → null', indiceDiaDesdeTexto(null), null)
igual('undefined → null', indiceDiaDesdeTexto(undefined), null)

const comidaDesconocida: ComidaTest = { id: 'x', nombre: 'X', orden: 1, dia_semana: 'Funday' }
check('desconocido NO se mapea a lunes (índice null)', indiceDiaDesdeTexto('Funday') === null)
check('desconocido NO es recurrente (no aparece lunes)', esComidaDelDia(comidaDesconocida, 0) === false)
check('desconocido NO es recurrente (no aparece martes)', esComidaDelDia(comidaDesconocida, 1) === false)
check('desconocido NO es recurrente (no aparece domingo)', esComidaDelDia(comidaDesconocida, 6) === false)
igual('desconocido no aparece ningún día', ids(comidasDelDia([comidaDesconocida], 3)), [])

/* ── 6. Domingo ──────────────────────────────────────────── */
console.log('\n6. Domingo')
igual('"Domingo" → 6', indiceDiaDesdeTexto('Domingo'), 6)
igual('domingo selecciona solo dom', ids(comidasDelDia(planSemanal, 6)), ['dom'])

/* ── 7. Día vacío ────────────────────────────────────────── */
console.log('\n7. Día vacío')
igual('día sin comidas → []', ids(comidasDelDia(planSemanal, 1)), [])
igual('lista vacía → []', comidasDelDia<ComidaTest>([], 0), [])
igual('null → []', comidasDelDia<ComidaTest>(null, 0), [])
igual('undefined → []', comidasDelDia<ComidaTest>(undefined, 0), [])

/* ── 8. Orden por `orden` ────────────────────────────────── */
console.log('\n8. Orden por `orden`')
const desordenado: ComidaTest[] = [
  { id: 'c', nombre: 'C', orden: 3 },
  { id: 'a', nombre: 'A', orden: 1 },
  { id: 'b', nombre: 'B', orden: 2 },
]
igual('ordena ascendente por orden', ids(comidasDelDia(desordenado, 0)), ['a', 'b', 'c'])

/* ── 9. Día local actual ─────────────────────────────────── */
console.log('\n9. Día local actual')
igual('2026-09-21 (lunes) → 0', diaActualIndex(new Date(2026, 8, 21)), 0)
igual('2026-09-24 (jueves) → 3', diaActualIndex(new Date(2026, 8, 24)), 3)
igual('2026-09-27 (domingo) → 6', diaActualIndex(new Date(2026, 8, 27)), 6)

/* ── Resumen ─────────────────────────────────────────────── */
console.log(`\n${total - fallos}/${total} comprobaciones OK`)
if (fallos > 0) {
  console.error(`${fallos} fallo(s)`)
  process.exit(1)
}
console.log('Todo OK')