import assert from 'node:assert/strict'
import { DOI, calcularFiabilidad, esSegura, evaluarReglas, MIN_CARRERAS } from '../lib/rendimiento/reglas'
import { CLAVES_METRICA } from '../lib/rendimiento/seguimiento'
import type { EstadoAtleta } from '../lib/rendimiento/estado'
import type { ResumenIntensidad } from '../lib/rendimiento/intensidad'
import type { ResumenCarga } from '../lib/rendimiento/pmc'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'

const inten = (suave: number, media: number, dura: number, minutos = 360): ResumenIntensidad => ({
  minutos, pctSuave: suave, pctMedia: media, pctDura: dura,
  valoracion: suave >= 75 ? 'bien' : media >= 30 ? 'zona_gris' : dura > 25 ? 'muy_duro' : 'mejorable',
})
const carga = (o: Partial<ResumenCarga> = {}): ResumenCarga => ({ ctl: 30, atl: 30, tsb: 0, rampa7: 1, carga7d: 150, carga28d: 600, monotonia: 1.2, tension: 100, estado: 'equilibrado' as never, textoEstado: 'Equilibrado', ...o })

/** Atleta sano de referencia: se modifica por caso. */
function atleta(o: Partial<EstadoAtleta> = {}): EstadoAtleta {
  return {
    hoy: '2026-10-10', carreras6sem: 14, fcUmbral: 177, vdot: 45, ritmos: ritmosDesdeVdot(45),
    carga: carga(), intensidad: inten(80, 12, 8), intensidadPrevia: inten(78, 14, 8),
    limitesFc: { suaveHasta: 159, mediaHasta: 177 },
    deriva: { media: 4, n: 5 }, eficiencia: { ultimas3: 1.2, previas3: 1.15 },
    fuerza28d: 8, fuerzaEnPlan: 2, carrerasPorSemana: 4, kmPorSemana: 40,
    ejecucion: { repsEvaluadas: 12, repsLentas: 2, sesionesEvaluadas: 4, sesionesSaltadas: 0 },
    diasCompeticion: null, alertas: [], ...o,
  }
}
const ids = (e: EstadoAtleta) => evaluarReglas(e).propuestas.map(p => p.regla)

// 1. Atleta sano y estable: solo cabe progresar.
assert.deepEqual(ids(atleta()), ['progresion'])

// 2. Caso real de Carlos (36/52/12, deriva 10, VDOT 45): reparto suave; la deriva queda dentro de esa propuesta.
const carlos = atleta({ intensidad: inten(36, 52, 12, 339), intensidadPrevia: inten(40, 58, 2, 279), deriva: { media: 10.1, n: 5 }, kmPorSemana: 19, carrerasPorSemana: 3 })
const rc = evaluarReglas(carlos).propuestas
assert.ok(rc.some(p => p.regla === 'reparto_suave'))
assert.ok(!rc.some(p => p.regla === 'deriva_alta'), 'la deriva no se duplica cuando ya manda el reparto')
const reparto = rc.find(p => p.regla === 'reparto_suave')!
assert.ok(reparto.cambio.includes('159 ppm') && reparto.cambio.includes('5:54/km'), reparto.cambio)
assert.ok(reparto.razon.includes('36 %') && reparto.razon.includes('52 %') && reparto.razon.includes('40 %'), reparto.razon)
assert.equal(reparto.metrica_objetivo, 'pct_suave')
assert.equal(reparto.riesgo, 'bajo')

// 3. Sobrecarga: manda y silencia las propuestas de reparto y progresión.
const sobre = atleta({ carga: carga({ tsb: -35, rampa7: 9 }), alertas: ['fatiga_alta', 'rampa_alta'], intensidad: inten(30, 50, 20) })
assert.deepEqual(ids(sobre), ['sobrecarga'])
assert.equal(evaluarReglas(sobre).propuestas[0].prioridad, 1)

// 4. Tapering a 10 días; a 20 días no.
assert.ok(ids(atleta({ diasCompeticion: 10 })).includes('tapering'))
assert.ok(!ids(atleta({ diasCompeticion: 20 })).includes('tapering'))
assert.ok(!ids(atleta({ diasCompeticion: 10 })).includes('progresion'), 'no se sube volumen con una carrera a 10 días')
assert.ok(evaluarReglas(atleta({ diasCompeticion: 5 })).propuestas.find(p => p.regla === 'tapering')!.cambio.includes('50-60 %'))

// 5. Pocos datos: no propone nada de entrenamiento y lo explica.
const pocos = evaluarReglas(atleta({ carreras6sem: MIN_CARRERAS - 1, intensidad: inten(30, 50, 20) }))
assert.deepEqual(pocos.propuestas, [])
assert.ok(pocos.notas[0].includes('necesita al menos'))
// ...pero una sobrecarga se avisa aunque haya pocos datos.
assert.ok(ids(atleta({ carreras6sem: 2, alertas: ['fatiga_alta'], carga: carga({ tsb: -40 }) })).includes('sobrecarga'))

// 6. Reparto bueno pero deriva alta: regla de deriva.
assert.deepEqual(ids(atleta({ deriva: { media: 12, n: 5 } })), ['deriva_alta'])
// Con menos de 4 carreras con deriva no se concluye nada.
assert.ok(!ids(atleta({ deriva: { media: 12, n: 3 } })).includes('deriva_alta'))

