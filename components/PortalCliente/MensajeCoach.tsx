'use client'

import { useEffect, useState, useCallback } from 'react'

interface Mensaje {
  id: string
  remitente: 'coach' | 'cliente'
  contenido: string
  leido: boolean
  created_at: string
}

interface Props {
  codigo: string
}

export default function MensajeCoach({ codigo }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleId, setVisibleId] = useState<string | null>(null)

  const fetchMensajes = useCallback(async () => {
    try {
      const res = await fetch(`/api/cliente/${codigo}/chat`)
      if (!res.ok) return
      const data = await res.json()
      setMensajes(data.mensajes ?? [])
    } catch {
      // silencio
    } finally {
      setLoading(false)
    }
  }, [codigo])

  useEffect(() => {
    fetchMensajes()
  }, [fetchMensajes])

  // Filtrar mensajes del coach no leídos de los últimos 7 días
  const ahora = new Date()
  const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)

  const mensajesNuevos = mensajes.filter(
    (m) =>
      m.remitente === 'coach' &&
      !m.leido &&
      new Date(m.created_at) >= hace7Dias
  )

  // Mostrar el más reciente
  const mensajeMostrar = mensajesNuevos.length > 0 ? mensajesNuevos[0] : null

  // Marcar como leído después de 5 segundos y guardar en localStorage
  useEffect(() => {
    if (!mensajeMostrar) return

    const id = mensajeMostrar.id
    const storageKey = `mensaje_coach_leido_${codigo}_${id}`

    // Si ya se mostró antes, no mostrar
    if (localStorage.getItem(storageKey)) {
      setVisibleId(null)
      return
    }

    setVisibleId(id)

    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/cliente/${codigo}/chat/leer`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensaje_id: id }),
        })
      } catch {
        // silencio
      }
      localStorage.setItem(storageKey, '1')
      setVisibleId(null)
    }, 5000)

    return () => clearTimeout(timer)
  }, [mensajeMostrar, codigo])

  if (loading || !mensajeMostrar || visibleId !== mensajeMostrar.id) {
    return null
  }

  // Timestamp relativo
  const timestamp = new Date(mensajeMostrar.created_at)
  const diffMs = ahora.getTime() - timestamp.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMs / 3600000)
  const diffDias = Math.floor(diffMs / 86400000)

  let tiempoTexto: string
  if (diffMin < 1) {
    tiempoTexto = 'ahora'
  } else if (diffMin < 60) {
    tiempoTexto = `hace ${diffMin} min`
  } else if (diffHoras < 24) {
    tiempoTexto = `hace ${diffHoras}h`
  } else if (diffDias < 2) {
    tiempoTexto = 'ayer'
  } else {
    tiempoTexto = `hace ${diffDias} días`
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '16px',
        borderRadius: '12px',
        background: 'var(--accent)',
        backgroundOpacity: '0.1',
        borderLeft: '4px solid var(--accent)',
        marginBottom: '16px',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--accent)',
          color: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '14px',
          flexShrink: 0,
        }}
      >
        CN
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--text)',
            }}
          >
            Coach
          </span>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            {tiempoTexto}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: 1.5,
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {mensajeMostrar.contenido}
        </p>
      </div>
    </div>
  )
}
