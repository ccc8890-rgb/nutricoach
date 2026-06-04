'use client'
import { useEffect, useState } from 'react'
import { ArrowSquareOut, Barbell, CaretDown, CaretUp, Play, X } from '@phosphor-icons/react'

interface Props {
  nombre: string
  grupo_muscular?: string
  video_url?: string | null
  foto_url?: string | null
  instruccion_ejercicio?: string | null
  onCerrar: () => void
}

type Platform = 'youtube' | 'instagram' | 'tiktok' | 'vimeo' | 'externo'

function detectPlatform(url: string): Platform {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('vimeo.com')) return 'vimeo'
  return 'externo'
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  vimeo: 'Vimeo',
  externo: 'enlace externo',
}

export default function EjercicioDemoModal({
  nombre,
  grupo_muscular,
  video_url,
  foto_url,
  instruccion_ejercicio,
  onCerrar,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [instruccionesExpanded, setInstruccionesExpanded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  function cerrar() {
    setVisible(false)
    setTimeout(onCerrar, 280)
  }

  const platform = video_url ? detectPlatform(video_url) : null
  const ytId = video_url && platform === 'youtube' ? getYouTubeId(video_url) : null
  const embedUrl = ytId
    ? `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`
    : null

  const hasInstrucciones = instruccion_ejercicio && instruccion_ejercicio.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
        transition: 'background 0.28s',
      }}
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
        {/* Handle */}
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
            <X size={18} />
          </button>
        </div>

        {/* Contenido media */}
        <div className="flex-1 overflow-y-auto">
          {/* Nivel 1: YouTube embed */}
          {embedUrl && (
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`Demo ${nombre}`}
              />
            </div>
          )}

          {/* Nivel 2: Instagram / TikTok / Vimeo / externo */}
          {video_url && !embedUrl && platform && (
            <div
              className="relative w-full flex flex-col items-center justify-center gap-3 py-10"
              style={{
                minHeight: 200,
                background: foto_url
                  ? `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.7)), url(${foto_url}) center/cover no-repeat`
                  : 'var(--bg)',
              }}
            >
              {!foto_url && (
                <Barbell size={40} weight="duotone" style={{ color: 'var(--text-muted)' }} />
              )}
              <a
                href={video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold text-sm"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                <Play size={16} weight="fill" />
                Ver en {PLATFORM_LABEL[platform]}
                <ArrowSquareOut size={14} />
              </a>
              <p className="text-xs" style={{ color: foto_url ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                Se abre en nueva pestaña
              </p>
            </div>
          )}

          {/* Nivel 3: Solo foto */}
          {!video_url && foto_url && (
            <div className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto_url}
                alt={`Demo ${nombre}`}
                className="w-full object-cover"
                style={{ maxHeight: 320 }}
              />
            </div>
          )}

          {/* Nivel 4: Sin media */}
          {!video_url && !foto_url && (
            <div
              className="flex flex-col items-center justify-center gap-3 py-12"
              style={{ color: 'var(--text-muted)' }}
            >
              <Barbell size={40} weight="duotone" />
              <p className="text-sm text-center px-6">Sin demo disponible — revisa las instrucciones</p>
            </div>
          )}

          {/* Instrucciones colapsables */}
          {hasInstrucciones && (
            <div className="px-5 pb-5 pt-3">
              <button
                onClick={() => setInstruccionesExpanded(v => !v)}
                className="flex w-full items-center justify-between py-2 text-sm font-semibold"
                style={{ color: 'var(--text)' }}
              >
                <span>Instrucciones</span>
                {instruccionesExpanded
                  ? <CaretUp size={16} style={{ color: 'var(--text-muted)' }} />
                  : <CaretDown size={16} style={{ color: 'var(--text-muted)' }} />
                }
              </button>
              <div
                style={{
                  maxHeight: instruccionesExpanded ? 400 : 48,
                  overflow: 'hidden',
                  transition: 'max-height 0.22s ease',
                }}
              >
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: 'var(--text-secondary)',
                    ...(instruccionesExpanded ? {} : {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }),
                  }}
                >
                  {instruccion_ejercicio}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
