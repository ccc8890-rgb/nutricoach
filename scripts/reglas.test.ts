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
    fuerza28d: 8, fuerzaEnPlan: 2, carrerasPorSemana: 4, kmPorSemana: 40, minutosCarreraPorSemana: 240,
    ejecucion: { repsEvaluadas: 12, repsLentas: 2, sesionesEvaluadas: 4, sesionesSaltadas: 0 },
    diasCompeticion: null, competicion: null, retorno: false, semanasParon: 0, tiradaLarga: { minutos: 60, pctSemana: 25 }, semanasSinDescarga: 2, enDescarga: false, suaveDaniels: null,
    perfil: { nivel: 'intermedio', diasDisponibles: 6, lesiones: [], restricciones: null, recuperacion: 'media' },
    alertas: [], ...o,
  }
}
const comp = (dias: number, disciplina: string, tiempoObjetivoMin: number | null = null) => ({ dias, disciplina, tiempoObjetivoMin })
const ids = (e: EstadoAtleta) => evaluarReglas(e).propuestas.map(p => p.regla)

// 1. Atleta sano y estable: solo cabe progresar.
assert.deepEqual(ids(atleta()), ['progresion'])

// 2. Caso real de Carlos (36/52/12, deriva baja sin contar el calentamiento, VDOT 45): reparto suave; la deriva queda dentro de esa propuesta.
const carlos = atleta({ intensidad: inten(36, 52, 12, 339), intensidadPrevia: inten(40, 58, 2, 279), deriva: { media: 3, n: 3 }, kmPorSemana: 19, carrerasPorSemana: 3 })
const rc = evaluarReglas(carlos).propuestas
assert.ok(rc.some(p => p.regla === 'reparto_suave'))
assert.ok(!rc.some(p => p.regla === 'deriva_alta'), 'la deriva no se propone cuando es baja o ya manda el reparto')
const reparto = rc.find(p => p.regla === 'reparto_suave')!
assert.ok(reparto.cambio.includes('159 ppm') && reparto.cambio.includes('5:54/km'), reparto.cambio)
assert.ok(reparto.razon.includes('36 %') && reparto.razon.includes('52 %') && reparto.razon.includes('40 %'), reparto.razon)
assert.equal(reparto.metrica_objetivo, 'pct_suave')
assert.equal(reparto.riesgo, 'bajo')
assert.ok(reparto.cambio.includes('por debajo de 150 ppm') && reparto.cambio.includes('hablar en frases completas'), reparto.cambio)
assert.ok(!reparto.razon.includes('rodajes demasiado fuertes'))

// Con deriva baja el motor lo dice y baja la urgencia: es optimizar, no corregir un problema.
assert.ok(reparto.razon.includes('tolera bien esos ritmos'))
assert.equal(reparto.prioridad, 5)
// Sin dato de deriva (pocas carreras continuas) no afirma nada sobre ella y mantiene la prioridad.
const sinDeriva = evaluarReglas(atleta({ ...carlos, deriva: { media: null, n: 0 } })).propuestas.find(p => p.regla === 'reparto_suave')!
assert.ok(!sinDeriva.razon.includes('deriva'))
assert.equal(sinDeriva.prioridad, 3) // 36 % suave (<40 %): prioridad alta sin el contrapeso de la deriva baja
// Con deriva alta y repetida sí lo une.
assert.ok(evaluarReglas(atleta({ ...carlos, deriva: { media: 12, n: 5 } })).propuestas.find(p => p.regla === 'reparto_suave')!.razon.includes('rodajes demasiado fuertes'))

// 3. Sobrecarga: manda y silencia las propuestas de reparto y progresión.
const sobre = atleta({ carga: carga({ tsb: -35, rampa7: 9 }), alertas: ['fatiga_alta', 'rampa_alta'], intensidad: inten(30, 50, 20) })
assert.deepEqual(ids(sobre), ['sobrecarga'])
assert.equal(evaluarReglas(sobre).propuestas[0].prioridad, 1)

