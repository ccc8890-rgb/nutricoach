'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LogIn, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    setLoadingGoogle(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoadingGoogle(false)
  }

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
              color: '#ffffff',
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

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loadingGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors mb-5"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {loadingGoogle ? 'Redirigiendo…' : 'Continuar con Google'}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>o con email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
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
