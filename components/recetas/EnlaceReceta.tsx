'use client'

import { useRouter } from 'next/navigation'

/** Abre la receta y «volver» regresa a esta misma pantalla (pestaña y filtros incluidos): la URL se lee al hacer clic. */
export default function EnlaceReceta({ id, className, style, title, children }: { id: string; className?: string; style?: React.CSSProperties; title?: string; children: React.ReactNode }) {
  const router = useRouter()
  return <a href={`/recetas/${id}`} title={title} className={className} style={style} onClick={event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    router.push(`/recetas/${id}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)
  }}>{children}</a>
}
