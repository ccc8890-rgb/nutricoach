/**
 * categorizador.ts — Categorización nutricional automática por keywords
 *
 * Asigna una categoría nutricional real a los alimentos basándose en
 * palabras clave en su nombre. Reemplaza la categoría genérica 'Supermercado'
 * que se asigna por defecto durante el scraping.
 *
 * FLUJO:
 *   1. Recibe el nombre normalizado del alimento
 *   2. Busca coincidencias en el mapa de keywords → categoría
 *   3. Si encuentra, devuelve la categoría nutricional
 *   4. Si no, devuelve null (se quedará como 'Supermercado' para procesar después)
 */

// Mapa de palabras clave → categoría nutricional
// Organizado por especificidad descendente para que coincidencias más
// específicas tengan prioridad sobre las genéricas
const CATEGORIAS_POR_KEYWORD: [string, string][] = [
  // ── Carnes blancas ──
  ['pollo asado', 'Carnes blancas'],
  ['pollo', 'Carnes blancas'],
  ['pavo', 'Carnes blancas'],
  ['pierna de pollo', 'Carnes blancas'],
  ['pechuga de pollo', 'Carnes blancas'],
  ['pechuga de pavo', 'Carnes blancas'],
  ['muslo de pollo', 'Carnes blancas'],
  ['ala de pollo', 'Carnes blancas'],
  ['conejo', 'Carnes blancas'],
  ['codorniz', 'Carnes blancas'],

  // ── Carnes rojas ──
  ['ternera', 'Carnes rojas'],
  ['vaca', 'Carnes rojas'],
  ['buey', 'Carnes rojas'],
  ['cerdo', 'Carnes rojas'],
  ['cordero', 'Carnes rojas'],
  ['cabrito', 'Carnes rojas'],
  ['carne picada', 'Carnes rojas'],
  ['lomo', 'Carnes rojas'],
  ['solomillo', 'Carnes rojas'],
  ['entrecot', 'Carnes rojas'],
  ['chuleta', 'Carnes rojas'],
  ['filete', 'Carnes rojas'],

  // ── Pescado blanco ──
  ['merluza', 'Pescado blanco'],
  ['bacalao', 'Pescado blanco'],
  ['lenguado', 'Pescado blanco'],
  ['rape', 'Pescado blanco'],
  ['dorada', 'Pescado blanco'],
  ['lubina', 'Pescado blanco'],
  ['pescadilla', 'Pescado blanco'],
  ['abadejo', 'Pescado blanco'],
  ['gallineta', 'Pescado blanco'],

  // ── Pescado azul ──
  ['salmón', 'Pescado azul'],
  ['salmon', 'Pescado azul'],
  ['atún', 'Pescado azul'],
  ['atun', 'Pescado azul'],
  ['caballa', 'Pescado azul'],
  ['boquerón', 'Pescado azul'],
  ['boqueron', 'Pescado azul'],
  ['sardina', 'Pescado azul'],
  ['jurel', 'Pescado azul'],
  ['bonito', 'Pescado azul'],
  ['trucha', 'Pescado azul'],

  // ── Mariscos ──
  ['gamba', 'Mariscos'],
  ['langostino', 'Mariscos'],
  ['mejillón', 'Mariscos'],
  ['mejillon', 'Mariscos'],
  ['almeja', 'Mariscos'],
  ['berberecho', 'Mariscos'],
  ['navaja', 'Mariscos'],
  ['pulpo', 'Mariscos'],
  ['calamar', 'Mariscos'],
  ['sepia', 'Mariscos'],
  ['chipirón', 'Mariscos'],
  ['chipiron', 'Mariscos'],

  // ── Huevos ──
  ['huevo', 'Huevos'],

  // ── Lácteos ──
  ['leche entera', 'Lácteos enteros'],
  ['leche semidesnatada', 'Lácteos semidesnatados'],
  ['leche desnatada', 'Lácteos desnatados'],
  ['leche', 'Lácteos enteros'],
  ['yogur natural', 'Lácteos enteros'],
  ['yogur griego', 'Lácteos enteros'],
  ['yogur desnatado', 'Lácteos desnatados'],
  ['yogur', 'Lácteos enteros'],
  ['yogourt', 'Lácteos enteros'],
  ['queso fresco', 'Lácteos enteros'],
  ['queso curado', 'Lácteos enteros'],
  ['queso semicurado', 'Lácteos enteros'],
  ['queso rallado', 'Lácteos enteros'],
  ['queso crema', 'Lácteos enteros'],
  ['queso', 'Lácteos enteros'],
  ['requesón', 'Lácteos enteros'],
  ['requeson', 'Lácteos enteros'],
  ['nata', 'Lácteos enteros'],
  ['mantequilla', 'Lácteos enteros'],
  ['flan', 'Lácteos enteros'],
  ['cuajada', 'Lácteos enteros'],
  ['batido', 'Lácteos enteros'],

  // ── Legumbres ──
  ['lenteja', 'Legumbres'],
  ['garbanzo', 'Legumbres'],
  ['alubia', 'Legumbres'],
  ['judía blanca', 'Legumbres'],
  ['judia blanca', 'Legumbres'],
  ['judía verde', 'Verduras y hortalizas'],
  ['judia verde', 'Verduras y hortalizas'],
  ['haba', 'Legumbres'],
  ['guisante', 'Legumbres'],
  ['soja', 'Legumbres'],

  // ── Arroces y pastas ──
  ['arroz redondo', 'Arroces y pastas'],
  ['arroz basmati', 'Arroces y pastas'],
  ['arroz integral', 'Arroces y pastas'],
  ['arroz', 'Arroces y pastas'],
  ['pasta', 'Arroces y pastas'],
  ['espagueti', 'Arroces y pastas'],
  ['macarrón', 'Arroces y pastas'],
  ['macarron', 'Arroces y pastas'],
  ['fideo', 'Arroces y pastas'],
  ['tallarín', 'Arroces y pastas'],
  ['tallarin', 'Arroces y pastas'],
  ['lasaña', 'Arroces y pastas'],
  ['lasana', 'Arroces y pastas'],
  ['cuscús', 'Arroces y pastas'],
  ['cuscus', 'Arroces y pastas'],
  ['sémola', 'Arroces y pastas'],
  ['semola', 'Arroces y pastas'],
  ['gnocchi', 'Arroces y pastas'],
  ['ñoqui', 'Arroces y pastas'],
  ['noqui', 'Arroces y pastas'],

  // ── Pan y cereales ──
  ['pan de molde', 'Pan y cereales'],
  ['pan integral', 'Pan y cereales'],
  ['pan', 'Pan y cereales'],
  ['cereal', 'Pan y cereales'],
  ['avena', 'Pan y cereales'],
  ['copos de avena', 'Pan y cereales'],
  ['muesli', 'Pan y cereales'],
  ['galleta', 'Pan y cereales'],
  ['galleta', 'Pan y cereales'],
  ['tostada', 'Pan y cereales'],
  ['bizcocho', 'Pan y cereales'],

  // ── Frutas ──
  ['manzana', 'Frutas frescas'],
  ['plátano', 'Frutas frescas'],
  ['platano', 'Frutas frescas'],
  ['naranja', 'Frutas frescas'],
  ['fresa', 'Frutas frescas'],
  ['uva', 'Frutas frescas'],
  ['kiwi', 'Frutas frescas'],
  ['pera', 'Frutas frescas'],
  ['melón', 'Frutas frescas'],
  ['melon', 'Frutas frescas'],
  ['sandía', 'Frutas frescas'],
  ['sandia', 'Frutas frescas'],
  ['melocotón', 'Frutas frescas'],
  ['melocoton', 'Frutas frescas'],
  ['albaricoque', 'Frutas frescas'],
  ['ciruela', 'Frutas frescas'],
  ['cereza', 'Frutas frescas'],
  ['piña', 'Frutas frescas'],
  ['pina', 'Frutas frescas'],
  ['mango', 'Frutas frescas'],
  ['aguacate', 'Frutas frescas'],
  ['papaya', 'Frutas frescas'],
  ['limón', 'Frutas frescas'],
  ['limon', 'Frutas frescas'],
  ['pomelo', 'Frutas frescas'],
  ['mandarina', 'Frutas frescas'],
  ['frambuesa', 'Frutas frescas'],
  ['arándano', 'Frutas frescas'],
  ['arandano', 'Frutas frescas'],
  ['moras', 'Frutas frescas'],
  ['higo', 'Frutas frescas'],
  ['zumo', 'Bebidas'],
  ['batido de frutas', 'Bebidas'],

  // ── Frutas deshidratadas ──
  ['pasas', 'Frutas deshidratadas'],
  ['orejón', 'Frutas deshidratadas'],
  ['orejon', 'Frutas deshidratadas'],
  ['ciruela pasa', 'Frutas deshidratadas'],
  ['higo seco', 'Frutas deshidratadas'],
  ['dátil', 'Frutas deshidratadas'],
  ['datil', 'Frutas deshidratadas'],
  ['coco seco', 'Frutas deshidratadas'],
  ['coco rallado', 'Frutas deshidratadas'],

  // ── Verduras y hortalizas ──
  ['lechuga', 'Verduras y hortalizas'],
  ['tomate', 'Verduras y hortalizas'],
  ['cebolla', 'Verduras y hortalizas'],
  ['pimiento', 'Verduras y hortalizas'],
  ['calabacín', 'Verduras y hortalizas'],
  ['calabacin', 'Verduras y hortalizas'],
  ['brócoli', 'Verduras y hortalizas'],
  ['brocoli', 'Verduras y hortalizas'],
  ['coliflor', 'Verduras y hortalizas'],
  ['espinaca', 'Verduras y hortalizas'],
  ['acelga', 'Verduras y hortalizas'],
  ['zanahoria', 'Verduras y hortalizas'],
  ['berenjena', 'Verduras y hortalizas'],
  ['pepino', 'Verduras y hortalizas'],
  ['calabaza', 'Verduras y hortalizas'],
  ['cardo', 'Verduras y hortalizas'],
  ['apio', 'Verduras y hortalizas'],
  ['puerro', 'Verduras y hortalizas'],
  ['espárrago', 'Verduras y hortalizas'],
  ['esparrago', 'Verduras y hortalizas'],
  ['remolacha', 'Verduras y hortalizas'],
  ['rábano', 'Verduras y hortalizas'],
  ['rabano', 'Verduras y hortalizas'],
  ['alcachofa', 'Verduras y hortalizas'],
  ['seta', 'Verduras y hortalizas'],
  ['champiñón', 'Verduras y hortalizas'],
  ['champinon', 'Verduras y hortalizas'],
  ['berro', 'Verduras y hortalizas'],
  ['canónigo', 'Verduras y hortalizas'],
  ['canonigo', 'Verduras y hortalizas'],
  ['rúcula', 'Verduras y hortalizas'],
  ['rucula', 'Verduras y hortalizas'],

  // ── Patatas y tubérculos ──
  ['patata', 'Patatas y tubérculos'],
  ['papa', 'Patatas y tubérculos'],
  ['boniato', 'Patatas y tubérculos'],
  ['batata', 'Patatas y tubérculos'],
  ['yuca', 'Patatas y tubérculos'],
  ['tapioca', 'Patatas y tubérculos'],

  // ── Frutos secos y semillas ──
  ['almendra', 'Frutos secos y semillas'],
  ['nuez', 'Frutos secos y semillas'],
  ['avellana', 'Frutos secos y semillas'],
  ['cacahuete', 'Frutos secos y semillas'],
  ['pistacho', 'Frutos secos y semillas'],
  ['anacardo', 'Frutos secos y semillas'],
  ['pipas', 'Frutos secos y semillas'],
  ['semilla', 'Frutos secos y semillas'],
  ['chía', 'Frutos secos y semillas'],
  ['chia', 'Frutos secos y semillas'],
  ['lino', 'Frutos secos y semillas'],
  ['sésamo', 'Frutos secos y semillas'],
  ['sesamo', 'Frutos secos y semillas'],

  // ── Aceites y grasas ──
  ['aceite de oliva virgen extra', 'Aceites y grasas'],
  ['aceite de oliva', 'Aceites y grasas'],
  ['aceite de girasol', 'Aceites y grasas'],
  ['aceite', 'Aceites y grasas'],
  ['mahonesa', 'Salsas y condimentos'],
  ['mayonesa', 'Salsas y condimentos'],
  ['mostaza', 'Salsas y condimentos'],
  ['ketchup', 'Salsas y condimentos'],
  ['vinagre', 'Salsas y condimentos'],
  ['soja salsa', 'Salsas y condimentos'],

  // ── Dulces y bollería ──
  ['chocolate', 'Dulces y bollería'],
  ['azúcar', 'Dulces y bollería'],
  ['azucar', 'Dulces y bollería'],
  ['miel', 'Dulces y bollería'],
  ['mermelada', 'Dulces y bollería'],
  ['crema de cacao', 'Dulces y bollería'],
  ['croissant', 'Dulces y bollería'],

  // ── Bebidas ──
  ['agua', 'Bebidas'],
  ['refresco', 'Bebidas'],
  ['cola', 'Bebidas'],
  ['cerveza', 'Bebidas'],
  ['vino', 'Bebidas'],

  // ── Platos preparados ──
  ['pizza', 'Platos preparados'],
  ['lasaña', 'Platos preparados'],
  ['canelón', 'Platos preparados'],
  ['canelon', 'Platos preparados'],
  ['croqueta', 'Platos preparados'],
  ['empanadilla', 'Platos preparados'],
  ['sopa', 'Platos preparados'],
  ['crema de verduras', 'Platos preparados'],
  ['puré', 'Platos preparados'],
  ['pure', 'Platos preparados'],
]

/**
 * Clasifica un alimento en una categoría nutricional basándose en
 * palabras clave en su nombre.
 *
 * @param nombreNormalizado - Nombre del alimento ya normalizado (sin marcas, cantidades, etc.)
 * @returns Categoría nutricional o null si no se encuentra ninguna coincidencia
 */
export function categorizarAlimento(nombreNormalizado: string): string | null {
  const lower = nombreNormalizado.toLowerCase().trim()

  for (const [keyword, categoria] of CATEGORIAS_POR_KEYWORD) {
    // Buscar como palabra completa con word boundaries
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (regex.test(lower)) {
      return categoria
    }
  }

  return null
}
