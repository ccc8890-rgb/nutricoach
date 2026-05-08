'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Estado = 'cargando' | 'token_invalido' | 'formulario' | 'magic_enviado' | 'exito' | 'error'

export default function RegistroPage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const token = params.token as string

  const [estado, setEstado] = useState<Estado>('cargando')
  const [motivo, setMotivo] = useState<string>('')
  const [emailInvitacion, setEmailInvitacion] = useState<string>('')
  const [mostrarPassword, setMostrarPassword] = useState(false)

  // Magic link
  const [emailMagic, setEmailMagic] = useState('')
  const [enviandoMagic, setEnviandoMagic] = useState(false)
  const [errorMagic, setErrorMagic] = useState('')

  // Contraseña (fallback)
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) setErrorMsg(decodeURIComponent(urlError))

    async function verificarToken() {
      try {
        const res = await fetch(`/api/invitaciones/${token}`)
        const data = await res.json()
        if (data.valido) {
          setEmailInvitacion(data.email ?? '')
          setEmail(data.email ?? '')
          setEmailMagic(data.email ?? '')
          setEstado('formulario')
        } else {
          setMotivo(data.motivo ?? 'desconocido')
          setEstado('token_invalido')
        }
      } catch {
        setMotivo('error_verificacion')
        setEstado('token_invalido')
      }
    }
    verificarToken()
  }, [token, searchParams])

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?invtoken=${token}`,
      },
    })
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setErrorMagic('')
    setEnviandoMagic(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: emailMagic,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?invtoken=${token}`,
      },
    })
    setEnviandoMagic(false)
    if (error) {
      setErrorMagic(error.message)
    } else {
      setEstado('magic_enviado')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (password !== confirmarPassword) {
      setErrorMsg('Las contraseñas no coinciden')
      return
    }

    setEnviando(true)
    try {
      const res = await fetch('/api/registro-invitacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nombre, apellidos, email, password }),
      })
      const data = await res.json()
      if (data.ok) {
        setEstado('exito')
      } else {
        setErrorMsg(data.error ?? 'Error al procesar el registro')
      }
    } catch {
      setErrorMsg('Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  if (estado === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  if (estado === 'token_invalido') {
    const mensajes: Record<string, string> = {
      no_encontrado: 'El enlace de registro no es válido.',
      usado: 'Este enlace ya ha sido utilizado.',
      expirado: 'El enlace ha expirado. Solicita uno nuevo a tu coach.',
      error_verificacion: 'Error al verificar el enlace.',
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="card max-w-md w-full text-center p-8">
          <XCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <h2 className="text-xl font-bold mb-2">Enlace inválido</h2>
          <p className="text-gray-500">{mensajes[motivo] ?? 'Error desconocido'}</p>
        </div>
      </div>
    )
  }

  if (estado === 'magic_enviado') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="card max-w-md w-full text-center p-8">
          <Mail size={48} className="mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <h2 className="text-xl font-bold mb-2">Revisa tu email</h2>
          <p className="text-gray-500">Te hemos enviado un enlace de acceso a <strong>{emailMagic}</strong>. Haz clic en él para entrar.</p>
        </div>
      </div>
    )
  }

  if (estado === 'exito') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="card max-w-md w-full text-center p-8">
          <CheckCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <h2 className="text-xl font-bold mb-2">Bienvenido/a</h2>
          <p className="text-gray-500">Tu portal está listo. Tu coach te enviará el enlace de acceso.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="card max-w-md w-full p-8">
        <h2 className="text-xl font-bold mb-2 text-center">Crear tu cuenta</h2>
        {emailInvitacion && (
          <p className="text-sm text-center mb-6" style={{ color: 'var(--text-secondary)' }}>
            Tu coach te ha invitado como cliente
          </p>
        )}

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

        {/* Separador */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>o</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Magic link */}
        <form onSubmit={handleMagicLink} className="mb-4">
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Acceder sin contraseña</p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              type="email"
              placeholder="tu@email.com"
              value={emailMagic}
              onChange={e => setEmailMagic(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary px-4" disabled={enviandoMagic}>
              {enviandoMagic ? <Loader2 className="animate-spin" size={16} /> : 'Enviar enlace'}
            </button>
          </div>
          {errorMagic && <p className="text-sm mt-1" style={{ color: 'var(--primary)' }}>{errorMagic}</p>}
        </form>

        {/* Separador contraseña */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <button
            type="button"
            className="text-xs underline"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setMostrarPassword(!mostrarPassword)}
          >
            {mostrarPassword ? 'Ocultar' : 'Crear cuenta con contraseña'}
          </button>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Formulario contraseña (colapsable) */}
        {mostrarPassword && (
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input className="input w-full" value={nombre} onChange={e => setNombre(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Apellidos</label>
              <input className="input w-full" value={apellidos} onChange={e => setApellidos(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input className="input w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña *</label>
              <input className="input w-full" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirmar contraseña *</label>
              <input className="input w-full" type="password" value={confirmarPassword} onChange={e => setConfirmarPassword(e.target.value)} required minLength={6} />
            </div>
            {errorMsg && <p className="text-sm" style={{ color: 'var(--primary)' }}>{errorMsg}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin inline mr-2" size={16} /> : null}
              Registrarse
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
