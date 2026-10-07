// Reglas dietéticas por condición de salud (texto libre del cuestionario): qué recetas se excluyen, cuáles bajan en
// el ranking y cuáles suben. Criterio de partida de un dietista; el coach lo revisa y lo afina.
//  - evitar: se excluye la receta si el nombre o algún ingrediente lleva estos términos (sin tildes)
//  - penalizar / favorecer: ajusta la puntuación (×0,6 y +0,08 por coincidencia)
export type ReglasClinicas = { condiciones: string[]; evitar: string[]; penalizar: string[]; favorecer: string[]; tagFavorable?: 'apto_diabetes' }

const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const VISCERAS = ['higado', 'visceras', 'rinon', 'callos', 'sesos', 'foie', 'molleja']
const EMBUTIDOS = ['chorizo', 'salchicha', 'morcilla', 'panceta', 'bacon', 'beicon', 'salami', 'mortadela', 'fuet', 'sobrasada', 'jamon curado', 'jamon serrano']

export function reglasClinicas(condicionesSalud?: string | null): ReglasClinicas {
  const t = sinTildes(condicionesSalud ?? '')
  const r: ReglasClinicas = { condiciones: [], evitar: [], penalizar: [], favorecer: [] }
  const tiene = (re: RegExp) => re.test(t)
  const sinNegar = (re: RegExp) => { const m = t.match(re); return !!m && !new RegExp(`sin\\s+(?:${re.source})`).test(t) }

  if (tiene(/dislipidemia|colesterol|triglicerid|\bldl\b/)) {
    r.condiciones.push('dislipidemia')
    r.evitar.push(...VISCERAS, ...EMBUTIDOS, 'mantequilla', 'nata', 'cheddar', 'bollo', 'croissant')
    r.penalizar.push('burger', 'hamburguesa', 'kebab', 'bigmac', 'crujiente', 'frito', 'alioli', 'mayonesa', 'queso', 'coco', 'sirope', 'mermelada')
    r.favorecer.push('legumbre', 'lenteja', 'garbanzo', 'alubia', 'avena', 'pescado', 'merluza', 'bacalao', 'salmon', 'caballa', 'sardina', 'aguacate', 'nueces', 'oliva')
  }
  if (sinNegar(/hipertension|tension alta|\bhta\b/)) {
    r.condiciones.push('hipertension')
    r.evitar.push(...EMBUTIDOS, 'anchoa', 'salazon', 'encurtido')
    r.penalizar.push('salsa de soja', 'queso curado', 'aceituna', 'conserva')
    r.favorecer.push('legumbre', 'verdura', 'fruta', 'avena')
  }
  if (sinNegar(/diabetes|prediabetes|resistencia a la insulina|glucosa alta/)) {
    r.condiciones.push('diabetes')
    r.penalizar.push('mermelada', 'sirope', 'miel', 'azucar', 'dulce de leche', 'zumo', 'bollo', 'chocolate con leche', 'arroz con leche', 'copos de maiz')
    r.favorecer.push('legumbre', 'lenteja', 'garbanzo', 'avena', 'verdura', 'quinoa', 'integral')
    r.tagFavorable = 'apto_diabetes'
  }
  if (tiene(/anemia|ferritina|hierro/)) {
    r.condiciones.push('anemia')
    r.favorecer.push('lenteja', 'garbanzo', 'alubia', 'espinaca', 'tofu', 'tempeh', 'ternera', 'quinoa', 'semillas de calabaza', 'pistacho')
  }
  return r
}

const contiene = (texto: string, terminos: string[]) => terminos.filter(x => texto.includes(x)).length

// Puntuación clínica de una receta: null = excluir; si no, ajuste (multiplicador y bonus) sobre su puntuación
export function ajusteClinico(reglas: ReglasClinicas, nombre: string, ingredientes: string[], tags?: Record<string, unknown>): { excluir: boolean; mult: number; bonus: number } {
  if (reglas.condiciones.length === 0) return { excluir: false, mult: 1, bonus: 0 }
  const texto = sinTildes(`${nombre} ${ingredientes.join(' ')}`)
  if (contiene(texto, reglas.evitar) > 0) return { excluir: true, mult: 0, bonus: 0 }
  const malas = Math.min(2, contiene(texto, reglas.penalizar))
  const buenas = Math.min(3, contiene(texto, reglas.favorecer))
  const tag = reglas.tagFavorable && tags?.[reglas.tagFavorable] === true ? 0.05 : 0
  return { excluir: false, mult: malas > 0 ? 0.6 ** malas : 1, bonus: 0.04 * buenas + tag }
}
