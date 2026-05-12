'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LogIn, Sparkles } from 'lucide-react'

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

    await new Promise(r => setTimeout(r, 100))
    window.location.href = '/'
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 pb-nav-safe"
      style={{
        background: 'var(--bg)',
      }}
    >
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo — premium con glow graphite */}
        <div className="text-center mb-6 sm:mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mb-3 sm:mb-4 text-xl sm:text-2xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              color: '#1C1C1E',
              boxShadow: '0 0 30px var(--accent-glow)',
            }}
          >
            CN
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            Casanova Nutrition
          </h1>
          <p className="mt-1 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            Tu plataforma de coaching nutricional
          </p>
        </div>

        {/* Card de login — glass premium */}
        <div className="card-glass">
          <div className="flex items-center gap-2 mb-5 sm:mb-6">
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--text)' }}>
              Iniciar sesión
            </h2>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4 sm:gap-5">
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
              <div
                className="p-3 rounded-xl flex items-center gap-2 text-sm"
                style={{
                  background: 'var(--error-bg)',
                  border: '1px solid rgba(255, 69, 58, 0.2)',
                  color: 'var(--error)',
                }}
              >
                <span>•</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg justify-center w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-[#1C1C1E] border-t-transparent animate-spin" />
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

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            ¿No tienes cuenta? Pide acceso a tu coach.
          </p>
        </div>
      </div>
    </div>
  )
}
