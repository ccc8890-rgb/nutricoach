type IngredienteInput = {
  nombre_libre?: string | null
  alimento?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null
}

export type RecetaParaTag = {
  nombre: string
  receta_ingredientes?: IngredienteInput[] | null
}

// Keywords en el NOMBRE de la receta → tag
const NAME_TAGS: [string, string][] = [
  ['bowl', 'Bowl'],
  ['burrito', 'Burrito'],
  ['wrap', 'Wrap'],
  ['fajita', 'Fajita'],
  ['taco', 'Tacos'],
  ['sandwich', 'Sandwich'],
  ['bocadillo', 'Sandwich'],
  ['ensalada', 'Ensalada'],
  ['sopa', 'Sopa'],
  ['wok', 'Wok'],
  ['tosta', 'Tostada'],
  ['tostada', 'Tostada'],
  ['tortita', 'Tortitas'],
  ['pancake', 'Pancakes'],
  ['waffle', 'Waffle'],
  ['gofre', 'Gofre'],
  ['bizcocho', 'Bizcocho'],
  ['galleta', 'Galleta'],
  ['cookie', 'Cookie'],
  ['brownie', 'Brownie'],
  ['tarta', 'Tarta'],
  ['helado', 'Helado'],
  ['mousse', 'Mousse'],
  ['granola', 'Granola'],
  ['batido', 'Batido'],
  ['smoothie', 'Batido'],
  ['pudding', 'Pudding'],
  ['crepe', 'Crepe'],
  ['pizza', 'Pizza'],
  ['arroz', 'Arroz'],
  ['pasta', 'Pasta'],
  ['mayonesa', 'Mayonesa'],
  ['pesto', 'Pesto'],
  ['hummus', 'Hummus'],
  ['guacamole', 'Guacamole'],
  ['tzatziki', 'Tzatziki'],
  ['alioli', 'Alioli'],
  ['barbacoa', 'Barbacoa'],
]

// Keywords en INGREDIENTES → tag
const INGREDIENT_TAGS: [string, string][] = [
  // Pollo / aves
  ['pollo', 'Pollo'], ['pechuga', 'Pollo'], ['muslo', 'Pollo'],
  ['contramuslo', 'Pollo'], ['pavo', 'Pollo'],
  // Carne roja
  ['ternera', 'Carne'], ['buey', 'Carne'], ['solomillo', 'Carne'],
  ['filete de', 'Carne'], ['cerdo', 'Carne'], ['lomo de', 'Carne'],
  ['panceta', 'Carne'], ['costilla', 'Carne'], ['secreto', 'Carne'],
  ['carne picada', 'Carne'],
  // Pescado / marisco
  ['salmon', 'Pescado'], ['atun', 'Pescado'], ['merluza', 'Pescado'],
  ['bacalao', 'Pescado'], ['lubina', 'Pescado'], ['dorada', 'Pescado'],
  ['rape', 'Pescado'], ['sardina', 'Pescado'], ['caballa', 'Pescado'],
  ['boqueron', 'Pescado'], ['gamba', 'Pescado'], ['langostino', 'Pescado'],
  ['camaron', 'Pescado'],
  // Carbohidratos
  ['arroz', 'Arroz'],
  ['pasta', 'Pasta'], ['espagueti', 'Pasta'], ['macarron', 'Pasta'],
  ['fettuccine', 'Pasta'], ['tagliatelle', 'Pasta'], ['penne', 'Pasta'],
  ['fideo', 'Pasta'], ['tallarines', 'Pasta'], ['linguine', 'Pasta'],
  // Legumbres
  ['lenteja', 'Legumbre'], ['garbanzo', 'Legumbre'], ['alubia', 'Legumbre'],
  ['judia', 'Legumbre'], ['frijol', 'Legumbre'], ['guisante', 'Legumbre'],
  ['edamame', 'Legumbre'],
  // Tubérculos
  ['patata', 'Patata'],
  // Postres
  ['chocolate', 'Chocolate'],
]

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')   // quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')
}

export function autoTagReceta(receta: RecetaParaTag): string[] {
  const tags = new Set<string>()
  const nombreN = norm(receta.nombre)

  // Tags desde el nombre del plato
  for (const [kw, tag] of NAME_TAGS) {
    if (nombreN.includes(norm(kw))) tags.add(tag)
  }

  // Tags desde ingredientes
  const ingTexts: string[] = []
  for (const ing of receta.receta_ingredientes ?? []) {
    const alimento = Array.isArray(ing.alimento) ? ing.alimento[0] : ing.alimento
    if (alimento?.nombre) ingTexts.push(norm(alimento.nombre))
    if (ing.nombre_libre) ingTexts.push(norm(ing.nombre_libre))
  }
  const ingStr = ingTexts.join(' ')

  for (const [kw, tag] of INGREDIENT_TAGS) {
    if (ingStr.includes(norm(kw))) tags.add(tag)
  }

  return Array.from(tags).sort()
}
