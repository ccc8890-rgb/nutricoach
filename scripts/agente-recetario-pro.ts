import { detectarHuecosRecetario } from '../lib/recetas/agente-recetario/coverage'
import { generarCandidatasDesdeHueco } from '../lib/recetas/agente-recetario/generator'
import { prepararImagenPendiente } from '../lib/recetas/agente-recetario/image'
import { validarCandidataConservadora } from '../lib/recetas/agente-recetario/validator'

function arg(name: string, fallback = '') {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`))
  return found ? found.split('=').slice(1).join('=') : fallback
}

const objetivo = arg('objetivo', 'rendimiento')
const deporte = arg('deporte', 'running')
const momento = arg('momento', 'tapering')
const cantidad = Number(arg('cantidad', '3'))
const apply = process.argv.includes('--apply')

if (apply) {
  console.error('ERROR: --apply no esta implementado en la fase dry-run conservadora.')
  process.exit(1)
}

const gaps = detectarHuecosRecetario([{ objetivo, deporte, momento, actuales: 0 }])
const gap = gaps[0]

if (!gap) {
  console.log('AgenteRecetarioPro')
  console.log('Modo: dry-run')
  console.log('Sin huecos detectados para los filtros indicados.')
  process.exit(0)
}

const candidatas = generarCandidatasDesdeHueco(gap, { cantidad })
const validadas = candidatas.map((receta) => ({
  receta,
  validacion: validarCandidataConservadora(receta),
  imagen: prepararImagenPendiente(receta),
}))

console.log('AgenteRecetarioPro')
console.log('Modo: dry-run')
console.log(`Objetivo: ${objetivo}`)
console.log(`Deporte: ${deporte}`)
console.log(`Momento: ${momento}`)
console.log(`Hueco: ${gap.motivo}`)
console.log(`Generadas: ${candidatas.length}`)
console.log(`Validas para en_revision: ${validadas.filter((item) => item.validacion.valida).length}`)
console.log(`Descartadas: ${validadas.filter((item) => !item.validacion.valida).length}`)
console.log('Insertadas: 0')

for (const item of validadas) {
  console.log(`- ${item.receta.nombre} -> ${item.validacion.estado}`)
}
