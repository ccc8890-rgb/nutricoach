import assert from 'node:assert/strict'
import { banderasSalud, normalizarNivel, planificarMacrociclo, type EntradaMacro } from '../lib/entrenos/macrociclo'

const HOY = '2026-10-10'
const sumar = (f: string, n: number) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const base = (o: Partial<EntradaMacro> = {}): EntradaMacro => ({
  hoy: HOY, nivel: 'intermedio', edad: 35, sexo: 'hombre', diasDisponibles: 5, diasCorrer: null, vdot: 45, minutosSemanaActuales: 150, competicion: null,
  lesiones: [], restricciones: null, recuperacion: 'media', condicionesSalud: null, semanasParon: 0, sesionesFuerzaFijas: 0, ...o,
})
// HOY es sábado: la prueba cae en domingo, `semanas` semanas después.
const carrera = (semanas: number, disciplina: string, t: number | null = null) => ({ fecha: sumar(HOY, semanas * 7 + 1), disciplina, tiempoObjetivoMin: t, objetivo: null })

assert.equal(normalizarNivel('Avanzado'), 'avanzado')
assert.equal(normalizarNivel('principiante'), 'principiante')
assert.equal(normalizarNivel(null), null)
assert.deepEqual(banderasSalud('anemia ferropénica leve (ferritina 11)'), { anemia: true, hipertension: false, tensionElevada: false, diabetes: false, cardiaco: false })
// Tensión por cifras: 130-139/85-89 es «normal-alta» (no limita); desde 140/90 es hipertensión.
assert.equal(banderasSalud('TA 130/85 (normal-alta)').hipertension, false)
assert.equal(banderasSalud('TA 130/85 (normal-alta)').tensionElevada, true)
assert.equal(banderasSalud('TA 150/95').hipertension, true)
assert.equal(banderasSalud('tensión arterial 142/88').hipertension, true)
assert.equal(banderasSalud('hipertensión grado 1').hipertension, true)
// Las negaciones no activan nada: «Sin diabetes», «no hipertensión», «descartada la anemia».
assert.equal(banderasSalud('dislipidemia. TA 130/85 (normal-alta). Sin diabetes.').diabetes, false)
assert.equal(banderasSalud('no tiene hipertensión ni diabetes').hipertension, false)
assert.equal(banderasSalud('no tiene hipertensión ni diabetes').diabetes, false)
assert.equal(banderasSalud('anemia descartada').anemia, true, 'la negación va antes de la palabra: aquí se afirma por prudencia')
assert.equal(banderasSalud('descartada anemia').anemia, false)
assert.equal(banderasSalud('diabetes tipo 2, sin medicación').diabetes, true)
assert.equal(banderasSalud('Sin otras patologías. Anemia ferropénica leve').anemia, true)
assert.equal(banderasSalud('Ninguna').anemia, false)

// ── Maratón en 16 semanas, intermedio, 5 días, VDOT 45 ──
const m = planificarMacrociclo(base({ competicion: carrera(16, 'running_maraton', 240), diasCorrer: 5 }))
assert.equal(m.semanasHastaCarrera, 16)
assert.equal(m.semanas.length, 16, '15 de preparación + la semana de la carrera')
assert.equal(m.semanas.filter(s => s.fase === 'tapering').length, 1, 'el maratón reduce 2 semanas: 1 previa + la de la carrera')
assert.deepEqual([...new Set(m.semanas.map(s => s.fase))], ['base', 'construccion', 'especifica', 'tapering', 'carrera'])
assert.equal(m.semanas.at(-1)!.fase, 'carrera')
// La semana de la carrera: nada el día antes (sábado) ni el día de la prueba (domingo).
assert.ok(m.semanas.at(-1)!.sesiones.every(x => x.dia <= 4), `sesiones en la semana de la carrera: ${JSON.stringify(m.semanas.at(-1)!.sesiones)}`)
assert.ok(m.semanas.at(-1)!.sesiones.every(x => x.tipo === 'rodaje' || x.tipo === 'tirada'))
assert.equal(m.semanas[0].lunes, '2026-10-12', 'hoy es sábado: el plan empieza el lunes siguiente')
assert.ok(m.semanas.every((s, i) => i === 0 || s.lunes > m.semanas[i - 1].lunes))
assert.ok(m.semanas.some(s => s.descarga), 'hay semanas de descarga')
assert.ok(m.ritmos && m.ritmos.E > m.ritmos.T)
const pico = Math.max(...m.semanas.map(s => s.minutos))
assert.ok(pico <= 390 + 5 && pico >= 250, `pico ${pico}`)
assert.ok(m.semanas.at(-1)!.minutos < pico * 0.6, 'la última semana ya es mucho menor')
assert.equal(m.datosFaltantes.length, 0, 'con todos los datos no falta nada')

