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

// Cada consulta `from('recetas')` debe filtrar por «aprobada» dentro de su propia cadena (no basta con que el archivo lo diga en otro sitio).
function consultasSinFiltro(texto: string): number[] {
  const malas: number[] = []
  let desde = 0
  for (;;) {
    const i = texto.indexOf("from('recetas')", desde)
    if (i < 0) break
    const siguiente = texto.indexOf("from('", i + 15)
    const cadena = texto.slice(i, siguiente < 0 ? i + 700 : Math.min(siguiente, i + 700))
    if (!/aprobada/.test(cadena)) malas.push(texto.slice(0, i).split('\n').length)
    desde = i + 15
  }
  return malas
}
// Consultas que leen por id algo ya elegido/asignado: se revisan aparte (el archivo cumple el filtro general de arriba).
const CONSULTA_POR_ID_PERMITIDA: Record<string, string> = {
  'app/api/cliente/[codigo]/recetas/[recetaId]/route.ts': 'una receta ya asignada al plan se sigue pudiendo abrir',
  'lib/nutricion/plantilla-semana.ts': 'lee estado para validar y avisar de recetas no aprobadas',
  'lib/nutricion/semanas-futuras.ts': 'solo carga ingredientes de recetas ya elegidas',
}
const sinFiltro = [
  ...DEBEN_FILTRAR.filter(f => !(f in CONSULTA_POR_ID_PERMITIDA)).flatMap(f => { const l = consultasSinFiltro(readFileSync(f, 'utf8')); return l.length ? [`${f}:${l.join(',')}`] : [] }),
  ...Object.keys(CONSULTA_POR_ID_PERMITIDA).filter(f => !/aprobada/.test(readFileSync(f, 'utf8'))),
]
assert.deepEqual(sinFiltro, [], `Estos archivos leen recetas sin filtrar por «aprobada»: ${sinFiltro.join(', ')}`)
assert.ok(EXCEPCIONES.length === 4)
console.log('recetas-solo-aprobadas OK')
