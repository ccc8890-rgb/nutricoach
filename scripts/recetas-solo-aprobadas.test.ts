import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Todo camino que lee recetas para el cliente o el planificador debe filtrar por estado «aprobada»:
// una receta reportada (en_revision) tiene que quedar fuera del circuito.
const DEBEN_FILTRAR = [
  'app/api/cliente/[codigo]/recetario/route.ts',
  'app/api/cliente/[codigo]/recetas/[recetaId]/route.ts',
  'app/api/cliente/[codigo]/comidas/[comidaId]/alternativas/route.ts',
  'app/api/comidas/[comidaId]/alternativas/route.ts',
  'app/api/recetas/alternativas/route.ts',
  'app/api/recetas/sugeridas/route.ts',
  'app/api/clientes/[id]/semana-dieta/route.ts',
  'app/api/contenido/recetas/route.ts',
  'lib/plan-recetas.ts',
  'lib/nutricion/complementos.ts',
  'lib/nutricion/completar-comidas.ts',
  'lib/nutricion/plantilla-semana.ts',
  'lib/nutricion/semanas-futuras.ts',
  'app/api/generar-dieta-ia/route.ts',
]

// Excepciones: leen planes ya montados; por decisión de diseño no se tocan solos (solo se avisa en cuántos planes está la receta).
const EXCEPCIONES = [
  'app/api/compra/route.ts',
  'lib/nutricion/detalle-dia.ts',
  'lib/agentes/perfil-gusto.ts',
  // Recetas generadas por IA solo para ese cliente (fuente ia_personalizada): no forman parte del recetario del coach.
  'app/api/cliente/[codigo]/mis-platos/route.ts',
]

const sinFiltro = DEBEN_FILTRAR.filter(f => !/aprobada/.test(readFileSync(f, 'utf8')))
assert.deepEqual(sinFiltro, [], `Estos archivos leen recetas sin filtrar por «aprobada»: ${sinFiltro.join(', ')}`)
assert.ok(EXCEPCIONES.length === 4)
console.log('recetas-solo-aprobadas OK')
