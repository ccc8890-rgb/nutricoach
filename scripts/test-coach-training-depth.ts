import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['app/clientes/[id]/page.tsx', 'coach-client-training'],
  ['app/clientes/[id]/page.tsx', 'coach-training-plan-header'],
  ['app/clientes/[id]/page.tsx', 'coach-training-routine'],
  ['components/clientes/RutinaSemanaAccordion.tsx', 'coach-week-routine'],
  ['components/clientes/EntrenoCalendarioMes.tsx', 'coach-training-calendar'],
  ['components/training/HistorialEntreno.tsx', 'coach-training-history'],
  ['components/training/PerfilEntrenoForm.tsx', 'coach-athlete-profile'],
  ['components/rendimiento/PanelRendimiento.tsx', 'coach-performance-panel'],
  ['components/rendimiento/comun.tsx', 'coach-performance-block'],
  ['components/CompeticionesManager.tsx', 'coach-competition-manager'],
  ['components/ProtocoloCompeticion.tsx', 'coach-competition-protocol'],
]

for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)
const css = read('app/globals.css')
for (const className of ['.coach-client-training', '.coach-training-plan-header', '.coach-week-routine', '.coach-training-calendar', '.coach-performance-panel']) {
  expect(css.includes(className), `falta ${className} en globals.css`)
}

if (failures.length) {
  console.error(`coach training depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach training depth: 16 contracts PASS')
