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
  [/vodka|licor amaretto|anis seco|anís seco/, 11],
  [/vino tinto|vino blanco/, 3.5],
  [/pasta de curry|curry rojo|curry verde/, 10],
  [/spaghetti|espagueti|pasta/, 1.8],
  [/harina de avena/, 3.8],
  [/overnight oats|proteina.*vainilla/, 18],
  [/aceite de oliva/, 7.5],
  [/cacao puro|cacao en polvo/, 12],
  [/ajo crudo|ajo picado/, 5],
  [/levadura quimica|polvo de hornear|bicarbonato/, 8],
  [/caseina|caseína micelar|whey|proteina.*polvo|proteína.*polvo/, 22],
  [/comino|pimenton|pimentón|curry|canela|oregano|orégano|perejil|cilantro|jengibre|pimienta|curcuma|cúrcuma|romero|tomillo|albahaca|azafran|azafrán|nuez moscada|laurel|eneldo|hierbabuena|menta/, 18],
  [/leche de avena/, 1.8],
  [/leche entera/, 1.15],
  [/leche de coco/, 1.5],
  [/datil|datiles|dátil|dátiles/, 7],
  [/aguacate/, 5.5],
  [/pechuga de pollo|pollo.*cruda|muslo de pollo/, 7.5],
  [/limon|lima|limón/, 2.2],
  [/huevo entero|huevo/, 4.2],
  [/pan integral|pan de pita|pan molde|tortilla de trigo|wrap/, 4],
  [/queso feta|requeson|requesón/, 10],
  [/mostaza/, 4],
  [/ternera|carne picada/, 12],
  [/boniato|batata/, 2.4],
  [/mayonesa/, 4.5],
  [/salsa de soja|salsa barbacoa|salsa de tomate|condimento.*bbq/, 5],
  [/calabacin|calabacín/, 2],
  [/cebolla/, 1.6],
  [/avena|copos.*avena|avena.*hojuela/, 2.2],
  [/harina de trigo|harina.*almendra|harina de almendra/, 1.1],
  [/yogur griego|yogur|yogur.*griego|requeson|queso fresco batido|skyr|crema agria/, 3.2],
  [/fresa|frambuesa|frutos rojos|arandano|arándano/, 7],
  [/manteca|mantequilla/, 8],
  [/azucar|azúcar|azucar.*glas|azúcar.*glas|eritritol|edulcorante/, 2.2],
  [/chocolate/, 12],
  [/garbanzo|lenteja|alubia/, 2.5],
  [/arroz|cuscus|quinoa|lámina.*lasaña/, 2.4],
  [/tomate|tomates.*cherry|tomate.*cherry/, 2],
  [/pimiento/, 3],
  [/zanahoria/, 1.4],
  [/patata|patata cocida|boniato|batata/, 1.5],
  [/brocoli|coliflor|espinaca|espinacas|lechuga|rucula|rúcula|apio|pepino|calabacín|calabacin|berenjena|alcachofa|esparrago|espárrago|kale|col.*lombarda/, 3],
  [/salmon|salmón/, 18],
  [/bacalao|merluza|gamba|camar[oó]n|camarones|sepia|corvina|atun|boquerón|boqueron/, 14],
  [/jamon|jamón|pavo|bacon|beicon/, 12],
  [/almendra|cacahuete|nuez|anacardo|pistacho|crema de avellana/, 10],
  [/crema de cacahuete/, 6],
  [/miel/, 6],
  [/salsa teriyaki|salsa picante|salsa verde|tabasco/, 5],
  [/konjac/, 6],
  [/granada|mango|manzana|platano|plátano|banana|naranja|sandía|sandia|melon|melón|pera|uva|cereza|piña|kiwi|pomelo|papaya|higos|higo|ciruela/, 2.8],
  [/zumo.*naranja|zumo de naranja/, 2.2],
  [/caldo.*pollo|caldo.*pescado|sopa.*verduras/, 3],
  [/maíz|maiz.*dulce|maíz dulce/, 2],
  [/malvavisco/, 8],
  [/gelatina/, 15],
]

const CATEGORY_DEFAULT: Record<string, number> = {
  Condimentos: 10,
  'Especias y condimentos': 18,
  Cereales: 2.5,
  'Arroces y pastas': 2.2,
  Verduras: 2.5,
  'Verduras y hortalizas': 3,
  Suplementos: 22,
  'Lácteos': 3.5,
  Lacteos: 3.5,
  Grasas: 6,
  'Aceites y grasas': 7,
  'Grasas y aceites': 7,
  'Frutos secos': 10,
  Frutas: 3,
  Carnes: 9,
  'Carnes y aves': 9,
  Pescados: 14,
  Mariscos: 16,
  Huevos: 4.2,
  'Huevos y derivados': 4.2,
  'Tubérculos': 1.8,
  Bebidas: 1.5,
  'Dulces y bollería': 8,
  Legumbres: 2.5,
  Semillas: 8,
  Snacks: 6,
  Otros: 5,
}

export function estimarPrecioReferenciaKg(alimento: { nombre?: string | null; categoria?: string | null }) {
  const nombre = norm(alimento.nombre)
  for (const [regex, precio] of EXACT) {
    if (regex.test(nombre)) return { precio: round2(precio), metodo: `regla:${regex.source}` }
  }
  const precio = CATEGORY_DEFAULT[alimento.categoria || ''] || 5
  return { precio: round2(precio), metodo: `categoria:${alimento.categoria || 'sin_categoria'}` }
}
