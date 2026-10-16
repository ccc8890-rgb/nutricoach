'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageSquare, InstagramLogo, X } from '@phosphor-icons/react'
import type { TemaTarjeta } from '@/lib/entrenos/tarjeta-story'

const W_STORY = 1080
const H_STORY = 1920

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src })
}

/** Botón de Instagram + vista previa de la tarjeta. Permite colocarla sobre una foto del carrete y exportar 1080×1920. */
export default function CompartirSesion({ generar }: { generar: (tema: TemaTarjeta) => Promise<Blob> }) {
  const [abierto, setAbierto] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [foto, setFoto] = useState<string | null>(null)
  const [tema, setTema] = useState<TemaTarjeta>('oscuro')
  // Centro de la tarjeta (0-1 sobre la story) y su ancho (fracción del ancho de la story)
  const [pos, setPos] = useState({ x: 0.5, y: 0.5, ancho: 0.8 })
  const editor = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!abierto) return
    let vivo = true
    setBlob(null); setUrl(null); setError(false)
    generar(tema)
      .then(b => { if (vivo) { setBlob(b); setUrl(URL.createObjectURL(b)) } })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tema])

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto) }, [foto])

  function cerrar() { setAbierto(false); setFoto(null); setPos({ x: 0.5, y: 0.5, ancho: 0.8 }) }

  function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setFoto(URL.createObjectURL(f))
  }

  function empezar(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    arrastre.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }
  }
  function mover(e: React.PointerEvent) {
    const a = arrastre.current, r = editor.current?.getBoundingClientRect()
    if (!a || !r) return
    setPos(p => ({ ...p, x: Math.min(1, Math.max(0, a.x + (e.clientX - a.px) / r.width)), y: Math.min(1, Math.max(0, a.y + (e.clientY - a.py) / r.height)) }))
  }

  /** Imagen final: la tarjeta suelta, o la foto a 1080×1920 con la tarjeta encima. */
  async function resultado(): Promise<Blob | null> {
    if (!blob) return null
    if (!foto || !url) return blob
    const [bg, card] = await Promise.all([cargarImagen(foto), cargarImagen(url)])
    const c = document.createElement('canvas')
    c.width = W_STORY; c.height = H_STORY
    const ctx = c.getContext('2d')!
    const k = Math.max(W_STORY / bg.width, H_STORY / bg.height)
    ctx.drawImage(bg, (W_STORY - bg.width * k) / 2, (H_STORY - bg.height * k) / 2, bg.width * k, bg.height * k)
    const w = W_STORY * pos.ancho, h = (card.height / card.width) * w
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(card, pos.x * W_STORY - w / 2, pos.y * H_STORY - h / 2, w, h)
    return new Promise(ok => c.toBlob(b => ok(b), 'image/png'))
  }

  function descargarBlob(b: Blob) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = 'entreno.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  async function compartir() {
    const b = await resultado()
    if (!b) return
    const archivo = new File([b], 'entreno.png', { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [archivo] })) { await navigator.share({ files: [archivo] }); return }
    } catch { return /* el usuario canceló */ }
    descargarBlob(b)
  }
  async function descargar() { const b = await resultado(); if (b) descargarBlob(b) }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="share-story__open" aria-label="Compartir en una story">
        <InstagramLogo size={16} />
      </button>
      {abierto && createPortal(
        <div className="share-story" role="dialog" aria-modal="true" aria-label="Tarjeta para story">
          <button type="button" className="share-story__close" onClick={cerrar} aria-label="Cerrar"><X size={20} /></button>
          <div className="share-story__preview">
            {!url ? (
              <p>{error ? 'No se pudo crear la imagen' : 'Creando tarjeta…'}</p>
            ) : foto ? (
              <div ref={editor} className="share-story__editor" style={{ backgroundImage: `url(${foto})` }}>
                <img
                  src={url} alt="Tarjeta"
                  onPointerDown={empezar} onPointerMove={mover} onPointerUp={() => { arrastre.current = null }} onPointerCancel={() => { arrastre.current = null }}
                  style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${pos.ancho * 100}%` }}
                  draggable={false}
                />
              </div>
            ) : (
              <img src={url} alt="Tarjeta de la sesión" />
            )}
          </div>
          {foto && (
            <label className="share-story__size">
              <span>TAMAÑO</span>
              <input type="range" min="30" max="100" value={Math.round(pos.ancho * 100)} onChange={e => setPos(p => ({ ...p, ancho: Number(e.target.value) / 100 }))} />
            </label>
          )}
          <div className="share-story__tema" role="group" aria-label="Estilo de la tarjeta">
            {(['oscuro', 'claro'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTema(t)} aria-pressed={tema === t} className={tema === t ? 'is-on' : ''}>{t === 'oscuro' ? 'OSCURA' : 'CLARA'}</button>
            ))}
          </div>
          <p className="share-story__hint">{foto ? 'Arrastra la tarjeta para colocarla' : 'Compártela suelta o ponla sobre una foto tuya'}</p>
          <input ref={inputFoto} type="file" accept="image/*" hidden onChange={elegirFoto} />
          <div className="share-story__btns">
            <button type="button" className="share-story__go share-story__go--alt" onClick={() => inputFoto.current?.click()} disabled={!blob}>
              <ImageSquare size={16} /> {foto ? 'Otra foto' : 'Con mi foto'}
            </button>
            <button type="button" className="share-story__go share-story__go--alt" onClick={descargar} disabled={!blob}>Descargar</button>
            <button type="button" className="share-story__go" onClick={compartir} disabled={!blob}>Compartir</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
