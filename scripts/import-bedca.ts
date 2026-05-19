import { supabase } from '@/lib/supabase'

/**
 * Datos de referencia con valores nutricionales estilo BEDCA
 * 
 * NOTA: Esto NO es una importación real de la API de BEDCA
 * (https://www.bedca.net). Es un conjunto de datos de referencia
 * con nomenclatura y valores consistentes con la base de datos curada.
 * 
 * Para una integración real con la API de BEDCA, habría que:
 * 1. Consultar https://www.bedca.net/bdpub/api.php
 * 2. Parsear los resultados XML/JSON
 * 3. Mapear a nuestra estructura de tabla
 * 
 * Por ahora, estos datos complementan el seed principal (foods-data.ts)
 * con algunos alimentos adicionales de referencia.
 */

// Solo alimentos que NO están en foods-data.ts para evitar duplicados
const alimentos = [
  // Carnes (adicionales)
  { nombre: 'Cordero (pierna)', categoria: 'Carnes', calorias: 294, proteinas: 25, carbohidratos: 0, grasas: 21, fibra: 0 },
  // Pescados (adicionales)
  { nombre: 'Atún en lata en aceite', categoria: 'Pescados', calorias: 198, proteinas: 29, carbohidratos: 0, grasas: 8, fibra: 0 },
  // Lácteos (adicionales)
  { nombre: 'Mantequilla', categoria: 'Grasas', calorias: 717, proteinas: 0.9, carbohidratos: 0.1, grasas: 81, fibra: 0 },
  // Cereales (adicionales)
  { nombre: 'Cereales de desayuno (corn flakes)', categoria: 'Cereales', calorias: 357, proteinas: 7, carbohidratos: 84, grasas: 0.4, fibra: 1.5 },
]

export async function importBedca() {
  try {
    // Verificar qué alimentos de BEDCA ya existen en la BD
    // Traemos todos los nombres y comparamos case-insensitive en JS
    // (es más fiable que .in() que es case-sensitive en Postgres)
    const { data: todosNombres } = await supabase
      .from('alimentos')
      .select('nombre')

    const nombresExistentes = new Set(
      (todosNombres ?? []).map(a => a.nombre.trim().toLowerCase())
    )

    const aInsertar = alimentos.filter(
      a => !nombresExistentes.has(a.nombre.trim().toLowerCase())
    )

    if (aInsertar.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'Todos los alimentos BEDCA ya existen en la BD'
      }
    }

    const { data, error } = await supabase
      .from('alimentos')
      .insert(aInsertar.map(a => ({
        ...a,
        fuente: 'bedca',
        custom: false
      })))
      .select('id')

    if (error) throw error

    return {
      success: true,
      count: aInsertar.length,
      insertados: aInsertar.map(a => a.nombre),
      ignorados: alimentos.length - aInsertar.length,
    }
  } catch (error: any) {
    console.error('Error importing BEDCA:', error)
    throw error
  }
}
