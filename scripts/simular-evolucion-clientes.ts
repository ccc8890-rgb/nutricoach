// Simula, sin tocar la base de datos, la preparación de atletas sintéticos semana a semana:
// cada semana el motor recalcula el plan con lo que el atleta REALMENTE corrió (media de las 4 últimas semanas completas),
// y se compara lo planificado con lo ejecutado. Sirve para ver cómo reacciona el motor a la adherencia irregular, enfermedades y parones.
// Uso: npx tsx scripts/simular-evolucion-clientes.ts  → escribe docs/<fecha>_simulacion-evolucion-clientes.md
import { writeFileSync } from 'node:fs'
import { planificarMacrociclo, type EntradaMacro } from '../lib/entrenos/macrociclo'
import { analizarVolumen } from '../lib/entrenos/macro-desde-cliente'

const sumar = (f: string, n: number) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
let semilla = 42
const rnd = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296 }

interface Atleta {
  nombre: string
  nota: string
  entrada: Omit<EntradaMacro, 'hoy' | 'minutosSemanaActuales' | 'semanasParon'>
  inicial: number | null
  /** Adherencia habitual (fracción de lo planificado que ejecuta). */
  adherencia: number
  /** Semanas (índice desde 0) en las que no corre nada (enfermedad, viaje). */
  parones: number[]
  /** Semana en la que el atleta ya no sube de este volumen (límite real de tiempo). */
  techoMin?: number
}

const HOY0 = '2026-10-10' // sábado
const carrera = (semanas: number, disciplina: string, t: number | null) => ({ fecha: sumar(HOY0, semanas * 7 + 1), disciplina, tiempoObjetivoMin: t, objetivo: null })
const base = { sexo: 'hombre', sesionesFuerzaFijas: 0, diasCorrer: null as number | null, lesiones: [] as string[], restricciones: null, recuperacion: 'media', condicionesSalud: null }

const ATLETAS: Atleta[] = [
  { nombre: 'A · Principiante 10K', nota: 'Corre poco, sin VDOT, 10K en 12 semanas, adherencia normal.', inicial: 60, adherencia: 0.9, parones: [4],
    entrada: { ...base, nivel: 'principiante', edad: 33, diasDisponibles: 4, vdot: null, competicion: carrera(12, 'running_10k', 65) } },
  { nombre: 'B · Media maratón intermedio', nota: 'VDOT 42, 150 min/sem, media maratón en 14 semanas, adherencia alta con un parón de 2 semanas.', inicial: 150, adherencia: 0.95, parones: [6, 7],
    entrada: { ...base, nivel: 'intermedio', edad: 38, diasDisponibles: 5, vdot: 42, competicion: carrera(14, 'running_hm', 110) } },
  { nombre: 'C · Maratón avanzado', nota: 'VDOT 52, 300 min/sem, maratón en 16 semanas, muy constante, techo de tiempo 400 min/sem.', inicial: 300, adherencia: 1, parones: [], techoMin: 400,
    entrada: { ...base, nivel: 'avanzado', edad: 31, diasDisponibles: 6, vdot: 52, competicion: carrera(16, 'running_maraton', 190) } },
  { nombre: 'D · Veterano con rodilla', nota: '55 años, rodilla delicada, 10K en 10 semanas, adherencia irregular.', inicial: 90, adherencia: 0.8, parones: [3, 8],
    entrada: { ...base, nivel: 'intermedio', edad: 55, diasDisponibles: 4, vdot: 38, lesiones: ['rodilla'], competicion: carrera(10, 'running_10k', 58) } },
  { nombre: 'E · Running + Hyrox', nota: 'Híbrido: 3 sesiones de fuerza fijas, 3 de carrera, Hyrox en 10 semanas, VDOT 45.', inicial: 89, adherencia: 0.9, parones: [5],
    entrada: { ...base, nivel: 'avanzado', edad: 36, diasDisponibles: 5, vdot: 45, diasCorrer: 3, sesionesFuerzaFijas: 3, competicion: carrera(10, 'hyrox', 75) } },
  { nombre: 'F · Vuelve de parón', nota: '10 semanas sin correr, quiere un 10K en 12 semanas.', inicial: null, adherencia: 0.9, parones: [],
    entrada: { ...base, nivel: 'intermedio', edad: 41, diasDisponibles: 5, vdot: 44, competicion: carrera(12, 'running_10k', 52) } },
]

interface Fila { sem: number; fase: string; planeado: number; ejecutado: number; media4: number; descarga: boolean }

