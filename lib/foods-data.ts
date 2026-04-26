// Base de datos de alimentos curada para dietas fit/mediterráneas
// Valores nutricionales por 100g

export interface AlimentoSeed {
  nombre: string
  categoria: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  fibra: number
}

export const ALIMENTOS_SEED: AlimentoSeed[] = [
  // ── PROTEÍNAS ANIMALES ──────────────────────────────────
  { nombre: "Pechuga de pollo (cruda)", categoria: "Carnes", calorias: 110, proteinas: 23.2, carbohidratos: 0, grasas: 1.9, fibra: 0 },
  { nombre: "Pechuga de pollo (cocinada)", categoria: "Carnes", calorias: 165, proteinas: 31, carbohidratos: 0, grasas: 3.6, fibra: 0 },
  { nombre: "Muslo de pollo sin piel", categoria: "Carnes", calorias: 177, proteinas: 24.8, carbohidratos: 0, grasas: 8.2, fibra: 0 },
  { nombre: "Pavo pechuga (cruda)", categoria: "Carnes", calorias: 104, proteinas: 22, carbohidratos: 0, grasas: 1.7, fibra: 0 },
  { nombre: "Ternera magra (solomillo)", categoria: "Carnes", calorias: 143, proteinas: 21.4, carbohidratos: 0, grasas: 6.1, fibra: 0 },
  { nombre: "Ternera picada (5% grasa)", categoria: "Carnes", calorias: 137, proteinas: 21.4, carbohidratos: 0, grasas: 5.5, fibra: 0 },
  { nombre: "Lomo de cerdo", categoria: "Carnes", calorias: 182, proteinas: 20.9, carbohidratos: 0, grasas: 10.7, fibra: 0 },
  { nombre: "Jamón serrano", categoria: "Carnes", calorias: 241, proteinas: 30.5, carbohidratos: 0.3, grasas: 13, fibra: 0 },
  { nombre: "Fiambre de pavo", categoria: "Carnes", calorias: 96, proteinas: 18.4, carbohidratos: 1.2, grasas: 1.7, fibra: 0 },
  { nombre: "Salmón (fresco)", categoria: "Pescados", calorias: 208, proteinas: 20.4, carbohidratos: 0, grasas: 13.4, fibra: 0 },
  { nombre: "Atún (fresco)", categoria: "Pescados", calorias: 144, proteinas: 23.3, carbohidratos: 0, grasas: 5.1, fibra: 0 },
  { nombre: "Atún en lata al natural", categoria: "Pescados", calorias: 103, proteinas: 23.5, carbohidratos: 0, grasas: 0.7, fibra: 0 },
  { nombre: "Atún en lata en aceite", categoria: "Pescados", calorias: 198, proteinas: 21.5, carbohidratos: 0, grasas: 12.1, fibra: 0 },
  { nombre: "Merluza", categoria: "Pescados", calorias: 74, proteinas: 17.4, carbohidratos: 0, grasas: 0.6, fibra: 0 },
  { nombre: "Bacalao (fresco)", categoria: "Pescados", calorias: 82, proteinas: 18, carbohidratos: 0, grasas: 0.7, fibra: 0 },
  { nombre: "Dorada", categoria: "Pescados", calorias: 96, proteinas: 19.4, carbohidratos: 0.6, grasas: 1.8, fibra: 0 },
  { nombre: "Lubina", categoria: "Pescados", calorias: 97, proteinas: 18.4, carbohidratos: 0, grasas: 2.5, fibra: 0 },
  { nombre: "Sardina (fresca)", categoria: "Pescados", calorias: 208, proteinas: 19.8, carbohidratos: 0, grasas: 13.9, fibra: 0 },
  { nombre: "Gambas", categoria: "Pescados", calorias: 85, proteinas: 18.9, carbohidratos: 0.2, grasas: 0.6, fibra: 0 },
  { nombre: "Calamar", categoria: "Pescados", calorias: 92, proteinas: 15.6, carbohidratos: 3.1, grasas: 1.4, fibra: 0 },
  { nombre: "Huevo entero (L)", categoria: "Huevos", calorias: 155, proteinas: 13, carbohidratos: 1.1, grasas: 10.6, fibra: 0 },
  { nombre: "Clara de huevo", categoria: "Huevos", calorias: 52, proteinas: 10.9, carbohidratos: 0.7, grasas: 0.2, fibra: 0 },
  { nombre: "Yema de huevo", categoria: "Huevos", calorias: 339, proteinas: 15.9, carbohidratos: 3.6, grasas: 26.5, fibra: 0 },

  // ── LÁCTEOS ──────────────────────────────────────────────
  { nombre: "Queso cottage", categoria: "Lácteos", calorias: 98, proteinas: 11.1, carbohidratos: 3.4, grasas: 4.3, fibra: 0 },
  { nombre: "Queso fresco batido 0%", categoria: "Lácteos", calorias: 49, proteinas: 8, carbohidratos: 3.5, grasas: 0.2, fibra: 0 },
  { nombre: "Queso mozzarella", categoria: "Lácteos", calorias: 280, proteinas: 22.2, carbohidratos: 2.2, grasas: 20.3, fibra: 0 },
  { nombre: "Queso parmesano", categoria: "Lácteos", calorias: 431, proteinas: 38.5, carbohidratos: 3.2, grasas: 28.8, fibra: 0 },
  { nombre: "Queso manchego curado", categoria: "Lácteos", calorias: 467, proteinas: 31.5, carbohidratos: 0.5, grasas: 38, fibra: 0 },
  { nombre: "Yogur griego natural (0%)", categoria: "Lácteos", calorias: 57, proteinas: 9.9, carbohidratos: 4, grasas: 0.2, fibra: 0 },
  { nombre: "Yogur griego natural (entero)", categoria: "Lácteos", calorias: 115, proteinas: 7, carbohidratos: 4, grasas: 8, fibra: 0 },
  { nombre: "Yogur natural desnatado", categoria: "Lácteos", calorias: 36, proteinas: 3.5, carbohidratos: 5, grasas: 0.2, fibra: 0 },
  { nombre: "Leche entera", categoria: "Lácteos", calorias: 61, proteinas: 3.2, carbohidratos: 4.8, grasas: 3.5, fibra: 0 },
  { nombre: "Leche desnatada", categoria: "Lácteos", calorias: 33, proteinas: 3.4, carbohidratos: 4.9, grasas: 0.1, fibra: 0 },
  { nombre: "Proteína whey (polvo)", categoria: "Suplementos", calorias: 375, proteinas: 75, carbohidratos: 7, grasas: 4, fibra: 0 },
  { nombre: "Proteína caseína (polvo)", categoria: "Suplementos", calorias: 360, proteinas: 78, carbohidratos: 4, grasas: 2, fibra: 0 },

  // ── CARBOHIDRATOS / CEREALES ─────────────────────────────
  { nombre: "Arroz blanco (crudo)", categoria: "Cereales", calorias: 362, proteinas: 6.7, carbohidratos: 79.3, grasas: 0.7, fibra: 0.4 },
  { nombre: "Arroz integral (crudo)", categoria: "Cereales", calorias: 350, proteinas: 7.5, carbohidratos: 73, grasas: 2.7, fibra: 3.5 },
  { nombre: "Arroz blanco (cocinado)", categoria: "Cereales", calorias: 130, proteinas: 2.4, carbohidratos: 28.6, grasas: 0.2, fibra: 0.2 },
  { nombre: "Pasta (seca)", categoria: "Cereales", calorias: 358, proteinas: 12.5, carbohidratos: 70.5, grasas: 1.8, fibra: 2.5 },
  { nombre: "Pasta integral (seca)", categoria: "Cereales", calorias: 348, proteinas: 12, carbohidratos: 68, grasas: 2.5, fibra: 6.3 },
  { nombre: "Pasta (cocinada)", categoria: "Cereales", calorias: 131, proteinas: 5, carbohidratos: 25, grasas: 1.1, fibra: 1.8 },
  { nombre: "Avena (copos)", categoria: "Cereales", calorias: 389, proteinas: 17, carbohidratos: 66, grasas: 7, fibra: 10.6 },
  { nombre: "Pan integral", categoria: "Cereales", calorias: 247, proteinas: 10, carbohidratos: 44, grasas: 3.3, fibra: 7 },
  { nombre: "Pan blanco", categoria: "Cereales", calorias: 265, proteinas: 9, carbohidratos: 49, grasas: 3.2, fibra: 2.7 },
  { nombre: "Pan de centeno", categoria: "Cereales", calorias: 259, proteinas: 8.5, carbohidratos: 48, grasas: 3.3, fibra: 7.5 },
  { nombre: "Patata (cruda)", categoria: "Tubérculos", calorias: 77, proteinas: 2, carbohidratos: 17, grasas: 0.1, fibra: 2.2 },
  { nombre: "Patata cocida", categoria: "Tubérculos", calorias: 87, proteinas: 1.9, carbohidratos: 20, grasas: 0.1, fibra: 1.8 },
  { nombre: "Boniato (crudo)", categoria: "Tubérculos", calorias: 86, proteinas: 1.6, carbohidratos: 20.1, grasas: 0.1, fibra: 3 },
  { nombre: "Quinoa (cocida)", categoria: "Cereales", calorias: 120, proteinas: 4.4, carbohidratos: 21.3, grasas: 1.9, fibra: 2.8 },
  { nombre: "Maíz (grano, cocido)", categoria: "Cereales", calorias: 96, proteinas: 3.4, carbohidratos: 19.6, grasas: 1.5, fibra: 2.4 },

  // ── LEGUMBRES ────────────────────────────────────────────
  { nombre: "Garbanzos (cocidos)", categoria: "Legumbres", calorias: 164, proteinas: 8.9, carbohidratos: 27.4, grasas: 2.6, fibra: 7.6 },
  { nombre: "Lentejas (cocidas)", categoria: "Legumbres", calorias: 116, proteinas: 9, carbohidratos: 20.1, grasas: 0.4, fibra: 7.9 },
  { nombre: "Judías blancas (cocidas)", categoria: "Legumbres", calorias: 139, proteinas: 9.7, carbohidratos: 25, grasas: 0.5, fibra: 6.3 },
  { nombre: "Edamame (cocido)", categoria: "Legumbres", calorias: 121, proteinas: 11.9, carbohidratos: 8.9, grasas: 5.2, fibra: 5.2 },
  { nombre: "Tofu firme", categoria: "Legumbres", calorias: 83, proteinas: 8.2, carbohidratos: 1.9, grasas: 4.8, fibra: 0.3 },

  // ── VERDURAS ─────────────────────────────────────────────
  { nombre: "Espinacas (crudas)", categoria: "Verduras", calorias: 23, proteinas: 2.9, carbohidratos: 3.6, grasas: 0.4, fibra: 2.2 },
  { nombre: "Brócoli (crudo)", categoria: "Verduras", calorias: 34, proteinas: 2.8, carbohidratos: 7, grasas: 0.4, fibra: 2.6 },
  { nombre: "Coliflor (cruda)", categoria: "Verduras", calorias: 25, proteinas: 1.9, carbohidratos: 5, grasas: 0.3, fibra: 2 },
  { nombre: "Lechuga romana", categoria: "Verduras", calorias: 17, proteinas: 1.2, carbohidratos: 3.3, grasas: 0.3, fibra: 2.1 },
  { nombre: "Tomate", categoria: "Verduras", calorias: 18, proteinas: 0.9, carbohidratos: 3.9, grasas: 0.2, fibra: 1.2 },
  { nombre: "Pepino", categoria: "Verduras", calorias: 15, proteinas: 0.7, carbohidratos: 3.6, grasas: 0.1, fibra: 0.5 },
  { nombre: "Pimiento rojo", categoria: "Verduras", calorias: 31, proteinas: 1, carbohidratos: 6, grasas: 0.3, fibra: 2.1 },
  { nombre: "Pimiento verde", categoria: "Verduras", calorias: 20, proteinas: 0.9, carbohidratos: 4.6, grasas: 0.2, fibra: 1.7 },
  { nombre: "Cebolla", categoria: "Verduras", calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7 },
  { nombre: "Ajo", categoria: "Verduras", calorias: 149, proteinas: 6.4, carbohidratos: 33.1, grasas: 0.5, fibra: 2.1 },
  { nombre: "Zanahoria (cruda)", categoria: "Verduras", calorias: 41, proteinas: 0.9, carbohidratos: 9.6, grasas: 0.2, fibra: 2.8 },
  { nombre: "Calabacín (crudo)", categoria: "Verduras", calorias: 17, proteinas: 1.2, carbohidratos: 3.1, grasas: 0.3, fibra: 1 },
  { nombre: "Berenjena", categoria: "Verduras", calorias: 25, proteinas: 1, carbohidratos: 5.9, grasas: 0.2, fibra: 3 },
  { nombre: "Espárragos", categoria: "Verduras", calorias: 20, proteinas: 2.2, carbohidratos: 3.9, grasas: 0.1, fibra: 2.1 },
  { nombre: "Champiñones", categoria: "Verduras", calorias: 22, proteinas: 3.1, carbohidratos: 3.3, grasas: 0.3, fibra: 1 },
  { nombre: "Kale (col rizada)", categoria: "Verduras", calorias: 49, proteinas: 4.3, carbohidratos: 9, grasas: 0.9, fibra: 3.6 },
  { nombre: "Col lombarda", categoria: "Verduras", calorias: 31, proteinas: 1.4, carbohidratos: 7.4, grasas: 0.2, fibra: 2.1 },
  { nombre: "Rúcula", categoria: "Verduras", calorias: 25, proteinas: 2.6, carbohidratos: 3.7, grasas: 0.7, fibra: 1.6 },
  { nombre: "Alcachofa", categoria: "Verduras", calorias: 47, proteinas: 3.3, carbohidratos: 10.5, grasas: 0.2, fibra: 5.4 },
  { nombre: "Maíz dulce (lata)", categoria: "Verduras", calorias: 86, proteinas: 3.2, carbohidratos: 18.7, grasas: 1.2, fibra: 1.8 },

  // ── FRUTAS ───────────────────────────────────────────────
  { nombre: "Plátano", categoria: "Frutas", calorias: 89, proteinas: 1.1, carbohidratos: 22.8, grasas: 0.3, fibra: 2.6 },
  { nombre: "Manzana", categoria: "Frutas", calorias: 52, proteinas: 0.3, carbohidratos: 13.8, grasas: 0.2, fibra: 2.4 },
  { nombre: "Naranja", categoria: "Frutas", calorias: 47, proteinas: 0.9, carbohidratos: 11.8, grasas: 0.1, fibra: 2.4 },
  { nombre: "Fresas", categoria: "Frutas", calorias: 32, proteinas: 0.7, carbohidratos: 7.7, grasas: 0.3, fibra: 2 },
  { nombre: "Arándanos", categoria: "Frutas", calorias: 57, proteinas: 0.7, carbohidratos: 14.5, grasas: 0.3, fibra: 2.4 },
  { nombre: "Kiwi", categoria: "Frutas", calorias: 61, proteinas: 1.1, carbohidratos: 14.7, grasas: 0.5, fibra: 3 },
  { nombre: "Mango", categoria: "Frutas", calorias: 60, proteinas: 0.8, carbohidratos: 15, grasas: 0.4, fibra: 1.6 },
  { nombre: "Sandía", categoria: "Frutas", calorias: 30, proteinas: 0.6, carbohidratos: 7.6, grasas: 0.2, fibra: 0.4 },
  { nombre: "Melón", categoria: "Frutas", calorias: 34, proteinas: 0.8, carbohidratos: 8.2, grasas: 0.2, fibra: 0.9 },
  { nombre: "Pera", categoria: "Frutas", calorias: 57, proteinas: 0.4, carbohidratos: 15.2, grasas: 0.1, fibra: 3.1 },
  { nombre: "Uvas", categoria: "Frutas", calorias: 69, proteinas: 0.7, carbohidratos: 18.1, grasas: 0.2, fibra: 0.9 },
  { nombre: "Cerezas", categoria: "Frutas", calorias: 63, proteinas: 1.1, carbohidratos: 16, grasas: 0.2, fibra: 2.1 },
  { nombre: "Piña", categoria: "Frutas", calorias: 50, proteinas: 0.5, carbohidratos: 13.1, grasas: 0.1, fibra: 1.4 },

  // ── GRASAS SALUDABLES ────────────────────────────────────
  { nombre: "Aguacate", categoria: "Grasas", calorias: 160, proteinas: 2, carbohidratos: 8.5, grasas: 14.7, fibra: 6.7 },
  { nombre: "Aceite de oliva virgen extra", categoria: "Grasas", calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
  { nombre: "Aceite de coco", categoria: "Grasas", calorias: 862, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
  { nombre: "Almendras", categoria: "Frutos secos", calorias: 576, proteinas: 21.2, carbohidratos: 21.7, grasas: 49.4, fibra: 12.5 },
  { nombre: "Nueces", categoria: "Frutos secos", calorias: 654, proteinas: 15.2, carbohidratos: 13.7, grasas: 65.2, fibra: 6.7 },
  { nombre: "Anacardos", categoria: "Frutos secos", calorias: 553, proteinas: 18.2, carbohidratos: 30.2, grasas: 43.8, fibra: 3.3 },
  { nombre: "Mantequilla de cacahuete", categoria: "Grasas", calorias: 588, proteinas: 25.1, carbohidratos: 20, grasas: 50, fibra: 6 },
  { nombre: "Semillas de chía", categoria: "Semillas", calorias: 486, proteinas: 16.5, carbohidratos: 42.1, grasas: 30.7, fibra: 34.4 },
  { nombre: "Semillas de lino", categoria: "Semillas", calorias: 534, proteinas: 18.3, carbohidratos: 28.9, grasas: 42.2, fibra: 27.3 },
  { nombre: "Semillas de girasol", categoria: "Semillas", calorias: 584, proteinas: 20.8, carbohidratos: 20, grasas: 51.5, fibra: 8.6 },

  // ── CONDIMENTOS Y OTROS ──────────────────────────────────
  { nombre: "Sal", categoria: "Condimentos", calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
  { nombre: "Miel", categoria: "Condimentos", calorias: 304, proteinas: 0.3, carbohidratos: 82.4, grasas: 0, fibra: 0.2 },
  { nombre: "Sirope de agave", categoria: "Condimentos", calorias: 310, proteinas: 0.1, carbohidratos: 76.4, grasas: 0.5, fibra: 0.2 },
  { nombre: "Cacao puro en polvo", categoria: "Otros", calorias: 228, proteinas: 19.6, carbohidratos: 57.9, grasas: 13.7, fibra: 33 },
  { nombre: "Chocolate negro 85%", categoria: "Otros", calorias: 598, proteinas: 12.9, carbohidratos: 45.9, grasas: 42.6, fibra: 10.9 },
  { nombre: "Leche de avena", categoria: "Bebidas", calorias: 46, proteinas: 1, carbohidratos: 6.6, grasas: 1.5, fibra: 0.8 },
  { nombre: "Leche de almendras (sin azúcar)", categoria: "Bebidas", calorias: 17, proteinas: 0.6, carbohidratos: 0.3, grasas: 1.4, fibra: 0.4 },
  { nombre: "Leche de soja", categoria: "Bebidas", calorias: 54, proteinas: 3.6, carbohidratos: 6.3, grasas: 1.8, fibra: 0.4 },
]