// 4. Tapering: ventana y profundidad según la prueba.
assert.ok(!ids(atleta({ competicion: comp(5, 'running_5k'), diasCompeticion: 5 })).includes('progresion'), 'no se sube volumen con una carrera cerca')
const taper = (dias: number, disc: string, t: number | null = null) => evaluarReglas(atleta({ competicion: comp(dias, disc, t), diasCompeticion: dias })).propuestas.find(p => p.regla === 'tapering')
assert.ok(taper(6, 'running_5k'), 'un 5K a 6 días está en su ventana (7)')
assert.equal(taper(9, 'running_5k'), undefined, 'un 5K a 9 días aún no hace tapering')
assert.ok(taper(9, 'running_hm'), 'una media a 9 días está en su ventana (10)')
assert.equal(taper(12, 'running_hm'), undefined)
assert.ok(taper(13, 'running_maraton'), 'un maratón a 13 días está en su ventana (14)')
assert.equal(taper(15, 'running_maraton'), undefined)
assert.ok(taper(6, 'running_5k')!.cambio.includes('30-40 %'), 'última semana de un 5K: 30-40 %')
assert.ok(taper(13, 'running_maraton')!.cambio.includes('40-55 %'))
assert.ok(taper(5, 'running_maraton')!.cambio.includes('50-60 %'))
assert.ok(taper(6, 'running_5k')!.avisos!.some(a => a.includes('orientativas')), 'en pruebas cortas se avisa de que las cifras son orientativas')
// Un tiempo objetivo largo cambia el perfil: una «10K» con objetivo de 100 min se trata como prueba larga.
assert.ok(taper(8, 'running_10k', 100) === undefined, 'la ventana la fija la disciplina (7 días)')
assert.ok(taper(6, 'running_10k', 100)!.cambio.includes('50-60 %'))
assert.equal(taper(-1, 'running_5k'), undefined)

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
const entrada = atleta({ competicion: comp(9, 'running_hm'), diasCompeticion: 9, alertas: ['rhr_alto'], intensidad: inten(40, 40, 20) })
const copia = JSON.stringify(entrada)
const a = evaluarReglas(entrada)
assert.deepEqual(a, evaluarReglas(entrada))
assert.equal(JSON.stringify(entrada), copia)
assert.deepEqual(a.propuestas.map(p => p.prioridad), [...a.propuestas.map(p => p.prioridad)].sort((x, y) => x - y))

// 10b. Requisitos del atleta: lesiones, días, nivel, recuperación, parón.
const sinCarga = (o: Partial<EstadoAtleta>) => atleta({ fuerzaEnPlan: 0, fuerza28d: 0, deriva: { media: 5, n: 5 }, ...o })
const conLesion = { nivel: 'intermedio', diasDisponibles: 6, lesiones: ['fascitis plantar'], restricciones: null, recuperacion: 'media' }
const fuerzaL = evaluarReglas(sinCarga({ perfil: conLesion })).propuestas.find(p => p.regla === 'fuerza')!
assert.equal(fuerzaL.riesgo, 'alto', 'con lesión declarada, añadir fuerza es riesgo alto')
assert.ok(fuerzaL.cambio.includes('fascitis plantar') && fuerzaL.avisos!.length > 0)
assert.equal(esSegura({ riesgo: fuerzaL.riesgo, fiabilidad: calcularFiabilidad({ datos: 1, persistencia: 1, nivelesEvidencia: ['meta_analisis'], origen: 'regla' }), origen: 'regla' }), false)
assert.ok(evaluarReglas(sinCarga({ perfil: conLesion })).notas.some(n => n.includes('fascitis plantar')))
assert.ok(!ids(atleta({ perfil: conLesion })).includes('progresion'), 'con lesiones no se propone subir volumen')
assert.ok(!ids(atleta({ perfil: { ...conLesion, lesiones: [], restricciones: 'molestia en la rodilla izquierda' } })).includes('progresion'), 'ni con restricciones temporales')
// Días disponibles: no se propone fuerza si no caben.
const sinDias = evaluarReglas(sinCarga({ carrerasPorSemana: 4, perfil: { ...conLesion, lesiones: [], diasDisponibles: 4 } }))
assert.ok(!sinDias.propuestas.some(p => p.regla === 'fuerza'))
assert.ok(sinDias.notas.some(n => n.includes('4 días disponibles')))
assert.ok(ids(sinCarga({ carrerasPorSemana: 4, perfil: { ...conLesion, lesiones: [], diasDisponibles: 6 } })).includes('fuerza'))
assert.ok(ids(sinCarga({ perfil: { ...conLesion, lesiones: [], diasDisponibles: null } })).includes('fuerza'), 'sin dato de días se propone')
// Recuperación baja y principiantes: sin progresión; el principiante recibe la pauta de caminar-correr.
const base0 = { nivel: 'intermedio', diasDisponibles: 6, lesiones: [], restricciones: null, recuperacion: 'media' }
assert.ok(!ids(atleta({ perfil: { ...base0, recuperacion: 'baja' } })).includes('progresion'))
assert.ok(!ids(atleta({ perfil: { ...base0, nivel: 'principiante' } })).includes('progresion'))
assert.ok(evaluarReglas(atleta({ ...carlos, perfil: { ...base0, nivel: 'principiante' } })).propuestas.find(p => p.regla === 'reparto_suave')!.cambio.includes('alternar caminar y correr'))
assert.ok(!evaluarReglas(carlos).propuestas.find(p => p.regla === 'reparto_suave')!.cambio.includes('caminar'))
assert.ok(evaluarReglas(sinCarga({ perfil: { ...base0, recuperacion: 'baja' } })).propuestas.find(p => p.regla === 'fuerza')!.razon.includes('empezar con 1 sesión'))
// Parón: solo la vuelta gradual; nada de subir carga, reparto ni fuerza.
const parón = evaluarReglas(sinCarga({ retorno: true, intensidad: inten(30, 50, 20) }))
assert.deepEqual(parón.propuestas.map(p => p.regla), ['retorno'])
assert.ok(parón.notas.some(n => n.includes('parón')))
assert.ok(parón.propuestas[0].avisos![0].includes('Daniels'))
// Señales de fatiga bloquean la progresión.
for (const alerta of ['salto_semanal', 'rhr_alto', 'monotonia']) assert.ok(!ids(atleta({ alertas: [alerta], carga: carga({ monotonia: 2.4 }) })).includes('progresion'), `${alerta} bloquea la progresión`)

