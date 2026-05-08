'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LogIn } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Sincronizar sesión con cookies para que el servidor pueda leerla
    // IMPORTANTE: esperamos a que el callback termine antes de redirigir
    // Antes: fetch() sin await → se redirigía antes de escribir las cookies
    try {
      const session = data.session
      if (session) {
        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        })

        if (!res.ok) {
          const errData = await res.json()
          console.error('Error en callback de auth:', errData)
          setError('Error al sincronizar sesión. Intenta de nuevo.')
          setLoading(false)
          return
        }
      }
    } catch (e) {
      console.error('Error al sincronizar sesión:', e)
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
      return
    }

    // Esperar un momento para que las cookies se propaguen
    await new Promise(r => setTimeout(r, 100))

    // Redirigir — la landing page (Server Component) leerá las cookies
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #F2F2F7 0%, #E5E5EA 50%, #F8FAFC 100%)' }}>
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1C1C1E, #3A3A3C)', boxShadow: '0 4px 12px rgba(13,148,136,0.3)' }}
          >
            CN
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Casanova Nutrition</h1>
          <p className="text-gray-500 mt-1.5">Tu plataforma de coaching nutricional</p>
        </div>

        {/* Card de login */}
        <div className="card shadow-lg border-t-4" style={{ borderTopColor: '#1C1C1E' }}>
          <h2 className="text-lg font-bold text-gray-900 mb-6">Iniciar sesión</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                <span>•</span> {error}
              </div>
            )}

            <button type="submit" className="btn-primary justify-center btn-lg" disabled={loading}>
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Entrando…
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Entrar
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            ¿No tienes cuenta? Pide acceso a tu coach.
          </p>
        </div>
      </div>
    </div>
  )
}
