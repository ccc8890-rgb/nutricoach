import assert from 'node:assert/strict'
import { contextoRecetaCompeticion, puntuarRecetaCompeticion } from '../lib/nutricion/receta-competicion'
import type { ObjetivoDia } from '../lib/nutricion/objetivo-dia'
import { claveCompeticion, repartirSemanaSinRepetir, type CandidataSemana, type Hueco } from '../lib/nutricion/generar-semana'

const receta = (id: string, datos: Partial<CandidataSemana> = {}): CandidataSemana => ({
  id,
  nombre: id,
  kcal: 500,
  proteinas: 25,
  carbohidratos: 60,
  grasas: 15,
  fibra: 5,
  ...datos,
})

const objetivo = (fase: 'carrera_inminente' | 'race_day' | 'recuperacion', dias_restantes: number) => ({
  competicion: { fase, dias_restantes, nombre: 'Prueba' },
} as ObjetivoDia)

assert.equal(contextoRecetaCompeticion(objetivo('carrera_inminente', 1)), 'vispera')
assert.equal(contextoRecetaCompeticion(objetivo('carrera_inminente', 2)), undefined)
assert.equal(contextoRecetaCompeticion(objetivo('race_day', 0)), 'carrera')
assert.equal(contextoRecetaCompeticion(objetivo('recuperacion', -2)), 'recuperacion')
assert.equal(contextoRecetaCompeticion(objetivo('recuperacion', -3)), undefined)

// Rompería si el ranking dejara de favorecer hidratos altos con fibra y grasa bajas.
{
  const carga = receta('Arroz con pollo', { carbohidratos: 90, grasas: 8, fibra: 3 })
  const grasa = receta('Ensalada grasa', { carbohidratos: 25, grasas: 30, fibra: 10 })
  assert.ok(puntuarRecetaCompeticion(carga, 'vispera', 'Comida') > puntuarRecetaCompeticion(grasa, 'vispera', 'Comida'))
}

// Fibra ausente es neutral: no obtiene el bonus de fibra baja ni una penalización.
{
  const base = receta('base', { fibra: undefined })
  const baja = receta('baja', { fibra: 3 })
  const alta = receta('alta', { fibra: 10 })
  assert.ok(puntuarRecetaCompeticion(baja, 'carrera', 'Desayuno') > puntuarRecetaCompeticion(base, 'carrera', 'Desayuno'))
  assert.ok(puntuarRecetaCompeticion(base, 'carrera', 'Desayuno') > puntuarRecetaCompeticion(alta, 'carrera', 'Desayuno'))
}

// El desayuno de carrera premia el tag pre; la recuperación premia post y proteína.
{
  const pre = receta('Tostadas', { pre: true })
  const normal = receta('Tostadas normales')
  assert.ok(puntuarRecetaCompeticion(pre, 'carrera', 'Desayuno') > puntuarRecetaCompeticion(normal, 'carrera', 'Desayuno'))
  const recuperadora = receta('Batido post', { post: true, proteinas: 40 })
  assert.ok(puntuarRecetaCompeticion(recuperadora, 'recuperacion', 'Merienda') > puntuarRecetaCompeticion(normal, 'recuperacion', 'Merienda'))
}

// En víspera el reparto elige la receta específica aunque no sea la primera del ranking base.
{
  const candidatas = {
    Comida: [
      receta('ensalada', { nombre: 'Ensalada de aguacate', carbohidratos: 25, grasas: 30, fibra: 11 }),
      receta('arroz', { nombre: 'Arroz blanco con pavo', carbohidratos: 92, grasas: 7, fibra: 3 }),
    ],
  }
  const huecos: Hueco[] = [{ dia: 'Sábado', franja: 'Comida', competicion: 'vispera' }]
  assert.equal(repartirSemanaSinRepetir(candidatas, huecos).asignaciones[0].receta_id, 'arroz')
}

// Sin competición se conserva exactamente el orden previo del motor.
{
  const candidatas = {
    Comida: [
      receta('primera', { nombre: 'Primera por encaje base' }),
      receta('segunda', { nombre: 'Arroz', carbohidratos: 100, grasas: 4, fibra: 2 }),
    ],
  }
  const huecos: Hueco[] = [{ dia: 'Lunes', franja: 'Comida' }]
  assert.equal(repartirSemanaSinRepetir(candidatas, huecos).asignaciones[0].receta_id, 'primera')
}

// Candidatas pedidas con el objetivo del día de competición: el hueco de víspera usa su lista; el resto, la de la franja
{
  const base: CandidataSemana[] = [{ id: 'base', nombre: 'Plato base', kcal: 500, carbohidratos: 30, grasas: 25 }]
  const vispera: CandidataSemana[] = [{ id: 'vispera', nombre: 'Arroz blanco con pollo', kcal: 600, carbohidratos: 85, grasas: 10 }]
  const huecos: Hueco[] = [{ dia: 'Sábado', franja: 'Comida', competicion: 'vispera' }, { dia: 'Lunes', franja: 'Comida' }]
  const r = repartirSemanaSinRepetir({ Comida: base }, huecos, undefined, { [claveCompeticion('vispera', 'Comida')]: vispera })
  assert.equal(r.asignaciones.find(a => a.dia === 'Sábado')!.receta_id, 'vispera')
  assert.equal(r.asignaciones.find(a => a.dia === 'Lunes')!.receta_id, 'base')
  // Sin lista específica o vacía se recurre a la de la franja
  assert.equal(repartirSemanaSinRepetir({ Comida: base }, [huecos[0]], undefined, { [claveCompeticion('vispera', 'Comida')]: [] }).asignaciones[0].receta_id, 'base')
  assert.equal(repartirSemanaSinRepetir({ Comida: base }, [huecos[0]]).asignaciones[0].receta_id, 'base')
}

console.log('receta-competicion: OK')