// Una prueba en martes casi no tiene días en su semana: la última semana previa hace de semana de la carrera (2 de reducción).
const martes = planificarMacrociclo(base({ competicion: { fecha: sumar(HOY, 16 * 7 + 3), disciplina: 'running_maraton', tiempoObjetivoMin: 240, objetivo: null }, diasCorrer: 5 }))
assert.equal(martes.semanas.filter(s => s.fase === 'tapering').length, 2)
assert.ok(martes.semanas.every(s => s.fase !== 'carrera'))

// Disciplina no reconocida: se avisa en vez de tratar un posible maratón como una prueba corta en silencio.
const rara = planificarMacrociclo(base({ competicion: carrera(12, 'Maratón Valencia', 240) }))
assert.ok(rara.avisos.some(a => a.includes('no reconocido')))
assert.ok(rara.datosFaltantes.some(d => d.startsWith('Tipo de prueba')))
assert.ok(!planificarMacrociclo(base({ competicion: carrera(12, 'running_maraton', 240) })).avisos.some(a => a.includes('no reconocido')))

// ── Carrera corta cercana: 1 semana de reducción y poca construcción ──
const c10 = planificarMacrociclo(base({ competicion: carrera(6, 'running_10k', 50) }))
assert.equal(c10.semanas.filter(s => s.fase === 'tapering').length, 0, 'en un 10K la reducción es solo la semana de la carrera')
assert.equal(c10.semanas.at(-1)!.fase, 'carrera')
assert.ok(c10.semanas.at(-1)!.minutos < Math.max(...c10.semanas.map(s => s.minutos)) * 0.5)

// ── Sin competición: bloque de 8 semanas con base y construcción ──
const libre = planificarMacrociclo(base())
assert.equal(libre.semanasHastaCarrera, null)
assert.equal(libre.semanas.length, 8)
assert.ok(libre.semanas.every(s => s.fase === 'base' || s.fase === 'construccion'))

// ── Datos que faltan: se declaran y se usan supuestos conservadores, nunca se inventan en silencio ──
const vacio = planificarMacrociclo(base({ nivel: null, diasDisponibles: null, vdot: null, minutosSemanaActuales: null }))
assert.ok(vacio.datosFaltantes.length >= 4)
assert.ok(vacio.supuestos.some(x => x.includes('Nivel')) && vacio.supuestos.some(x => x.includes('Sin volumen real')))
assert.equal(vacio.ritmos, null)
assert.equal(vacio.parametros.nivel, 'intermedio')
assert.equal(vacio.parametros.volumenBase, 120)
// Sin datos reales: las 2 primeras semanas no suben y se dice; un principiante parte de poco.
assert.equal(vacio.semanas[0].minutos, vacio.semanas[1].minutos)
assert.ok(vacio.semanas[0].notas.some(n => n.includes('calibración')))
assert.ok(vacio.fundamentos.some(f => f.regla.includes('Sin datos del reloj')))
const nuevo = planificarMacrociclo(base({ nivel: 'principiante', minutosSemanaActuales: null }))
assert.equal(nuevo.parametros.volumenBase, 45)
assert.ok(nuevo.semanas.every(s => s.minutos <= 45 * 1.07 ** (s.n - 1) + 15), 'un principiante sin datos no se dispara')
// Cada plan trae sus fundamentos con el tipo de fuente (estudio / libro / criterio).
const fund = planificarMacrociclo(base({ condicionesSalud: 'anemia', competicion: carrera(12, 'running_hm', 110) })).fundamentos
assert.ok(fund.every(f => ['estudio', 'libro', 'criterio'].includes(f.tipo) && f.regla && f.fuente))
assert.ok(fund.some(f => f.regla.includes('Anemia') && f.tipo === 'criterio'), 'lo que es criterio de prudencia se dice como tal')
assert.ok(fund.some(f => f.fuente.includes('Mujika')))

