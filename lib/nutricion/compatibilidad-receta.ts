// Reglas de compatibilidad receta ↔ cliente. Una sola fuente: las usan el filtro de candidatas (lib/plan-recetas.ts)
// y la comprobación al aplicar una plantilla a un cliente.

// Restricción del cliente → alérgenos EU que la receta no debe llevar
export const RESTRICCION_A_ALERGENO: Record<string, string[]> = {
  'sin gluten':       ['Gluten'],
  'sin lactosa':      ['Lácteos'],
  'sin huevo':        ['Huevos'],
  'sin frutos secos': ['Frutos Secos', 'Cacahuetes'],
  'sin soja':         ['Soja'],
  'sin mariscos':     ['Crustáceos', 'Moluscos'],
  'vegetariano':      ['Pescado', 'Crustáceos', 'Moluscos'],
  'vegano':           ['Lácteos', 'Huevos', 'Pescado', 'Crustáceos', 'Moluscos'],
}

// La carne no es alérgeno EU: vegano/vegetariano se exigen con el tag positivo de la receta
export const RESTRICCION_A_TAG_POSITIVO: Record<string, string> = {
  'vegano': 'Vegano',
  'vegetariano': 'Vegetariano',
}

// «Pescado azul», «marisco»… son grupos: se excluye cualquiera de sus alimentos
export const GRUPOS_EVITAR: [RegExp, string[]][] = [
  [/pescado azul|pescados azules/, ['salmón', 'salmon', 'atún', 'atun', 'caballa', 'sardina', 'anchoa', 'boquerón', 'boqueron', 'bonito', 'arenque', 'jurel']],
  [/marisco/, ['gamba', 'langostino', 'mejillón', 'mejillon', 'almeja', 'calamar', 'sepia', 'pulpo', 'zamburiña', 'cangrejo', 'berberecho']],
  [/carne roja/, ['ternera', 'cerdo', 'cordero', 'buey', 'solomillo', 'chorizo']],
  // «carne», «aves», «embutidos»: antes solo existía «carne roja», así que una pescetariana que evitaba «carne, pollo,
  // embutidos» recibía chorizo, jamón serrano y pavo. Sin «lomo»/«pechuga» sueltos: «lomo de salmón» es pescado.
  [/^\s*carnes?\s*$|todas las carnes/, ['pollo', 'pavo', 'pato', 'gallina', 'ternera', 'cerdo', 'cordero', 'buey', 'conejo', 'jamón', 'jamon', 'chorizo', 'bacon', 'beicon', 'panceta', 'salchicha', 'salchichón', 'salchichon', 'morcilla', 'longaniza', 'sobrasada', 'lomo de cerdo', 'lomo embuchado', 'solomillo de cerdo', 'solomillo de ternera', 'hamburguesa de carne', 'albóndiga', 'albondiga', 'carne picada', 'carne de ', 'mortadela', 'fuet']],
  [/^\s*aves?\s*$/, ['pollo', 'pavo', 'pato', 'gallina']],
  [/embutido|fiambre/, ['jamón', 'jamon', 'chorizo', 'salchichón', 'salchichon', 'mortadela', 'fuet', 'lomo embuchado', 'sobrasada', 'morcilla', 'longaniza', 'bacon', 'beicon', 'panceta', 'salchicha']],
  [/lácteo|lacteo/, ['leche', 'yogur', 'queso', 'skyr', 'requesón', 'requeson', 'nata', 'mantequilla']],
  [/frutos secos/, ['almendra', 'nuez', 'nueces', 'avellana', 'pistacho', 'anacardo', 'cacahuete']],
]
// Dietas que no son alérgenos ni tienen etiqueta positiva en la receta: se traducen a lo que hay que evitar
export const RESTRICCION_A_EVITAR: Record<string, string[]> = {
  'pescetariano': ['carne', 'embutidos'],
}

export const expandirEvitar = (a: string) => [a, ...GRUPOS_EVITAR.filter(([re]) => re.test(a)).flatMap(([, l]) => l)]

// Motivo por el que la receta no vale para el cliente, o null si es compatible
export function motivoIncompatible(
  receta: { nombre: string; intolerancias: string[] | null; ingredientes: string[] },
  restricciones: string[],
  evitar: string[],
): string | null {
  const intol = receta.intolerancias ?? []
  for (const r of restricciones) {
    const alergenos = RESTRICCION_A_ALERGENO[r.toLowerCase()] ?? [r]
    const hay = alergenos.find(a => intol.includes(a))
    if (hay) return `lleva ${hay.toLowerCase()} (${r})`
    const tag = RESTRICCION_A_TAG_POSITIVO[r.toLowerCase()]
    if (tag && !intol.includes(tag)) return `no está marcada como ${tag.toLowerCase()}`
  }
  const porDieta = restricciones.flatMap(r => RESTRICCION_A_EVITAR[r.toLowerCase()] ?? [])
  const terminos = [...evitar, ...porDieta].map(a => a.trim().toLowerCase()).filter(Boolean).flatMap(expandirEvitar)
  const textos = [receta.nombre.toLowerCase(), ...receta.ingredientes.map(i => i.toLowerCase())]
  const malo = terminos.find(t => textos.some(x => x.includes(t)))
  return malo ? `lleva «${malo}», que el cliente evita` : null
}
