'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { InstagramLogo, X } from '@phosphor-icons/react'

/** Botón «Compartir» + vista previa de la tarjeta vertical para Instagram Stories. */
export default function CompartirSesion({ generar }: { generar: () => Promise<Blob> }) {
  const [abierto, setAbierto] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    let vivo = true
    setBlob(null); setUrl(null); setError(false)
    generar()
      .then(b => { if (vivo) { setBlob(b); setUrl(URL.createObjectURL(b)) } })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  async function compartir() {
    if (!blob) return
    const archivo = new File([blob], 'entreno.png', { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [archivo] })) { await navigator.share({ files: [archivo] }); return }
    } catch { return /* el usuario canceló */ }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'entreno.png'
    a.click()
  }

  async function copiar() {
    if (!blob) return
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { compartir() }
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="share-story__open" aria-label="Compartir en una story">
        <InstagramLogo size={16} />
      </button>
      {abierto && createPortal(
        <div className="share-story" role="dialog" aria-modal="true" aria-label="Tarjeta para story">
          <button type="button" className="share-story__close" onClick={() => setAbierto(false)} aria-label="Cerrar"><X size={20} /></button>
          <div className="share-story__preview">
            {url ? <img src={url} alt="Tarjeta de la sesión" /> : <p>{error ? 'No se pudo crear la imagen' : 'Creando tarjeta…'}</p>}
          </div>
          <p className="share-story__hint">Añádela como sticker sobre tu foto o vídeo en la story</p>
          <div className="share-story__btns">
            <button type="button" className="share-story__go" onClick={compartir} disabled={!blob}>Compartir</button>
            <button type="button" className="share-story__go share-story__go--alt" onClick={copiar} disabled={!blob}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
