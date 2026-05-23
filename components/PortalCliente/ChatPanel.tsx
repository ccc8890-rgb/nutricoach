'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, MessageSquareText } from 'lucide-react'
import type { ChatMensaje } from '@/types'

interface ChatPanelProps {
  codigo?: string       // Portal cliente
  clienteId?: string     // Ficha coach
  pollingInterval?: number  // ms — 10s cliente, 30s coach
  esCoach?: boolean
}

export default function ChatPanel({ codigo, clienteId, pollingInterval = 10000, esCoach = false }: ChatPanelProps) {
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Construir URL base
  const baseUrl = esCoach && clienteId
    ? `/api/clientes/${clienteId}/chat`
    : codigo
      ? `/api/cliente/${codigo}/chat`
      : null

  const cargarMensajes = useCallback(async () => {
    if (!baseUrl) return
    try {
      const res = await fetch(baseUrl)
      if (!res.ok) return
      const json = await res.json()
      setMensajes(json.mensajes ?? [])
    } catch {
      // Silencioso
    } finally {
      setCargando(false)
    }
  }, [baseUrl])

  // Cargar inicial y polling
  useEffect(() => {
    cargarMensajes()
    pollingRef.current = setInterval(cargarMensajes, pollingInterval)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [cargarMensajes, pollingInterval])

  // Scroll automático al nuevo mensaje
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // Enviar mensaje
  async function handleEnviar(e?: React.FormEvent) {
    e?.preventDefault()
    if (!texto.trim() || !baseUrl) return
    setEnviando(true)
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: texto.trim() }),
      })
      if (!res.ok) throw new Error('Error al enviar')
      const json = await res.json()
      if (json.mensaje) {
        setMensajes(prev => [...prev, json.mensaje])
      }
      setTexto('')
    } catch {
      // Silencioso
    } finally {
      setEnviando(false)
      inputRef.current?.focus()
    }
  }

  // Formatear hora
  function fmtHora(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  function fmtFecha(iso: string): string {
    const d = new Date(iso)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fecha = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDias = Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDias === 0) return 'Hoy'
    if (diffDias === 1) return 'Ayer'
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  // Agrupar mensajes por fecha
  function agruparPorFecha(): { fecha: string; mensajes: ChatMensaje[] }[] {
    const grupos: Record<string, ChatMensaje[]> = {}
    mensajes.forEach(m => {
      const key = new Date(m.created_at).toLocaleDateString('en-CA')
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(m)
    })
    return Object.entries(grupos).map(([fecha, msgs]) => ({ fecha, mensajes: msgs }))
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[60vh] sm:h-[65vh]">
      {/* Cabecera */}
      {mensajes.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <MessageSquareText size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {mensajes.length} mensajes
          </span>
        </div>
      )}

      {/* Mensajes — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
        {mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--primary-bg)' }}>
              <MessageSquareText size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Chat con tu coach</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Escribe tu primer mensaje para empezar la conversación
            </p>
          </div>
        ) : (
          agruparPorFecha().map(grupo => (
            <div key={grupo.fecha}>
              {/* Separador de fecha */}
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                  {fmtFecha(grupo.mensajes[0].created_at)}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>

              {grupo.mensajes.map(m => (
                <div key={m.id} className={`flex ${m.remitente === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${m.remitente === 'cliente'
                      ? 'rounded-br-md'
                      : 'rounded-bl-md'
                      }`}
                    style={{
                      background: m.remitente === 'cliente'
                        ? 'var(--primary)'
                        : 'var(--bg)',
                      color: m.remitente === 'cliente' ? 'white' : 'var(--text)',
                    }}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.contenido}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${m.remitente === 'cliente' ? '' : ''}`}>
                      <span className="text-[10px] opacity-60">{fmtHora(m.created_at)}</span>
                      {m.remitente === 'cliente' && (
                        <span className={`text-[10px] ${m.leido ? 'opacity-80' : 'opacity-40'}`}>
                          {m.leido ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleEnviar} className="flex items-center gap-2 p-3 border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 input !py-2.5 !text-sm"
          disabled={enviando}
          maxLength={1000}
          autoFocus
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
          style={{
            background: texto.trim() ? 'var(--primary)' : 'var(--bg)',
            color: texto.trim() ? 'white' : 'var(--text-muted)',
          }}
        >
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  )
}
