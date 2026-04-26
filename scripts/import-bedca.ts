import { supabase } from '@/lib/supabase'

const alimentos = [
  // Carnes
  { nombre: 'Pollo (pechuga)', calorias: 165, proteinas: 31, carbohidratos: 0, grasas: 3.6 },
  { nombre: 'Ternera (lomo)', calorias: 250, proteinas: 26, carbohidratos: 0, grasas: 15 },
  { nombre: 'Cerdo (lomo)', calorias: 242, proteinas: 27, carbohidratos: 0, grasas: 14 },
  { nombre: 'Cordero (pierna)', calorias: 294, proteinas: 25, carbohidratos: 0, grasas: 21 },
  { nombre: 'Jamón serrano', calorias: 241, proteinas: 30, carbohidratos: 0, grasas: 13 },
  // Pescados
  { nombre: 'Merluza', calorias: 82, proteinas: 18, carbohidratos: 0, grasas: 0.7 },
  { nombre: 'Salmón', calorias: 208, proteinas: 20, carbohidratos: 0, grasas: 13 },
  { nombre: 'Atún (en aceite)', calorias: 198, proteinas: 29, carbohidratos: 0, grasas: 8 },
  { nombre: 'Bacalao', calorias: 82, proteinas: 18, carbohidratos: 0, grasas: 0.7 },
  { nombre: 'Gambas', calorias: 99, proteinas: 24, carbohidratos: 0, grasas: 0.3 },
  // Verduras
  { nombre: 'Tomate', calorias: 18, proteinas: 0.9, carbohidratos: 3.9, grasas: 0.2 },
  { nombre: 'Lechuga', calorias: 15, proteinas: 1.4, carbohidratos: 2.9, grasas: 0.2 },
  { nombre: 'Espinacas', calorias: 23, proteinas: 2.9, carbohidratos: 3.6, grasas: 0.4 },
  { nombre: 'Zanahoria', calorias: 41, proteinas: 0.9, carbohidratos: 9.6, grasas: 0.2 },
  { nombre: 'Pimiento rojo', calorias: 31, proteinas: 1, carbohidratos: 6, grasas: 0.3 },
  { nombre: 'Brócoli', calorias: 34, proteinas: 2.8, carbohidratos: 7, grasas: 0.4 },
  // Frutas
  { nombre: 'Manzana', calorias: 52, proteinas: 0.3, carbohidratos: 14, grasas: 0.2 },
  { nombre: 'Plátano', calorias: 89, proteinas: 1.1, carbohidratos: 23, grasas: 0.3 },
  { nombre: 'Naranja', calorias: 47, proteinas: 0.9, carbohidratos: 12, grasas: 0.1 },
  { nombre: 'Uvas', calorias: 69, proteinas: 0.7, carbohidratos: 18, grasas: 0.2 },
  { nombre: 'Fresas', calorias: 32, proteinas: 0.7, carbohidratos: 8, grasas: 0.3 },
  // Lácteos
  { nombre: 'Leche entera', calorias: 61, proteinas: 3.2, carbohidratos: 4.8, grasas: 3.3 },
  { nombre: 'Yogur natural', calorias: 61, proteinas: 3.5, carbohidratos: 4.7, grasas: 3.3 },
  { nombre: 'Queso manchego', calorias: 376, proteinas: 25, carbohidratos: 0, grasas: 30 },
  { nombre: 'Mantequilla', calorias: 717, proteinas: 0.9, carbohidratos: 0.1, grasas: 81 },
  // Cereales
  { nombre: 'Pan blanco', calorias: 265, proteinas: 9, carbohidratos: 49, grasas: 3.2 },
  { nombre: 'Arroz blanco', calorias: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3 },
  { nombre: 'Pasta (spaghetti)', calorias: 131, proteinas: 5, carbohidratos: 25, grasas: 1.1 },
  { nombre: 'Avena (copos)', calorias: 389, proteinas: 16.9, carbohidratos: 66, grasas: 6.9 },
  { nombre: 'Cereales de desayuno (corn flakes)', calorias: 357, proteinas: 7, carbohidratos: 84, grasas: 0.4 },
]

export async function importBedca() {
  try {
    const { data, error } = await supabase.from('alimentos').insert(
      alimentos.map(a => ({ ...a, fibra: 0 }))
    )
    if (error) throw error
    return { success: true, count: alimentos.length }
  } catch (error: any) {
    console.error('Error importing BEDCA:', error)
    throw error
  }
}
