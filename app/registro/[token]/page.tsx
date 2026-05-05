'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

type Estado = 'cargando' | 'token_invalido' | 'formulario' | 'exito' | 'error'

export default function RegistroPage() {
  const params = useParams()
  const token = params.token as string

  const [estado, setEstado] = useState<Estado>('cargando')
  const [motivo, setMotivo] = useState<string>('')
  const [emailInvitacion, setEmailInvitacion] = useState<string>('')
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function verificarToken() {
      try {
        const res = await fetch(`/api/invitaciones/${token}`)
        const data = await res.json()
        if (data.valido) {
          setEmailInvitacion(data.email ?? '')
          setEmail(data.email ?? '')
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
  }, [token])

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

  if (estado === 'exito') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="card max-w-md w-full text-center p-8">
          <CheckCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <h2 className="text-xl font-bold mb-2">Registro completado</h2>
          <p className="text-gray-500">
            Tu coach te enviará el enlace de acceso a tu portal.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="card max-w-md w-full p-8">
        <h2 className="text-xl font-bold mb-6 text-center">Crear cuenta</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              className="input w-full"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Apellidos</label>
            <input
              className="input w-full"
              value={apellidos}
              onChange={e => setApellidos(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              className="input w-full"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña *</label>
            <input
              className="input w-full"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirmar contraseña *</label>
            <input
              className="input w-full"
              type="password"
              value={confirmarPassword}
              onChange={e => setConfirmarPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {errorMsg && (
            <p className="text-sm" style={{ color: 'var(--primary)' }}>{errorMsg}</p>
          )}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={enviando}
          >
            {enviando ? <Loader2 className="animate-spin inline mr-2" size={16} /> : null}
            Registrarse
          </button>
        </form>
      </div>
    </div>
  )
}
