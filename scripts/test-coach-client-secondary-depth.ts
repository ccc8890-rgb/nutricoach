import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['app/clientes/[id]/page.tsx', 'coach-client-followup'],
  ['app/clientes/[id]/page.tsx', 'coach-checkin-card'],
  ['app/clientes/[id]/page.tsx', 'coach-client-communication'],
  ['app/clientes/[id]/page.tsx', 'coach-client-profile'],
  ['app/clientes/[id]/page.tsx', 'coach-membership-panel'],
  ['components/clientes/ActividadClientePanel.tsx', 'coach-activity-panel'],
  ['components/PortalCliente/ChatPanel.tsx', 'coach-chat-panel'],
  ['components/clientes/InformeCaso.tsx', 'coach-case-report'],
  ['components/clientes/AnaliticasPanel.tsx', 'coach-clinical-analytics'],
  ['components/ClienteEditar.tsx', 'coach-client-edit'],
]

for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)
const css = read('app/globals.css')
for (const className of ['.coach-client-followup', '.coach-activity-panel', '.coach-checkin-card', '.coach-client-communication', '.coach-chat-panel', '.coach-client-profile', '.coach-client-edit']) {
  expect(css.includes(className), `falta ${className} en globals.css`)
}

if (failures.length) {
  console.error(`coach client secondary depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach client secondary depth: 17 contracts PASS')
