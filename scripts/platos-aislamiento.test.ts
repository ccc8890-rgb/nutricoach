import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Aislamiento entre clientes (Review Focus 1): todo fichero del lado cliente que lea/escriba platos_cliente* debe filtrar por cliente.
const DEBEN_EXISTIR = [
  'app/api/cliente/[codigo]/platos/route.ts',
  'app/api/cliente/[codigo]/platos/[id]/route.ts',
  'app/api/cliente/[codigo]/platos/[id]/enviar/route.ts',
  'lib/platos/guardar.ts',
]
for (const f of DEBEN_EXISTIR) assert.ok(existsSync(f), `falta ${f}`)

function ficheros(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, acc)
    else if (/\.(ts|tsx)$/.test(n)) acc.push(p)
  }
  return acc
}

const lado = [...ficheros('app/api/cliente'), ...ficheros('lib/platos')]
let revisados = 0
for (const f of lado) {
  const src = readFileSync(f, 'utf8')
  if (!/from\('platos_cliente/.test(src)) continue
  revisados++
  assert.ok(/\.eq\('cliente_id'/.test(src) || /clienteId/.test(src), `${f} toca platos_cliente sin filtrar por cliente`)
  assert.ok(!/err(or)?\.message/.test(src.replace(/console\.\w+\([^)]*\)/g, '')) || !/NextResponse\.json\([^)]*\.message/.test(src), `${f} devuelve .message al cliente`)
}
assert.ok(revisados >= 3, `se esperaban ≥3 ficheros de cliente con platos_cliente, hay ${revisados}`)
console.log('platos-aislamiento OK')
