import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'

export default async function HomePage() {
  let user = null
  let role = null

  try {
    const supabase = await createServerSupabase()
    const { data: { user: u } } = await supabase.auth.getUser()
    user = u

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      role = profile?.role
    }
  } catch {
    // Sin sesión → landing
  }

  // Si hay sesión válida, redirigir
  if (user && role === 'coach') {
    return (
      <html>
        <head><meta httpEquiv="refresh" content={`0;url=/dashboard`} /></head>
        <body><p>Redirigiendo...</p></body>
      </html>
    )
  }
  if (user && role === 'cliente') {
    return (
      <html>
        <head><meta httpEquiv="refresh" content={`0;url=/cliente`} /></head>
        <body><p>Redirigiendo...</p></body>
      </html>
    )
  }

  // Sin sesión → landing estática
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #F2F2F7 0%, #E5E5EA 50%, #F8FAFC 100%)' }}>
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 text-2xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #1C1C1E, #3A3A3C)' }}>
          CN
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Casanova Nutrition</h1>
        <p className="text-gray-500 mb-8">Plataforma profesional de coaching nutricional</p>
        <Link href="/login" className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #1C1C1E, #3A3A3C)' }}>
          Iniciar sesión
        </Link>
      </div>
    </div>
  )
}