// 7. Series y tempo lentos.
assert.ok(ids(atleta({ ejecucion: { repsEvaluadas: 12, repsLentas: 8, sesionesEvaluadas: 4, sesionesSaltadas: 0 } })).includes('ejecucion_lenta'))
assert.ok(!ids(atleta({ ejecucion: { repsEvaluadas: 6, repsLentas: 6, sesionesEvaluadas: 2, sesionesSaltadas: 0 } })).includes('ejecucion_lenta'), 'pocas repeticiones no bastan')

// 8. Fuerza: sin fuerza en el plan se propone; con fuerza en el plan pero sin registro, se pide confirmar.
assert.ok(ids(atleta({ fuerzaEnPlan: 0, fuerza28d: 0, deriva: { media: 5, n: 5 } })).includes('fuerza'))
assert.ok(ids(atleta({ fuerzaEnPlan: 2, fuerza28d: 1 })).includes('fuerza_sin_registro'))
assert.ok(!ids(atleta({ fuerzaEnPlan: 0, fuerza28d: 0, carrerasPorSemana: 1 })).includes('fuerza'), 'con 1 carrera por semana no se añade fuerza')

// 9. Pulso en reposo y monotonía.
assert.ok(ids(atleta({ alertas: ['rhr_alto'] })).includes('pulso_reposo'))
assert.ok(ids(atleta({ alertas: ['monotonia'], carga: carga({ monotonia: 2.4 }) })).includes('monotonia'))

// 10. Orden por prioridad y determinismo (misma entrada, misma salida, sin tocar la entrada).
const entrada = atleta({ diasCompeticion: 9, alertas: ['rhr_alto'], intensidad: inten(40, 40, 20) })
const copia = JSON.stringify(entrada)
const a = evaluarReglas(entrada)
assert.deepEqual(a, evaluarReglas(entrada))
assert.equal(JSON.stringify(entrada), copia)
assert.deepEqual(a.propuestas.map(p => p.prioridad), [...a.propuestas.map(p => p.prioridad)].sort((x, y) => x - y))

// 11. Integridad de todas las propuestas posibles: DOI conocidos, métrica válida y dirección solo donde aplica.
const todas = [sobre, carlos, atleta({ diasCompeticion: 5, alertas: ['rhr_alto', 'monotonia'], carga: carga({ monotonia: 2.5 }), fuerzaEnPlan: 0, fuerza28d: 0, deriva: { media: 12, n: 5 }, ejecucion: { repsEvaluadas: 10, repsLentas: 9, sesionesEvaluadas: 3, sesionesSaltadas: 0 } }), atleta(), atleta({ fuerzaEnPlan: 2, fuerza28d: 1 })]
const validos = new Set<string>(Object.values(DOI))
const vistas = new Set<string>()
for (const est of todas) for (const p of evaluarReglas(est).propuestas) {
  vistas.add(p.regla)
  for (const d of p.dois) assert.ok(validos.has(d), `${p.regla}: DOI desconocido ${d}`)
  if (p.metrica_objetivo) assert.ok((CLAVES_METRICA as readonly string[]).includes(p.metrica_objetivo))
  if (p.direccion) assert.ok(p.metrica_objetivo === 'carga_semana' || p.metrica_objetivo === 'km_semana', `${p.regla}: dirección sin sentido`)
  if (p.metrica_objetivo === 'carga_semana' || p.metrica_objetivo === 'km_semana') assert.ok(p.direccion, `${p.regla}: falta dirección`)
  assert.ok(p.cambio.length > 20 && p.razon.length > 20)
  assert.ok(p.datos >= 0 && p.datos <= 1 && p.persistencia >= 0 && p.persistencia <= 1)
  assert.ok(!/NaN|undefined|null/.test(p.cambio + p.razon), `${p.regla}: texto con valores vacíos → ${p.cambio} ${p.razon}`)
}
for (const regla of ['sobrecarga', 'tapering', 'reparto_suave', 'deriva_alta', 'ejecucion_lenta', 'fuerza', 'fuerza_sin_registro', 'monotonia', 'pulso_reposo', 'progresion']) assert.ok(vistas.has(regla), `la regla ${regla} no se ha ejercitado`)

// 12. Fiabilidad: más datos y mejor evidencia suben; la IA queda por debajo y nunca pasa de 0,8.
const fuerte = calcularFiabilidad({ datos: 1, persistencia: 1, nivelesEvidencia: ['meta_analisis', 'rct'], origen: 'regla' })
const debil = calcularFiabilidad({ datos: 0.3, persistencia: 0.5, nivelesEvidencia: [], origen: 'regla' })
const ia = calcularFiabilidad({ datos: 1, persistencia: 1, nivelesEvidencia: ['meta_analisis'], origen: 'ia' })
assert.ok(fuerte.valor > debil.valor && fuerte.nivel === 'alta' && debil.nivel === 'baja')
assert.ok(ia.valor < fuerte.valor && ia.valor <= 0.8)
assert.ok(debil.motivos.includes('sin estudios que lo respalden (criterio de entrenador)'))
assert.ok(ia.motivos.some(m => m.includes('IA')))

// 13. «Segura» solo si es de una regla, de riesgo bajo y con fiabilidad suficiente.
assert.equal(esSegura({ riesgo: 'bajo', fiabilidad: fuerte, origen: 'regla' }), true)
assert.equal(esSegura({ riesgo: 'medio', fiabilidad: fuerte, origen: 'regla' }), false)
assert.equal(esSegura({ riesgo: 'bajo', fiabilidad: debil, origen: 'regla' }), false)
assert.equal(esSegura({ riesgo: 'bajo', fiabilidad: fuerte, origen: 'ia' }), false)
console.log('reglas.test OK')
