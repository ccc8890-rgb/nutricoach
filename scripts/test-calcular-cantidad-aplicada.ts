/**
 * Test del helper puro `lib/recetas/aplicar-receta-comida.ts`.
 * Ejecutar: npx tsx scripts/test-calcular-cantidad-aplicada.ts
 *
 * Cubre: comportamiento retrocompatible (sin factorDirecto = igual que
 * antes), factorDirecto sustituye al damping por rol, cantidad fija nunca
 * escala, redondeo práctico se sigue aplicando.
 * No usa red, BD, env ni datos de clientes.
 */
import { calcularCantidadAplicadaReceta } from '../lib/recetas/aplicar-receta-comida'

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

console.log('1. Retrocompatibilidad — sin factorDirecto, igual que antes')
{
  const sinDirecto = calcularCantidadAplicadaReceta(100, 'grasa_saludable', false, 2)
  // grasa_saludable con factorBase=2 → damping: 1 + (2-1)*0.5 = 1.5 → 150g
  check('grasa_saludable amortigua factor 2 a 1.5 (sin factorDirecto)', sinDirecto.cantidad_gramos === 150)
}

console.log('\n2. factorDirecto sustituye el damping por completo')
{
  const conDirecto = calcularCantidadAplicadaReceta(100, 'grasa_saludable', false, 2, 1.8)
  // Con factorDirecto=1.8 (sin damping): 100*1.8=180 → redondeo práctico
  // (>120g → múltiplo de 25) = 175. El damping por rol habría dado 150g
  // (factorBase=2 → 1+(2-1)*0.5=1.5 → 150g): 175 prueba que se ignoró.
  check('grasa_saludable con factorDirecto=1.8 da 175g (sin damping, no 150)', conDirecto.cantidad_gramos === 175)
}

console.log('\n3. Cantidad fija nunca escala, ni con factorDirecto')
{
  const fija = calcularCantidadAplicadaReceta(5, 'especias_aromaticos', true, 3, 2.5)
  check('cantidad fija ignora factorBase y factorDirecto', fija.cantidad_gramos === 5)
}

console.log('\n4. factorDirecto null/undefined se ignora — usa el flujo normal')
{
  const nulo = calcularCantidadAplicadaReceta(100, 'proteina_principal', false, 1.5, null)
  // proteina_principal no amortigua: factor directo del rol = factorBase = 1.5 → 150g
  check('factorDirecto=null cae al comportamiento normal (150g)', nulo.cantidad_gramos === 150)
}

console.log('\n5. Redondeo práctico se sigue aplicando con factorDirecto')
{
  const impreciso = calcularCantidadAplicadaReceta(37, 'carbohidrato_base', false, 1, 1.13)
  // 37 * 1.13 = 41.81 → redondeo práctico (<=50g → múltiplo de 5) = 40
  check('redondeo práctico aplicado sobre resultado de factorDirecto', impreciso.cantidad_gramos === 40)
}

console.log('\n6. factor_ajuste reportado refleja el resultado final, no el factor pedido')
{
  const r = calcularCantidadAplicadaReceta(200, 'carbohidrato_base', false, 1, 1.5)
  // 200*1.5=300 (ya múltiplo práctico) → factor_ajuste real = 300/200 = 1.5
  check('factor_ajuste = cantidad_final/cantidad_base', Math.abs(r.factor_ajuste - 1.5) < 0.001)
}

console.log(`\n${total - fallos}/${total} comprobaciones OK`)
if (fallos > 0) {
  console.error(`${fallos} fallo(s)`)
  process.exit(1)
}
console.log('Todo OK')
