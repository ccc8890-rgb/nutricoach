'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEstado('enviando')
    // El enlace vuelve a este navegador: el callback intercambia el código y abre /nueva-contrasena
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/nueva-contrasena`,
    })
    setEstado(error ? 'error' : 'enviado')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Recuperar contraseña</h1>
        {estado === 'enviado' ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Si el email existe, te hemos enviado un enlace. Ábrelo <strong>en este mismo navegador</strong> para elegir una contraseña nueva.
          </p>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Te enviaremos un enlace para crear una contraseña nueva.</p>
            <input type="email" required autoComplete="email" className="input w-full" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            {estado === 'error' && <p className="text-sm" style={{ color: 'var(--error)' }}>No se pudo enviar el enlace. Inténtalo de nuevo en unos minutos.</p>}
            <button type="submit" className="btn btn-primary btn-lg justify-center w-full" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
        <Link href="/login" className="block text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>Volver a iniciar sesión</Link>
      </div>
    </div>
  )
}
