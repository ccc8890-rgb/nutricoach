import { redirect } from 'next/navigation'

// La revisión de fotos vive ahora dentro de la cola única «Por revisar» (filtro Foto)
export default function RecetasImagenesPage() {
  redirect('/recetas/revisar?tarea=foto')
}
