import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

expect(read('app/entrenos/nueva/page.tsx').includes('coach-training-builder'), 'el builder de entreno debe compartir sistema visual')
expect(read('app/agentes/page.tsx').includes('coach-agent-inbox'), 'la bandeja IA debe compartir sistema visual')
const css = read('app/globals.css')
expect(css.includes('.coach-training-builder'), 'falta .coach-training-builder en globals.css')
expect(css.includes('.coach-agent-inbox'), 'falta .coach-agent-inbox en globals.css')

if (failures.length) {
  console.error(`coach final surfaces: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach final surfaces: 4 contracts PASS')
