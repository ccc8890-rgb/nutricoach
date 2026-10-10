// Verificación única del motor de rendimiento y planes de carrera: tests + tipos + eslint + simulación de evolución + estudios citados.
// Se ejecuta SIEMPRE antes de dar por bueno cualquier cambio en el motor:   npm run verificar:motor
// Sale con código ≠ 0 si algo falla, para que ningún cambio rompa en silencio un error que ya se corrigió.
import { spawnSync } from 'node:child_process'

const TESTS = [
  // análisis de lo entrenado
  'reglas', 'estado', 'guardas', 'motor', 'evidencia', 'seguimiento', 'hitos', 'intensidad', 'deportes', 'deriva', 'tecnica', 'fit-actividad', 'analisis-rendimiento', 'rendimiento',
  // planes de carrera
  'ritmos', 'pasos', 'running-plantillas', 'validar-plan-carrera', 'macrociclo', 'macro-desde-cliente', 'macro-a-sesiones', 'planificar-modo', 'guardar-plan', 'planificar-con-ia', 'aplicar-plan-ia', 'planificar-ia-ruta', 'competicion', 'suplementos', 'proxima-fecha', 'garmin-auto', 'garmin-workouts-formato',
]

interface Resultado { nombre: string; ok: boolean; detalle: string }
const resultados: Resultado[] = []
const ejecutar = (nombre: string, cmd: string, args: string[], fallo?: (salida: string) => string | null) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 240_000 })
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const motivo = fallo ? fallo(salida) : null
  const ok = r.status === 0 && !motivo
  resultados.push({ nombre, ok, detalle: ok ? '' : (motivo ?? salida.trim().split('\n').filter(l => /Error|error|falla|✗/.test(l)).slice(0, 3).join(' | ') ?? salida.slice(-300)) })
}

for (const t of TESTS) ejecutar(`test ${t}`, 'npx', ['tsx', `scripts/${t}.test.ts`])
ejecutar('tipos (tsc)', 'npx', ['tsc', '--noEmit', '--pretty', 'false'])
ejecutar('eslint (motor)', 'npx', ['eslint', 'lib/entrenos', 'lib/rendimiento', 'lib/nutricion/competicion.ts', 'app/api/entrenos/proponer-plan-ciencia/route.ts'])
// La simulación de evolución no debe provocar incidencias (saltos de volumen, calidad intensa tras parón, etc.).
ejecutar('simulación de evolución', 'npx', ['tsx', 'scripts/simular-evolucion-clientes.ts'], s => {
  const m = s.match(/incidencias: (\d+)/)
  return m && Number(m[1]) > 0 ? `${m[1]} incidencias: ver docs/*_simulacion-evolucion-clientes.md` : m ? null : 'la simulación no terminó'
})
ejecutar('estudios citados por las reglas', 'npx', ['tsx', 'scripts/verificar-doi-reglas.ts'])

const fallos = resultados.filter(r => !r.ok)
for (const r of resultados) console.log(`${r.ok ? '✅' : '❌'} ${r.nombre}${r.ok ? '' : ` — ${r.detalle}`}`)
console.log(`\n${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas`)
process.exit(fallos.length ? 1 : 0)