// 10c. Pautas de los entrenadores de referencia (Daniels, Pfitzinger, Fitzgerald).
// Retorno: fórmula de Daniels para parones de hasta 4 semanas; más largos, reconstrucción.
const ret = (semanas: number) => evaluarReglas(atleta({ retorno: true, semanasParon: semanas })).propuestas.find(p => p.regla === 'retorno')!
assert.ok(ret(2).cambio.includes('7 días al 50 %') && ret(2).cambio.includes('otros 7 al 75 %'), ret(2).cambio) // 14 días → 7 + 7
assert.ok(ret(1).cambio.includes('3.5') === false && ret(3).cambio.includes('~21 días'))
assert.ok(ret(2).avisos![0].includes('segunda mano'))
assert.ok(ret(6).cambio.includes('Parón largo') && ret(6).cambio.includes('4-6 semanas'))
assert.ok(ret(6).avisos![0].includes('criterio de entrenador'))
// Tirada larga: tope de 2 h 30 y peso relativo según las salidas por semana.
assert.ok(!ids(atleta({ tiradaLarga: { minutos: 70, pctSemana: 28 } })).some(r => r.startsWith('tirada')))
assert.ok(ids(atleta({ tiradaLarga: { minutos: 165, pctSemana: 40 } })).includes('tirada_excesiva'))
const pesada = evaluarReglas(atleta({ carrerasPorSemana: 3, tiradaLarga: { minutos: 70, pctSemana: 82 } })).propuestas.find(p => p.regla === 'tirada_pesada')!
assert.ok(pesada && pesada.riesgo === 'medio' && pesada.cambio.includes('82 %') && pesada.cambio.includes('menos del 50 %'))
assert.ok(ids(atleta({ carrerasPorSemana: 5, tiradaLarga: { minutos: 90, pctSemana: 40 } })).includes('tirada_pesada'), '40 % con 5 salidas supera el 30 %')
assert.ok(!ids(atleta({ carrerasPorSemana: 3, tiradaLarga: { minutos: 70, pctSemana: 48 } })).includes('tirada_pesada'), '48 % con 3 salidas se tolera')
assert.ok(!ids(atleta({ carrerasPorSemana: 2, tiradaLarga: { minutos: 70, pctSemana: 90 } })).some(r => r.startsWith('tirada')), 'con 2 salidas no se evalúa')
// Sin día libre se ofrece la alternativa de rodaje tras fuerza.
const sinDia2 = evaluarReglas(atleta({ carrerasPorSemana: 3, fuerzaEnPlan: 3, perfil: { nivel: 'intermedio', diasDisponibles: 6, lesiones: [], restricciones: null, recuperacion: 'media' }, tiradaLarga: { minutos: 70, pctSemana: 82 } })).propuestas.find(p => p.regla === 'tirada_pesada')!
assert.ok(sinDia2.cambio.includes('sin día libre'))
// Descarga programada: tras 4+ semanas sin descargar, salvo que ya esté en descarga, vuelva de parón, haya sobrecarga o carrera cerca.
assert.ok(ids(atleta({ semanasSinDescarga: 4 })).includes('descarga_programada'))
assert.ok(!ids(atleta({ semanasSinDescarga: 3 })).includes('descarga_programada'))
assert.ok(!ids(atleta({ semanasSinDescarga: null })).includes('descarga_programada'))
assert.ok(!ids(atleta({ semanasSinDescarga: 5, enDescarga: true })).includes('descarga_programada'), 'su plan ya está en descarga')
assert.ok(!ids(atleta({ semanasSinDescarga: 5, retorno: true, semanasParon: 2 })).includes('descarga_programada'))
assert.ok(!ids(atleta({ semanasSinDescarga: 5, competicion: comp(10, 'running_hm'), diasCompeticion: 10 })).includes('descarga_programada'), 'a 10 días de una media ya hace tapering')
assert.ok(ids(atleta({ semanasSinDescarga: 5, competicion: comp(40, 'running_hm'), diasCompeticion: 40 })).includes('descarga_programada'))
// Contraste con Daniels cuando se conoce el pulso máximo.
const conDaniels = evaluarReglas(atleta({ ...carlos, suaveDaniels: { techo: 152, pct: 18 } })).propuestas.find(p => p.regla === 'reparto_suave')!
assert.ok(conDaniels.avisos!.some(a => a.includes('Daniels') && a.includes('152 ppm') && a.includes('18 %')))
assert.ok(conDaniels.razon.includes('Casado 2022') && conDaniels.dois.includes(DOI.CASADO_2022))
assert.ok(!evaluarReglas(carlos).propuestas.find(p => p.regla === 'reparto_suave')!.avisos!.some(a => a.includes('Daniels')), 'sin pulso máximo no hay contraste')

