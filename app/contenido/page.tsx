'use client'

import { useEstadoUrl } from '@/lib/useEstadoUrl'
import BandejaIdeas from '@/components/contenido/BandejaIdeas'
import CalendarioContenido from '@/components/contenido/CalendarioContenido'
import DiaGrabacion from '@/components/contenido/DiaGrabacion'
import TableroContenido from '@/components/contenido/TableroContenido'

const VISTAS = [
  { id: 'bandeja', label: 'Bandeja' },
  { id: 'tanda', label: 'Día de grabación' },
  { id: 'tablero', label: 'Tablero' },
  { id: 'calendario', label: 'Calendario' },
] as const
type Vista = typeof VISTAS[number]['id']

export default function ContenidoPage() {
  const [vista, setVista] = useEstadoUrl<Vista>('vista', 'bandeja', VISTAS.map(v => v.id))
  const [fechaTandaUrl, setFechaTanda] = useEstadoUrl<string | null>('fecha', null)
  const fechaTanda = fechaTandaUrl ?? undefined

  return (
    <main className="coach-content-studio">
      <header className="coach-content-studio__header">
        <div><p>Operaciones editoriales</p><h1>Contenido</h1></div>
      </header>
      <nav className="coach-content-tabs" role="tablist">
        {VISTAS.map(v => (
          <button key={v.id} role="tab" aria-selected={vista === v.id} className={`btn btn-sm ${vista === v.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVista(v.id)}>
            {v.label}
          </button>
        ))}
      </nav>
      {vista === 'bandeja' && <BandejaIdeas />}
      {vista === 'tanda' && <DiaGrabacion key={fechaTanda ?? 'hoy'} fechaInicial={fechaTanda} />}
      {vista === 'tablero' && <TableroContenido />}
      {vista === 'calendario' && <CalendarioContenido onAbrirDia={f => { setFechaTanda(f); setVista('tanda') }} />}
    </main>
  )
}
