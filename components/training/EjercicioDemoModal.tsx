'use client'
import { useEffect, useState } from 'react'
import { X, Play } from 'lucide-react'

interface Props {
  nombre: string
  grupo_muscular?: string
  video_url?: string | null
  foto_url?: string | null
  onCerrar: () => void
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function getEmbedUrl(url: string): string | null {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`
  if (url.includes('instagram.com/reel') || url.includes('instagram.com/p/')) return null
  return null
}

export default function EjercicioDemoModal({ nombre, grupo_muscular, video_url, foto_url, onCerrar }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Pequeño delay para que el slide-up se vea
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  function cerrar() {
    setVisible(false)
    setTimeout(onCerrar, 280)
  }

  const embedUrl = video_url ? getEmbedUrl(video_url) : null
  const isExternal = video_url && !embedUrl

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)', transition: 'background 0.28s' }}
      onClick={cerrar}
    >
      <div
        className="w-full max-w-lg mx-auto rounded-t-2xl overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3 flex-shrink-0">
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--text)' }}>{nombre}</p>
            {grupo_muscular && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{grupo_muscular}</p>
            )}
          </div>
          <button
            onClick={cerrar}
            className="p-1.5 rounded-full flex-shrink-0 ml-3"
            style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
            aria-label="Cerrar demo"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto flex-1 pb-safe pb-6">
          {/* Vídeo embed (YouTube) */}
          {embedUrl && (
            <div className="mx-4 mb-4 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', background: '#000' }}>
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`Demo: ${nombre}`}
              />
            </div>
          )}

          {/* Enlace externo (Instagram, web, etc.) */}
          {isExternal && (
            <div className="mx-4 mb-4">
              <a
                href={video_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-semibold text-white text-sm"
                style={{ background: 'rgb(168,85,247)' }}
              >
                <Play size={16} /> Ver demostración
              </a>
            </div>
          )}

          {/* Foto demo */}
          {foto_url && (
            <div className="mx-4 mb-4 rounded-xl overflow-hidden" style={{ background: 'var(--bg)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto_url}
                alt={`Demo: ${nombre}`}
                className="w-full object-cover"
                style={{ maxHeight: 300 }}
              />
            </div>
          )}

          {/* Sin media */}
          {!video_url && !foto_url && (
            <div className="mx-4 mb-4 py-10 text-center rounded-xl" style={{ background: 'var(--bg)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin vídeo ni foto de demostración disponible.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