// ── Salud, lesiones y edad recortan, nunca amplían ──
const sano = planificarMacrociclo(base({ competicion: carrera(14, 'running_hm', 110), diasCorrer: 4 }))
const anemia = planificarMacrociclo(base({ competicion: carrera(14, 'running_hm', 110), diasCorrer: 4, condicionesSalud: 'anemia ferropénica leve (ferritina 11 ng/mL)' }))
assert.ok(anemia.avisos.some(a => a.includes('Anemia')))
assert.ok(anemia.semanas.every(s => s.sesiones.every(x => x.tipo !== 'series')), 'con anemia no hay series')
assert.ok(anemia.parametros.crecimientoSemanal <= sano.parametros.crecimientoSemanal)
assert.ok(Math.max(...anemia.semanas.map(s => s.minutos)) <= Math.max(...sano.semanas.map(s => s.minutos)))
assert.ok(anemia.semanas.every((s, i) => s.pctSuave >= sano.semanas[i].pctSuave), 'con anemia el reparto suave nunca baja')

const lesion = planificarMacrociclo(base({ lesiones: ['fascitis plantar'], competicion: carrera(12, 'running_10k', 55) }))
assert.equal(lesion.parametros.crecimientoSemanal, 0.05)
assert.ok(lesion.semanas.every(s => s.sesiones.filter(x => x.tipo === 'series').length === 0))
assert.ok(lesion.semanas.every(s => s.fuerza <= 1))
assert.ok(lesion.avisos.some(a => a.includes('fascitis plantar')))

const hta = planificarMacrociclo(base({ condicionesSalud: 'TA 150/95', competicion: carrera(12, 'running_10k', 55) }))
assert.ok(hta.avisos.some(a => a.includes('Tensión arterial')))
assert.ok(hta.semanas.every(s => s.sesiones.every(x => x.tipo !== 'series' && x.tipo !== 'ritmo_carrera' || s.fase === 'base')))

// Normal-alta: solo un aviso informativo, el plan no se recorta.
const normalAlta = planificarMacrociclo(base({ condicionesSalud: 'TA 135/88 (normal-alta)', competicion: carrera(12, 'running_10k', 55) }))
assert.ok(normalAlta.avisos.some(a => a.includes('límite alto')))
assert.ok(!normalAlta.avisos.some(a => a.includes('hasta que su médico lo valide')))
assert.ok(normalAlta.semanas.some(s => s.sesiones.some(x => x.tipo === 'series')), 'la tensión normal-alta no quita las series')

// Anemia: el volumen casi no sube y se dice.
const anemiaFrenada = planificarMacrociclo(base({ condicionesSalud: 'anemia ferropénica leve (ferritina 11 ng/mL)', competicion: carrera(10, 'running_maraton', 240) }))
assert.ok(anemiaFrenada.parametros.crecimientoSemanal <= 0.03)
assert.ok(anemiaFrenada.avisos.some(a => a.includes('3 % por semana')))
assert.ok(anemiaFrenada.avisos.some(a => a.includes('solo puede llegar')), 'con la carga frenada no se promete el volumen de un maratón')
assert.ok(anemiaFrenada.semanas.every(s => s.sesiones.filter(x => ['tempo', 'series', 'ritmo_carrera'].includes(x.tipo)).length <= 1), 'con anemia, una sola sesión de calidad por semana')
// Con pocas salidas la calidad no se convierte en una sesión interminable (Daniels: tempo ≤ 10 % del volumen semanal).
const pocas = planificarMacrociclo(base({ diasCorrer: 3, diasDisponibles: 4, minutosSemanaActuales: 150 }))
assert.ok(pocas.semanas.every(s => s.sesiones.every(x => !['tempo', 'series', 'ritmo_carrera'].includes(x.tipo) || x.minutos <= 90)))

const vet = planificarMacrociclo(base({ edad: 56 }))
assert.equal(vet.parametros.descargaCada, 3)
assert.ok(vet.parametros.crecimientoSemanal <= 0.07)
const principiante = planificarMacrociclo(base({ nivel: 'principiante', minutosSemanaActuales: 60, diasCorrer: 6 }))
assert.ok(principiante.parametros.salidasSemana <= 4, 'un principiante no pasa de 4 salidas')
assert.equal(principiante.parametros.descargaCada, 3)

