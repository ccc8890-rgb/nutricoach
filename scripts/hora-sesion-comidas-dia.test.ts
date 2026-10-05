import assert from 'node:assert/strict'
import { objetivosPorDia } from '../lib/nutricion/objetivo-dia'
import { franjasDeComidasDia } from '../lib/nutricion/semana-dieta'

// Comidas al día -> franjas
assert.deepEqual(franjasDeComidasDia(3), ['Desayuno', 'Comida', 'Cena'])
assert.deepEqual(franjasDeComidasDia(4), ['Desayuno', 'Comida', 'Merienda', 'Cena'])
assert.equal(franjasDeComidasDia(5).length, 5)
assert.deepEqual(franjasDeComidasDia(null), [])
assert.deepEqual(franjasDeComidasDia(9), [])

// Hora de la sesión sobre la hora del cuestionario (BD simulada)
function bd(horaSesion: string | null) {
  const datos: Record<string, unknown> = {
    competiciones: [], planes_entrenamiento: { id: 'p' },
    sesiones_entrenamiento: [{ nombre: 'Fuerza pierna', dia_semana: 'Lunes', hora_inicio: horaSesion }],
    onboarding_perfil_profundo: { hora_entreno: '07:00' },
    comidas: [{ nombre: 'Desayuno' }, { nombre: 'Comida' }, { nombre: 'Cena' }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (t: string): any => { const q: any = { select: () => q, eq: () => q, limit: () => q, maybeSingle: async () => ({ data: datos[t] }), then: (r: (v: unknown) => unknown) => r({ data: datos[t] }) }; return q }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: c } as any
}
const plan = { id: 'x', kcal_objetivo: 3000, proteinas_objetivo: 150, carbohidratos_objetivo: 380, grasas_objetivo: 90 }
;(async () => {
  const manana = (await objetivosPorDia(bd(null), 'c', plan as never))['Lunes'].momento!
  const tarde = (await objetivosPorDia(bd('19:00'), 'c', plan as never))['Lunes'].momento!
  assert.match(manana.hora, /^07:00/)
  assert.match(tarde.hora, /^19:00/)
  assert.notEqual(manana.pre, tarde.pre)
  console.log('hora-sesion-comidas-dia: OK')
})()
