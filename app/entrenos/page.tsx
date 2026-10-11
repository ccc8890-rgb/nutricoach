import { redirect } from 'next/navigation'

// El «Resumen» de Entrenamiento (lista de clientes) se quitó el 11-10-2026: ya está en Clientes → ficha → Entrenamiento
export default function EntrenosPage() {
  redirect('/entrenos/plantillas')
}
