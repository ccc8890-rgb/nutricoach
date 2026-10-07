import assert from 'node:assert/strict'
import { totalesDiariosMedios, type ComidaMicros } from '../lib/micronutrientes/plan'

const item = (g: number, calcio: number) => ({ cantidad_gramos: g, alimento: { calcio_mg: calcio } })

// Una sola comida recurrente (sin día): vale como un día
const recurrente: ComidaMicros[] = [{ dia_semana: null, comida_alimentos: [item(200, 100)] }]
assert.equal(totalesDiariosMedios(recurrente).calcio_mg, 200)

// Plan de 7 días con 100 mg de calcio al día: la media diaria es 100, no 700
const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const semana: ComidaMicros[] = dias.map(d => ({ dia_semana: d, comida_alimentos: [item(100, 100)] }))
assert.equal(totalesDiariosMedios(semana).calcio_mg, 100)

// Las recurrentes cuentan en todos los días, además de las de cada día
const mixta: ComidaMicros[] = [
  { dia_semana: null, comida_alimentos: [item(100, 50)] },
  { dia_semana: 'Lunes', comida_alimentos: [item(100, 100)] },
  { dia_semana: 'Martes', comida_alimentos: [item(100, 300)] },
]
assert.equal(totalesDiariosMedios(mixta).calcio_mg, 250) // (50+100 + 50+300) / 2

// Día no reconocido: no entra en la media; sin comidas válidas devuelve ceros
assert.equal(totalesDiariosMedios([{ dia_semana: 'Funday', comida_alimentos: [item(100, 100)] }]).calcio_mg, 0)
assert.equal(totalesDiariosMedios([]).calcio_mg, 0)
// Alimentos sin datos o sin cantidad no rompen
assert.equal(totalesDiariosMedios([{ dia_semana: null, comida_alimentos: [{ cantidad_gramos: null, alimento: null }] }]).calcio_mg, 0)
console.log('micronutrientes-plan OK')
