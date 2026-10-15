import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const index = read('app/recetas/page.tsx')
const card = read('components/premium/RecipeCardPremium.tsx')
const reviewHeader = read('components/recetas/CabeceraRevision.tsx')
const reviewBar = read('components/recetas/BarraRevision.tsx')
const detail = read('app/recetas/[id]/page.tsx')
const editor = read('app/recetas/[id]/editar/page.tsx')
const create = read('app/recetas/nueva/page.tsx')
const audit = read('app/recetas/auditoria/page.tsx')
const coverage = read('app/recetas/cobertura/page.tsx')
const images = read('app/recetas/(revision)/imagenes/page.tsx')
const review = read('app/recetas/(revision)/revisar/page.tsx')
const css = read('app/globals.css')

expect(index.includes('coach-recipe-library'), 'el recetario debe declarar su sistema visual')
expect(index.includes('coach-recipe-hero'), 'el recetario debe usar cabecera editorial')
expect(index.includes('coach-recipe-metrics'), 'las métricas deben agruparse como rail operativo')
expect(card.includes('coach-recipe-card'), 'las recetas deben usar tarjeta casi cuadrada')
expect(!card.includes('var(--accent-glow)'), 'la tarjeta no debe usar glow decorativo')
expect(reviewHeader.includes('coach-review-header'), 'revisión debe compartir cabecera técnica')
expect(reviewBar.includes('coach-review-bar'), 'la barra de revisión debe compartir superficie técnica')
expect(detail.includes('coach-recipe-detail'), 'el detalle debe compartir el sistema visual')
expect(editor.includes('coach-recipe-editor'), 'la edición debe compartir el sistema visual')
expect(create.includes('coach-recipe-create'), 'la creación debe compartir el sistema visual')
expect(audit.includes('coach-recipe-audit'), 'la auditoría debe compartir el sistema visual')
expect(coverage.includes('coach-recipe-coverage'), 'cobertura debe compartir el sistema visual')
expect(images.includes('coach-recipe-images'), 'control visual debe compartir el sistema visual')
expect(review.includes('coach-recipe-review'), 'revisión por aprobar debe compartir el sistema visual')
for (const name of ['.coach-recipe-library', '.coach-recipe-hero', '.coach-recipe-card', '.coach-review-header']) {
  expect(css.includes(name), `falta ${name} en globals.css`)
}

if (failures.length) {
  console.error(`coach recipes parity: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach recipes parity: 18 contracts PASS')