// 11. Integridad de todas las propuestas posibles: DOI conocidos, métrica válida y dirección solo donde aplica.
const todas = [atleta({ tiradaLarga: { minutos: 165, pctSemana: 40 } }), atleta({ carrerasPorSemana: 3, tiradaLarga: { minutos: 70, pctSemana: 82 } }), atleta({ semanasSinDescarga: 5 }), atleta({ retorno: true, semanasParon: 3 }), sobre, carlos, atleta({ retorno: true }), atleta({ competicion: comp(6, 'running_5k'), diasCompeticion: 6 }), atleta({ fuerzaEnPlan: 0, fuerza28d: 0, perfil: conLesion }), atleta({ competicion: comp(5, 'running_maraton'), diasCompeticion: 5, alertas: ['rhr_alto', 'monotonia'], carga: carga({ monotonia: 2.5 }), fuerzaEnPlan: 0, fuerza28d: 0, deriva: { media: 12, n: 5 }, ejecucion: { repsEvaluadas: 10, repsLentas: 9, sesionesEvaluadas: 3, sesionesSaltadas: 0 } }), atleta(), atleta({ fuerzaEnPlan: 2, fuerza28d: 1 })]
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
for (const regla of ['tirada_excesiva', 'tirada_pesada', 'descarga_programada', 'retorno', 'sobrecarga', 'tapering', 'reparto_suave', 'deriva_alta', 'ejecucion_lenta', 'fuerza', 'fuerza_sin_registro', 'monotonia', 'pulso_reposo', 'progresion']) assert.ok(vistas.has(regla), `la regla ${regla} no se ha ejercitado`)

// 12. Fiabilidad: más datos y mejor evidencia suben; la IA queda por debajo y nunca pasa de 0,8.
const fuerte = calcularFiabilidad({ datos: 1, persistencia: 1, nivelesEvidencia: ['meta_analisis', 'rct'], origen: 'regla' })
const debil = calcularFiabilidad({ datos: 0.3, persistencia: 0.5, nivelesEvidencia: [], origen: 'regla' })
const ia = calcularFiabilidad({ datos: 1, persistencia: 1, nivelesEvidencia: ['meta_analisis'], origen: 'ia' })
assert.ok(fuerte.valor > debil.valor && fuerte.nivel === 'alta' && debil.nivel === 'baja')
assert.ok(ia.valor < fuerte.valor && ia.valor <= 0.8)
assert.ok(debil.motivos.includes('sin estudios que lo respalden (criterio de entrenador)'))
assert.ok(ia.motivos.some(m => m.includes('IA')))

// 12b. La evidencia pondera los dos mejores estudios: uno fuerte no tapa a otros débiles.
const unoFuerte = calcularFiabilidad({ datos: 1, persistencia: 1, nivelesEvidencia: ['meta_analisis'], origen: 'regla' })
const fuerteYDebil = calcularFiabilidad({ datos: 1, persistencia: 1, nivelesEvidencia: ['meta_analisis', 'opinion_experto', 'opinion_experto'], origen: 'regla' })
assert.ok(fuerteYDebil.valor < unoFuerte.valor)
assert.equal(fuerteYDebil.valor, Math.round((0.35 + 0.35 * ((1 + 0.35) / 2) + 0.3) * 100) / 100)

// 13. «Segura» solo si es de una regla, de riesgo bajo y con fiabilidad suficiente.
assert.equal(esSegura({ riesgo: 'bajo', fiabilidad: fuerte, origen: 'regla' }), true)
assert.equal(esSegura({ riesgo: 'medio', fiabilidad: fuerte, origen: 'regla' }), false)
assert.equal(esSegura({ riesgo: 'bajo', fiabilidad: debil, origen: 'regla' }), false)
assert.equal(esSegura({ riesgo: 'bajo', fiabilidad: fuerte, origen: 'ia' }), false)
console.log('reglas.test OK')
