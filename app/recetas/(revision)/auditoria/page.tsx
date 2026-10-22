import { redirect } from 'next/navigation'

// Los problemas de ingredientes se revisan en la cola única «Por revisar» (filtro Ingredientes o calidad)
export default function RecetasAuditoriaPage() {
  redirect('/recetas/revisar?tarea=bloqueos')
}
