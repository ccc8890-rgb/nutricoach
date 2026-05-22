/**
 * Verifica casos clave del guard-no-comestible
 */
const { esProductoNoComestible } = await import('../lib/scraping/guard-no-comestible.ts')

const tests = [
  { nombre: 'Absorbe Olores Frigorifico', esperado: true, razon: 'neutralizador nevera' },
  { nombre: 'Absorbe Olor Lavanda', esperado: true, razon: 'ambientador' },
  { nombre: 'Carrillera Cerdo Oporto', esperado: false, razon: 'comida real (carrilleras)' },
  { nombre: 'Aceite Crema Oliva Mitica', esperado: false, razon: 'aceite de oliva' },
  { nombre: 'Crema Manos Intensiva Aceite Almendras', esperado: true, razon: 'cosmetica manos' },
  { nombre: 'Crema Orujo', esperado: true, razon: 'alcohol (orujo)' },
  { nombre: 'Vino Oporto Fine Tawny', esperado: true, razon: 'vino alcohol' },
  { nombre: 'Bebida energetica Red Bull', esperado: true, razon: 'energy drink' },
  { nombre: 'Bastoncillos algodon bebes', esperado: true, razon: 'higiene bebe' },
  { nombre: 'Locion corporal infantil hidratante', esperado: true, razon: 'cosmetica corporal' },
  { nombre: 'Comida Humeda Gatos Pollo', esperado: true, razon: 'comida mascotas' },
  { nombre: 'Papel hogar Compacto Absorbente', esperado: true, razon: 'papel cocina' },
  { nombre: 'Discos Absorbentes Lactancia', esperado: true, razon: 'puericultura' },
  { nombre: 'Protector Absorbente', esperado: true, razon: 'panal adulto' },
  { nombre: 'Arena Gatos Absorbente', esperado: true, razon: 'arena mascotas' },
  { nombre: 'Algodon magico Aladdin', esperado: true, razon: 'algodon limpieza' },
  { nombre: 'Anís seco Cassalla Cerveró', esperado: true, razon: 'alcohol (anis)' },
]

let ok = 0, fail = 0
for (const t of tests) {
  const result = esProductoNoComestible(t.nombre)
  const status = result === t.esperado ? '✓' : '✗'
  if (result === t.esperado) ok++; else fail++
  console.log(`${status} "${t.nombre}" => ${result} ${result !== t.esperado ? '(esperado: ' + t.esperado + ')' : ''} [${t.razon}]`)
}
console.log(`\n${ok}/${tests.length} ok, ${fail} failures`)
process.exit(fail > 0 ? 1 : 0)
