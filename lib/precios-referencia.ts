export const SUPERMERCADO_REFERENCIA = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Precio referencia coach',
  slug: 'precio-referencia-coach',
  color: '#64748b',
}

function norm(s: string | null | undefined) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

const EXACT: Array<[RegExp, number]> = [
  [/spaghetti|espagueti|pasta/, 1.8],
  [/harina de avena/, 3.8],
  [/overnight oats|proteina.*vainilla/, 18],
  [/aceite de oliva/, 7.5],
  [/cacao puro/, 12],
  [/ajo crudo|ajo picado/, 5],
  [/levadura quimica|polvo de hornear|bicarbonato/, 8],
  [/caseina|whey|proteina.*polvo/, 22],
  [/comino|pimenton|curry|canela|oregano|perejil|cilantro|jengibre|pimienta|curcuma|romero|tomillo/, 18],
  [/leche de avena/, 1.8],
  [/leche entera/, 1.15],
  [/datil|datiles/, 7],
  [/aguacate/, 5.5],
  [/pechuga de pollo|pollo.*cruda/, 7.5],
  [/limon|lima/, 2.2],
  [/huevo/, 4.2],
  [/pan integral|pan de pita|tortilla de trigo|wrap/, 4],
  [/queso feta/, 10],
  [/mostaza/, 4],
  [/ternera|carne picada/, 12],
  [/boniato|batata/, 2.4],
  [/mayonesa/, 4.5],
  [/salsa de soja/, 5],
  [/calabacin/, 2],
  [/cebolla/, 1.6],
  [/avena|copos/, 2.2],
  [/harina de trigo/, 1.1],
  [/yogur griego|yogur|requeson|queso fresco batido|skyr/, 3.2],
  [/fresa|frambuesa|frutos rojos|arandano/, 7],
  [/manteca|mantequilla/, 8],
  [/azucar|eritritol|edulcorante/, 2.2],
  [/chocolate/, 12],
  [/garbanzo|lenteja|alubia/, 2.5],
  [/arroz|cuscus|quinoa/, 2.4],
  [/tomate/, 2],
  [/pimiento/, 3],
  [/zanahoria/, 1.4],
  [/patata/, 1.5],
  [/brocoli|coliflor|espinaca|lechuga|rucula|apio|pepino/, 3],
  [/salmon/, 18],
  [/bacalao|merluza|gamba|sepia|corvina|atun/, 14],
  [/jamon|pavo|bacon/, 12],
  [/almendra|cacahuete|nuez|anacardo|pistacho/, 10],
  [/crema de cacahuete/, 6],
  [/miel/, 6],
  [/salsa teriyaki|salsa picante|salsa verde|tabasco/, 5],
  [/konjac/, 6],
  [/granada|mango|manzana|platano|banana|naranja/, 2.8],
]

const CATEGORY_DEFAULT: Record<string, number> = {
  Condimentos: 10,
  Cereales: 2.5,
  'Arroces y pastas': 2.2,
  Verduras: 2.5,
  Suplementos: 22,
  'Lácteos': 3.5,
  Lacteos: 3.5,
  Grasas: 6,
  'Aceites y grasas': 7,
  'Frutos secos': 10,
  Frutas: 3,
  Carnes: 9,
  Pescados: 14,
  Mariscos: 16,
  Huevos: 4.2,
  'Tubérculos': 1.8,
  Bebidas: 1.5,
  'Dulces y bollería': 8,
  Legumbres: 2.5,
  Semillas: 8,
}

export function estimarPrecioReferenciaKg(alimento: { nombre?: string | null; categoria?: string | null }) {
  const nombre = norm(alimento.nombre)
  for (const [regex, precio] of EXACT) {
    if (regex.test(nombre)) return { precio: round2(precio), metodo: `regla:${regex.source}` }
  }
  const precio = CATEGORY_DEFAULT[alimento.categoria || ''] || 5
  return { precio: round2(precio), metodo: `categoria:${alimento.categoria || 'sin_categoria'}` }
}