// ── Parón: fórmula de Daniels y reincorporación gradual ──
const par = planificarMacrociclo(base({ semanasParon: 2, minutosSemanaActuales: 200 }))
assert.equal(par.semanas[0].fase, 'retorno')
assert.ok(par.semanas[0].minutos <= 200 * 0.5 + 5)
assert.ok(par.semanas.slice(0, 2).every(s => s.sesiones.every(x => x.tipo === 'rodaje' || x.tipo === 'tirada')), 'sin calidad al volver')
assert.ok(par.avisos.some(a => a.includes('sin correr')))
const parLargo = planificarMacrociclo(base({ semanasParon: 6, minutosSemanaActuales: 200 }))
assert.ok(parLargo.semanas.filter(s => s.fase === 'retorno').length === 5)
assert.ok(parLargo.semanas[0].minutos <= 105)

// ── Tiempo insuficiente: se avisa en vez de prometer ──
const justo = planificarMacrociclo(base({ nivel: 'principiante', minutosSemanaActuales: 60, competicion: carrera(10, 'running_maraton', 300) }))
assert.ok(justo.avisos.some(a => a.includes('solo puede llegar')))
assert.ok(justo.avisos.some(a => a.includes('menos de 16 semanas')))

// ── Competición muy cercana o ya pasada ──
const hoy0 = planificarMacrociclo(base({ competicion: { fecha: sumar(HOY, 3), disciplina: 'running_10k', tiempoObjetivoMin: 50, objetivo: null } }))
assert.equal(hoy0.semanas.length, 1)
assert.equal(hoy0.semanas[0].fase, 'carrera')
const pasada = planificarMacrociclo(base({ competicion: { fecha: sumar(HOY, -5), disciplina: 'running_10k', tiempoObjetivoMin: 50, objetivo: null } }))
assert.ok(pasada.avisos.some(a => a.includes('ya pasó')))
assert.equal(pasada.semanasHastaCarrera, null)
const larga = planificarMacrociclo(base({ competicion: carrera(40, 'running_maraton', 240) }))
assert.equal(larga.semanas.length, 20)
assert.ok(larga.semanas.every(s => s.fase !== 'tapering'), 'a 40 semanas todavía no hay tapering')
assert.ok(larga.avisos.some(a => a.includes('primer bloque')))

// ── Ultra: la tirada puede ser más larga que en un maratón ──
const ultra = planificarMacrociclo(base({ nivel: 'avanzado', minutosSemanaActuales: 400, competicion: carrera(14, 'trail_largo', 600), diasCorrer: 5 }))
const maxTiradaUltra = Math.max(...ultra.semanas.map(s => s.tiradaMin))
const maxTiradaMaraton = Math.max(...planificarMacrociclo(base({ nivel: 'avanzado', minutosSemanaActuales: 400, competicion: carrera(14, 'running_maraton', 240), diasCorrer: 5 })).semanas.map(s => s.tiradaMin))
assert.ok(maxTiradaUltra >= maxTiradaMaraton)

// ── Fuerza fija (híbrido): se respetan sus sesiones y no se añaden más ──
const hib = planificarMacrociclo(base({ diasCorrer: 3, sesionesFuerzaFijas: 3, diasDisponibles: 5 }))
assert.ok(hib.semanas.every(s => s.fuerza === 3))
assert.equal(hib.parametros.salidasSemana, 3)