function simular(a: Atleta) {
  const historia: number[] = a.inicial !== null ? [a.inicial, a.inicial, a.inicial, a.inicial] : []
  const filas: Fila[] = []
  const incidencias: string[] = []
  const semanasTotales = Math.ceil((new Date(a.entrada.competicion!.fecha).getTime() - new Date(HOY0).getTime()) / (7 * 86_400_000)) + 1
  for (let w = 0; w < semanasTotales; w++) {
    const hoy = sumar(HOY0, w * 7)
    // Mismo análisis que usará la app con los datos del reloj: [0] = semana completa más reciente.
    const semanasRev = [...historia].reverse()
    const ultimaCarrera = semanasRev.findIndex(x => x > 0)
    const an = analizarVolumen(semanasRev, a.inicial === null && historia.length === 0 ? 70 : ultimaCarrera === -1 ? null : ultimaCarrera * 7 + 3)
    const media4 = an.minutos
    const sinCorrer = an.semanasParon
    const entradaSem: EntradaMacro = { ...a.entrada, hoy, minutosSemanaActuales: media4, semanasParon: sinCorrer }
    let r: ReturnType<typeof planificarMacrociclo>
    try { r = planificarMacrociclo(entradaSem) } catch (err) { throw new Error(`${a.nombre} semana ${w + 1}: ${(err as Error).message}`) }
    const s = r.semanas[0]
    if (!s) break
    const parada = a.parones.includes(w)
    let ejecutado = parada ? 0 : Math.round(s.minutos * Math.min(1, a.adherencia * (0.85 + rnd() * 0.3)))
    if (a.techoMin) ejecutado = Math.min(ejecutado, a.techoMin)
    filas.push({ sem: w + 1, fase: s.fase + (s.fase === 'retorno' ? '' : ''), planeado: s.minutos, ejecutado, media4: media4 ?? 0, descarga: s.descarga })
    // Comprobaciones: el plan de la semana no debe saltar sobre lo que realmente corre.
    const ultimaReal = historia.length ? historia[historia.length - 1] : null
    if (ultimaReal && ultimaReal > 0 && s.fase !== 'carrera' && s.fase !== 'tapering' && s.minutos > ultimaReal * 1.3 && s.minutos > (media4 ?? 0) * 1.15 && !s.descarga) incidencias.push(`Semana ${w + 1}: el plan pide ${s.minutos} min tras una semana real de ${ultimaReal} (+${Math.round((s.minutos / ultimaReal - 1) * 100)} %).`)
    if (sinCorrer >= 2 && s.fase !== 'retorno' && s.fase !== 'carrera') incidencias.push(`Semana ${w + 1}: viene de ${sinCorrer} semanas sin correr y el plan no está en fase de retorno (${s.fase}).`)
    if (s.sesiones.some(x => ['series', 'ritmo_carrera'].includes(x.tipo)) && sinCorrer >= 1) incidencias.push(`Semana ${w + 1}: pide calidad intensa justo después de una semana sin correr.`)
    historia.push(ejecutado)
    if (s.fase === 'carrera') break
  }
  return { filas, incidencias }
}

const salida: string[] = [`# Simulación de la evolución de atletas sintéticos (${new Date().toISOString().slice(0, 10)})`, '',
  'Generado con `scripts/simular-evolucion-clientes.ts`; no toca la base de datos. Cada semana el motor se recalcula con lo que el atleta **realmente corrió** (media de las 4 últimas semanas completas; parón si lleva ≥ 2 semanas sin correr). La adherencia, los parones y los techos de tiempo son inventados para provocar situaciones: sirve para ver si el motor reacciona con sentido, no para validar resultados deportivos.', '']
let totalInc = 0
for (const a of ATLETAS) {
  semilla = 42
  const { filas, incidencias } = simular(a)
  totalInc += incidencias.length
  salida.push(`## ${a.nombre}`, '', a.nota, '', '| Sem | Fase | Planeado | Ejecutado | Media 4 sem previas |', '|---|---|---|---|---|')
  for (const f of filas) salida.push(`| ${f.sem}${f.descarga ? ' ↓' : ''} | ${f.fase} | ${f.planeado} | ${f.ejecutado} | ${f.media4 || '—'} |`)
  salida.push('', incidencias.length ? '**Incidencias detectadas:**' : '**Sin incidencias.**', ...incidencias.map(i => `- ${i}`), '')
}
const ruta = `docs/${new Date().toISOString().slice(0, 10).split('-').reverse().join('-')}_simulacion-evolucion-clientes.md`
writeFileSync(ruta, salida.join('\n'))
console.log(ruta, 'incidencias:', totalInc)
