'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    DeviceMobile, User, Lock, SignOut, Sun, Moon,
    CheckCircle, CircleNotch, Eye, EyeSlash,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import { useToast } from '@/components/ui/Toast'
import IntegracionesPanel from './IntegracionesPanel'
import type { Profile, Cliente } from '@/types'

const OBJETIVO_LABEL: Record<string, string> = {
    perder_grasa: 'Perder grasa',
    ganar_musculo: 'Ganar músculo',
    recomposicion: 'Recomposición',
    mantenimiento: 'Mantenimiento',
    rendimiento: 'Rendimiento',
}
const NIVEL_LABEL: Record<string, string> = {
    principiante: 'Principiante',
    intermedio: 'Intermedio',
    avanzado: 'Avanzado',
}

interface AjustesTabsProps {
    codigo: string
    clienteId: string
    profile: Profile | null
    cliente: Cliente | null
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value || '—'}</span>
        </div>
    )
}

export default function AjustesTabs({ codigo, clienteId, profile, cliente }: AjustesTabsProps) {
    const [subTab, setSubTab] = useState<'apps' | 'perfil' | 'cuenta'>('apps')
    const router = useRouter()
    const { theme, toggleTheme } = useTheme()
    const { addToast } = useToast()

    const [restricciones, setRestricciones] = useState(cliente?.restricciones_alimentarias ?? '')
    const [guardandoRestricciones, setGuardandoRestricciones] = useState(false)

    const [passNueva, setPassNueva] = useState('')
    const [mostrarPass, setMostrarPass] = useState(false)
    const [cambiandoPass, setCambiandoPass] = useState(false)

    async function guardarRestricciones() {
        setGuardandoRestricciones(true)
        try {
            const res = await fetch('/api/cliente/perfil', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restricciones_alimentarias: restricciones }),
            })
            if (!res.ok) throw new Error()
            addToast({ type: 'success', title: 'Guardado', message: 'Tu coach verá el cambio.' })
        } catch {
            addToast({ type: 'error', title: 'No se pudo guardar' })
        } finally {
            setGuardandoRestricciones(false)
        }
    }

    async function cambiarPassword() {
        if (passNueva.length < 6) {
            addToast({ type: 'error', title: 'La contraseña nueva debe tener al menos 6 caracteres' })
            return
        }
        setCambiandoPass(true)
        try {
            const { error } = await supabase.auth.updateUser({ password: passNueva })
            if (error) throw error
            addToast({ type: 'success', title: 'Contraseña actualizada' })
            setPassNueva('')
        } catch {
            addToast({ type: 'error', title: 'No se pudo cambiar la contraseña' })
        } finally {
            setCambiandoPass(false)
        }
    }

    async function cerrarSesion() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                {([
                    { key: 'apps', label: 'Apps', icon: DeviceMobile },
                    { key: 'perfil', label: 'Perfil', icon: User },
                    { key: 'cuenta', label: 'Cuenta', icon: Lock },
                ] as const).map(t => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setSubTab(t.key)}
                        className="flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors"
                        style={{
                            background: subTab === t.key ? 'var(--primary)' : 'transparent',
                            color: subTab === t.key ? 'var(--bg)' : 'var(--text-muted)',
                        }}
                    >
                        <t.icon size={15} />
                        {t.label}
                    </button>
                ))}
            </div>

            {subTab === 'apps' && (
                <IntegracionesPanel codigo={codigo} clienteId={clienteId} />
            )}

            {subTab === 'perfil' && (
                <div className="flex flex-col gap-4">
                    <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--text)' }}>Tus datos</h2>
                        <InfoRow label="Nombre" value={`${profile?.nombre ?? ''} ${profile?.apellidos ?? ''}`.trim()} />
                        <InfoRow label="Email" value={profile?.email} />
                        <InfoRow label="Objetivo" value={cliente?.objetivo ? OBJETIVO_LABEL[cliente.objetivo] : undefined} />
                        <InfoRow label="Nivel" value={cliente?.nivel ? NIVEL_LABEL[cliente.nivel] : undefined} />
                        <InfoRow label="Edad" value={cliente?.edad ? `${cliente.edad} años` : undefined} />
                        <InfoRow label="Altura" value={cliente?.altura ? `${cliente.altura} cm` : undefined} />
                        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
                            Estos datos los gestiona tu coach. Si algo cambió (edad, altura, objetivo), avísale por chat.
                        </p>
                    </div>

                    <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>Restricciones alimentarias</h2>
                        <textarea
                            className="input w-full rounded-xl resize-none"
                            rows={3}
                            placeholder="Alergias, intolerancias, alimentos que no te gustan…"
                            value={restricciones}
                            onChange={e => setRestricciones(e.target.value)}
                        />
                        <button
                            className="btn btn-primary w-full justify-center rounded-xl mt-3 cursor-pointer"
                            onClick={guardarRestricciones}
                            disabled={guardandoRestricciones}
                        >
                            {guardandoRestricciones ? <CircleNotch size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {guardandoRestricciones ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-bg)' }}>
                                {theme === 'dark' ? <Sun size={16} style={{ color: 'var(--primary)' }} /> : <Moon size={16} style={{ color: 'var(--primary)' }} />}
                            </div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Tema {theme === 'dark' ? 'oscuro' : 'claro'}</p>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tocar para cambiar</span>
                    </button>
                </div>
            )}

            {subTab === 'cuenta' && (
                <div className="flex flex-col gap-4">
                    <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>Cambiar contraseña</h2>
                        <div className="relative mb-3">
                            <input
                                type={mostrarPass ? 'text' : 'password'}
                                className="input w-full rounded-xl pr-10"
                                placeholder="Nueva contraseña (mín. 6 caracteres)"
                                value={passNueva}
                                onChange={e => setPassNueva(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setMostrarPass(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {mostrarPass ? <EyeSlash size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <button
                            className="btn btn-primary w-full justify-center rounded-xl cursor-pointer"
                            onClick={cambiarPassword}
                            disabled={cambiandoPass || !passNueva}
                        >
                            {cambiandoPass ? 'Guardando…' : 'Actualizar contraseña'}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={cerrarSesion}
                        className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                        style={{ background: 'var(--semantic-alert-bg)', border: '1px solid var(--semantic-alert-border)', color: 'var(--semantic-alert)' }}
                    >
                        <SignOut size={16} />
                        <span className="text-sm font-semibold">Cerrar sesión</span>
                    </button>
                </div>
            )}
        </div>
    )
}
