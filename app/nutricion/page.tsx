import { redirect } from 'next/navigation'

// «Resumen» de Nutrición se quitó del menú (11-10-2026): todo está ya en el menú lateral
export default function NutricionPage() {
  redirect('/dietas/plantillas')
}
