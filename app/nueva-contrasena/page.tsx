'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function NuevaContrasenaPage() {
  const [haySesion, setHaySesion] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHaySesion(!!data.session))
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Mínimo 8 caracteres.')
    if (password !== repetir) return setError('Las contraseñas no coinciden.')
    setGuardando(true)
    const { data, error: err } = await supabase.auth.updateUser({ password })
    if (err || !data.user) { setGuardando(false); return setError('No se pudo guardar. Pide un enlace nuevo.') }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    window.location.replace(profile?.role === 'cliente' ? '/cliente' : '/dashboard')
  }

  if (haySesion === null) return <div className="min-h-screen" style={{ background: 'var(--bg)' }} />

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>Nueva contraseña</h1>
        {!haySesion ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            El enlace ha caducado o se abrió en otro navegador. <Link href="/recuperar-contrasena" className="underline">Pide uno nuevo</Link>.
          </p>
        ) : (
          <form onSubmit={guardar} className="space-y-4">
            <input type="password" required autoComplete="new-password" className="input w-full" placeholder="Contraseña nueva" value={password} onChange={e => setPassword(e.target.value)} />
            <input type="password" required autoComplete="new-password" className="input w-full" placeholder="Repite la contraseña" value={repetir} onChange={e => setRepetir(e.target.value)} />
            {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-lg justify-center w-full" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
