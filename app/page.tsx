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

  // Sin sesión → landing estática aesthetic
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pb-nav-safe"
      style={{
        background: 'linear-gradient(160deg, #F7F7F9 0%, #EDEDF0 50%, #F2F2F4 100%)',
      }}>
      <div className="w-full max-w-md text-center animate-fade-in px-4">
        {/* Logo con sombra aesthetic */}
        <div className="relative inline-flex mb-4 sm:mb-5">
          <div
            className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl text-xl sm:text-2xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #2C2C2E, #3A3A3C)',
              color: '#FFFFFF',
              boxShadow: '0 4px 16px rgba(44, 44, 46, 0.15)',
            }}>
            CN
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2"
          style={{ color: 'var(--text)' }}>
          Casanova Nutrition
        </h1>
        <p className="mb-6 sm:mb-8 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
          Plataforma profesional de coaching nutricional
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 min-h-[44px]"
          style={{
            background: 'linear-gradient(135deg, #2C2C2E, #3A3A3C)',
            color: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(44, 44, 46, 0.2)',
          }}>
          Iniciar sesión
        </Link>
      </div>
    </div>
  )
}
