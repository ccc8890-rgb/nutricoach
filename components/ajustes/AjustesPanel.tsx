'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Brain, ClipboardList, LogOut, Moon, ShieldAlert, SlidersHorizontal, Sun } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'

type Perfil = { nombre: string; apellidos: string | null; email: string; telefono: string | null }

const cardStyle = { borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }
const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }
const buttonStyle = { background: 'var(--text)', color: 'var(--bg)' }
const ghostButtonStyle = { borderColor: 'var(--border)', color: 'var(--text)' }

const ACCESOS_METODO = [
  { href: '/coach/metodologia', label: 'Metodología', detail: 'Reglas de trabajo y criterio del coach.', icon: SlidersHorizontal },
  { href: '/conocimiento', label: 'Base de conocimiento', detail: 'Notas, evidencia y aprendizajes.', icon: Brain },
  { href: '/cuestionarios', label: 'Cuestionarios', detail: 'Formularios y respuestas de clientes.', icon: ClipboardList },
]

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>{titulo}</h3>
      {children}
    </section>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{etiqueta}</span>
      {children}
    </label>
  )
}

export default function AjustesPanel() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensajePerfil, setMensajePerfil] = useState<{ ok: boolean; texto: string } | null>(null)

  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [mensajePass, setMensajePass] = useState<{ ok: boolean; texto: string } | null>(null)

  function aplicarPerfil(p: Perfil) {
    setPerfil(p)
    setNombre(p.nombre ?? '')
    setApellidos(p.apellidos ?? '')
    setTelefono(p.telefono ?? '')
  }

  useEffect(() => {
    fetch('/api/ajustes/perfil')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => aplicarPerfil(d.perfil))
      .catch(() => setErrorCarga(true))
  }, [])

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setMensajePerfil(null)
    setGuardando(true)
    try {
      const res = await fetch('/api/ajustes/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellidos, telefono }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setMensajePerfil({ ok: false, texto: data.error ?? 'No se pudo guardar' })
      aplicarPerfil(data.perfil)
      setMensajePerfil({ ok: true, texto: 'Guardado' })
    } catch {
      setMensajePerfil({ ok: false, texto: 'No se pudo guardar' })
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault()
    setMensajePass(null)
    if (password.length < 8) return setMensajePass({ ok: false, texto: 'Mínimo 8 caracteres.' })
    if (password !== repetir) return setMensajePass({ ok: false, texto: 'Las contraseñas no coinciden.' })
    setCambiando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setCambiando(false)
    if (error) return setMensajePass({ ok: false, texto: 'No se pudo cambiar la contraseña. Vuelve a iniciar sesión e inténtalo de nuevo.' })
    setPassword('')
    setRepetir('')
    setMensajePass({ ok: true, texto: 'Contraseña cambiada' })
  }

  async function cerrarSesion(scope: 'local' | 'global') {
    if (scope === 'global' && !window.confirm('Se cerrará tu sesión en todos los dispositivos, también en este. ¿Continuar?')) return
    await supabase.auth.signOut({ scope })
    router.push('/login')
  }

  const iniciales = perfil ? `${perfil.nombre?.[0] ?? ''}${perfil.apellidos?.[0] ?? ''}`.toUpperCase() || '·' : ''

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="flex items-center gap-3 rounded-2xl border p-4 sm:p-5" style={cardStyle}>
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
            aria-hidden
          >
            {iniciales}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              {perfil ? `${perfil.nombre} ${perfil.apellidos ?? ''}`.trim() : 'Ajustes'}
            </h2>
            <p className="truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
              {perfil ? perfil.email : errorCarga ? 'No se pudo cargar tu perfil' : 'Cargando…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => cerrarSesion('local')}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
            style={ghostButtonStyle}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </section>

        <Seccion titulo="Cuenta">
          <form onSubmit={guardarPerfil} className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre">
              <input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} required autoComplete="off"
                className="w-full rounded-xl border px-3 py-2" style={inputStyle} />
            </Campo>
            <Campo etiqueta="Apellidos">
              <input value={apellidos} onChange={e => setApellidos(e.target.value)} maxLength={80} autoComplete="off"
                className="w-full rounded-xl border px-3 py-2" style={inputStyle} />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" autoComplete="off"
                className="w-full rounded-xl border px-3 py-2" style={inputStyle} />
            </Campo>
            <Campo etiqueta="Correo">
              <input value={perfil?.email ?? ''} readOnly disabled
                className="w-full rounded-xl border px-3 py-2 opacity-70" style={inputStyle} />
            </Campo>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" disabled={guardando || !perfil} className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50" style={buttonStyle}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {mensajePerfil && (
                <span role="status" className="text-sm" style={{ color: mensajePerfil.ok ? 'var(--success, #3f9d6b)' : 'var(--danger, #c0504d)' }}>
                  {mensajePerfil.texto}
                </span>
              )}
            </div>
          </form>

          <form onSubmit={cambiarPassword} className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-semibold sm:col-span-2" style={{ color: 'var(--text)' }}>Cambiar contraseña</p>
            <Campo etiqueta="Nueva contraseña">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"
                className="w-full rounded-xl border px-3 py-2" style={inputStyle} />
            </Campo>
            <Campo etiqueta="Repetir contraseña">
              <input type="password" value={repetir} onChange={e => setRepetir(e.target.value)} autoComplete="new-password"
                className="w-full rounded-xl border px-3 py-2" style={inputStyle} />
            </Campo>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" disabled={cambiando || !password} className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50" style={buttonStyle}>
                {cambiando ? 'Cambiando…' : 'Cambiar contraseña'}
              </button>
              {mensajePass && (
                <span role="status" className="text-sm" style={{ color: mensajePass.ok ? 'var(--success, #3f9d6b)' : 'var(--danger, #c0504d)' }}>
                  {mensajePass.texto}
                </span>
              )}
            </div>
          </form>
        </Seccion>

        <Seccion titulo="Apariencia">
          <div className="inline-flex rounded-xl border p-1" style={{ borderColor: 'var(--border)' }} role="group" aria-label="Tema">
            {([['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]] as const).map(([valor, texto, Icono]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setTheme(valor)}
                aria-pressed={theme === valor}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                style={theme === valor ? buttonStyle : { color: 'var(--text-secondary)' }}
              >
                <Icono size={15} />
                {texto}
              </button>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Método y conocimiento">
          <div className="grid gap-3 sm:grid-cols-3">
            {ACCESOS_METODO.map(({ href, label, detail, icon: Icono }) => (
              <Link key={href} href={href} className="rounded-xl border p-3 transition-transform active:scale-[0.99]" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                <Icono size={18} style={{ color: 'var(--text)' }} />
                <span className="mt-2 block text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{detail}</span>
              </Link>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Seguridad">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
              Si has perdido un dispositivo o has entrado en uno que no es tuyo, cierra tu sesión en todos.
            </p>
            <button
              type="button"
              onClick={() => cerrarSesion('global')}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
              style={ghostButtonStyle}
            >
              <ShieldAlert size={16} />
              Cerrar sesión en todos los dispositivos
            </button>
          </div>
        </Seccion>
      </div>
    </div>
  )
}