// ───────── Propiedades sobre cientos de perfiles aleatorios ─────────
let seed = 12345
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const elige = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const DISC = ['running_5k', 'running_10k', 'running_hm', 'running_maraton', 'trail_corto', 'trail_largo', 'ultra', 'hyrox']
let conGrowthChecks = 0
for (let k = 0; k < 400; k++) {
  const e = base({
    nivel: elige(['principiante', 'intermedio', 'avanzado', null]), edad: elige([null, 22, 35, 48, 55, 63]),
    diasDisponibles: elige([null, 2, 3, 4, 5, 6, 7]), diasCorrer: elige([null, 2, 3, 4, 5, 6]), vdot: elige([null, 35, 45, 55]),
    minutosSemanaActuales: elige([null, 30, 60, 120, 200, 320, 500]), recuperacion: elige([null, 'baja', 'media', 'alta']),
    lesiones: elige([[], [], [], ['rodilla']]), condicionesSalud: elige([null, null, 'anemia', 'hipertensión', 'diabetes', 'cardiaca']),
    semanasParon: elige([0, 0, 0, 2, 5]), sesionesFuerzaFijas: elige([0, 0, 2, 3]),
    competicion: elige([null, null, carrera(Math.floor(rnd() * 30), elige(DISC), elige([null, 50, 110, 240, 600]))]),
  })
  const r = planificarMacrociclo(e)
  const id = JSON.stringify(e)
  assert.ok(r.semanas.length >= 1 && r.semanas.length <= 21, `semanas ${r.semanas.length} ${id}`)
  const tope = r.parametros.volumenPico * 1.0001 + 5
  r.semanas.forEach((s, i) => {
    assert.ok(Number.isFinite(s.minutos) && s.minutos > 0, `minutos ${id}`)
    assert.ok(s.salidas >= 2 && s.salidas <= 6, `salidas ${s.salidas} ${id}`)
    assert.ok(s.sesiones.length === s.salidas, `sesiones/salidas ${id}`)
    assert.ok(Math.abs(s.sesiones.reduce((a, x) => a + x.minutos, 0) - s.minutos) <= 1, `suma ${id}`)
    assert.ok(s.tiradaMin <= 210 && s.tiradaMin >= 20, `tirada ${s.tiradaMin} ${id}`)
    if (s.fase !== 'tapering' && s.fase !== 'carrera') assert.ok(s.minutos <= tope + 40, `supera el pico ${s.minutos} > ${tope} ${id}`)
    // días: sin repetir, dentro de la semana, y la calidad nunca en días consecutivos ni el día antes de la tirada
    const dias = s.sesiones.map(x => x.dia)
    assert.equal(new Set(dias).size, dias.length, `días repetidos ${id}`)
    assert.ok(dias.every(d => d >= 0 && d <= 6))
    const hard = s.sesiones.filter(x => ['tempo', 'series', 'ritmo_carrera'].includes(x.tipo)).map(x => x.dia)
    for (const d of hard) { assert.ok(!hard.includes(d + 1), `calidad seguida ${id}`); const t = s.sesiones.find(x => x.tipo === 'tirada')!; assert.notEqual(d + 1, t.dia, `calidad antes de tirada ${id}`) }
    assert.ok(hard.length <= 2, `más de 2 de calidad ${id}`)
    assert.ok(s.pctSuave >= 75 && s.pctSuave <= 100)
    if (s.fase === 'retorno') assert.equal(hard.length, 0, `calidad al volver ${id}`)
    // el crecimiento entre semanas de carga consecutivas respeta el tope (con margen por redondeo)
    const ant = r.semanas[i - 1]
    if (ant && !s.descarga && !ant.descarga && ant.fase !== 'tapering' && s.fase !== 'tapering' && s.fase !== 'carrera' && ant.fase !== 'retorno' && s.fase !== 'retorno') {
      conGrowthChecks++
      assert.ok(s.minutos <= ant.minutos * (1 + Math.max(r.parametros.crecimientoSemanal, 0.15)) + 6, `salto ${ant.minutos}→${s.minutos} ${id}`)
    }
    if (s.descarga) assert.ok(s.minutos <= (ant?.minutos ?? s.minutos) + 6, `la descarga sube ${id}`)
  })
  // Sin datos el motor lo dice.
  if (e.vdot === null) assert.ok(r.datosFaltantes.some(d => d.includes('VDOT')), `falta VDOT sin declarar ${id}`)
  if (e.minutosSemanaActuales === null || (e.minutosSemanaActuales ?? 0) < 45) assert.ok(r.supuestos.length > 0, `volumen supuesto sin declarar ${id}`)
  // La salud nunca añade calidad intensa
  const s0 = planificarMacrociclo({ ...e, condicionesSalud: null, lesiones: [] })
  const hard = (x: typeof r) => x.semanas.reduce((a, s) => a + s.sesiones.filter(y => y.tipo === 'series' || y.tipo === 'ritmo_carrera').length, 0)
  assert.ok(hard(r) <= hard(s0), `la salud añadió intensidad ${id}`)
}
assert.ok(conGrowthChecks > 500, `pocas comprobaciones de crecimiento: ${conGrowthChecks}`)
console.log('macrociclo.test OK')
