import { redirect } from 'next/navigation'

// Ruta heredada del portal antiguo por código. El portal real es /cliente:
// aquí solo se reenvía (sin sesión, /cliente manda al login).
export default function ClienteCodigoLegacy() {
  redirect('/cliente')
}
