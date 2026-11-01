'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

type Linea = { nombre_libre: string; cantidad_gramos: number; alimento_id: string | null }
type Plato = {
  id: string; cliente_id: string; nombre: string; tipo_comida: string; estado: string; foto_original_url: string | null; foto_limpia_url: string | null
  porciones: number; pasos: string | null; kcal: number; proteinas: number; carbohidratos: number; grasas: number; incompleto: boolean; nota_cliente: string | null; nota_coach: string | null
}
type Objetivo = { kcal_objetivo: number | null; proteinas_objetivo: number | null } | null
type Sugerido = { id: string; nombre: string }

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const FRANJAS = ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena']

/** Revisión de un plato del cliente: corregir gramos, enlazar ingredientes, aprobar / devolver y meterlo en su dieta. */
export default function RevisionPlato({ platoId, onCerrar }: { platoId: string; onCerrar: () => void }) {
  const [plato, setPlato] = useState<Plato | null>(null)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [objetivo, setObjetivo] = useState<Objetivo>(null)
  const [cliente, setCliente] = useState('')
  const [sucio, setSucio] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [buscando, setBuscando] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [sugeridos, setSugeridos] = useState<Sugerido[]>([])
  const [nota, setNota] = useState('')
  const [porciones, setPorciones] = useState(1)
  const [dia, setDia] = useState(DIAS[0]); const [franja, setFranja] = useState('Comida'); const [raciones, setRaciones] = useState(1)

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/platos/${platoId}`, { cache: 'no-store' })
    if (!r.ok) { setMsg({ tipo: 'error', texto: 'No se pudo cargar el plato' }); return }
    const j = await r.json()
    setPlato(j.plato); setPorciones(Number(j.plato.porciones) || 1); setObjetivo(j.objetivo); setCliente(j.cliente_nombre ?? ''); setSucio(false)
    setLineas((j.lineas ?? []).map((l: Linea) => ({ nombre_libre: l.nombre_libre, cantidad_gramos: Number(l.cantidad_gramos), alimento_id: l.alimento_id })))
  }, [platoId])
  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (buscando === null || q.trim().length < 2) { setSugeridos([]); return }
    const t = setTimeout(() => {
      fetch(`/api/alimentos?q=${encodeURIComponent(q.trim())}&selector=1`).then(r => (r.ok ? r.json() : { items: [] })).then(j => setSugeridos((j.items ?? []).map((a: { id: string; nombre: string }) => ({ id: a.id, nombre: a.nombre })))).catch(() => setSugeridos([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q, buscando])

  const cambiar = (i: number, c: Partial<Linea>) => { setLineas(ls => ls.map((l, k) => (k === i ? { ...l, ...c } : l))); setSucio(true) }

  async function guardar(): Promise<boolean> {
    setOcupado(true); setMsg(null)
    try {
      const r = await fetch(`/api/platos/${platoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineas, porciones }) })
      const j = await r.json()
      if (!r.ok) { setMsg({ tipo: 'error', texto: j.error ?? 'No se pudo guardar' }); return false }
      await cargar(); setMsg({ tipo: 'ok', texto: 'Correcciones guardadas' }); return true
    } finally { setOcupado(false) }
  }
  async function revisar(accion: 'aprobar' | 'devolver') {
    if (sucio && !(await guardar())) return
    setOcupado(true); setMsg(null)
    try {
      const r = await fetch(`/api/platos/${platoId}/revisar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accion === 'aprobar' ? { accion } : { accion, nota }) })
      const j = await r.json()
      if (!r.ok) { setMsg({ tipo: 'error', texto: j.error ?? 'No se pudo completar' }); return }
      await cargar(); setMsg({ tipo: 'ok', texto: accion === 'aprobar' ? 'Plato aprobado' : 'Plato devuelto al cliente' })
    } finally { setOcupado(false) }
  }
  async function aDieta() {
    setOcupado(true); setMsg(null)
    try {
      const r = await fetch(`/api/platos/${platoId}/dieta`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dia, franja, raciones }) })
      const j = await r.json()
      setMsg(r.ok ? { tipo: 'ok', texto: `Añadido a su dieta: ${dia} · ${franja}` } : { tipo: 'error', texto: j.error ?? 'No se pudo añadir a la dieta' })
    } finally { setOcupado(false) }
  }

  if (!plato) return <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{msg?.texto ?? 'Cargando…'}</div>
  const pendiente = plato.estado === 'pendiente'
  const aprobado = plato.estado === 'aprobado'
  // El % se calcula por ración (lo que el cliente se come), no por el plato entero
  const porRacion = (v: number) => v / (porciones || 1)
  const pct = objetivo?.kcal_objetivo ? Math.round((porRacion(plato.kcal) / objetivo.kcal_objetivo) * 100) : null
  const sinEnlazar = lineas.filter(l => !l.alimento_id).length

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onCerrar} className="self-start text-sm" style={{ color: 'var(--text-muted)' }}>← Platos del cliente</button>
      <div className="flex gap-3">
        {(plato.foto_limpia_url ?? plato.foto_original_url) && <div className="relative w-40 h-40 shrink-0"><Image src={(plato.foto_limpia_url ?? plato.foto_original_url) as string} alt="Foto del plato" fill sizes="160px" className="object-cover" /></div>}
        {plato.foto_limpia_url && plato.foto_original_url && <div className="relative w-40 h-40 shrink-0" style={{ opacity: 0.85 }}><Image src={plato.foto_original_url} alt="Foto original" fill sizes="160px" className="object-cover" /></div>}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{plato.nombre || 'Plato sin nombre'}</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{cliente} · {plato.tipo_comida} · {plato.estado}</p>
          {plato.nota_cliente && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>«{plato.nota_cliente}»</p>}
          <p className="text-sm mt-2 font-mono" style={{ color: 'var(--text)' }}>{Math.round(plato.kcal)} kcal · P {Math.round(plato.proteinas)} · C {Math.round(plato.carbohidratos)} · G {Math.round(plato.grasas)}</p>
          {pct !== null && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pct} % de sus {Math.round(objetivo!.kcal_objetivo!)} kcal diarias (por ración){objetivo?.proteinas_objetivo ? ` · proteína ${Math.round((porRacion(plato.proteinas) / objetivo.proteinas_objetivo) * 100)} % de su objetivo` : ''}</p>}
          {pendiente && <label className="text-xs mt-1 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>Raciones del plato<input type="number" min={0.5} max={12} step={0.5} value={porciones} onChange={e => { setPorciones(Number(e.target.value) || 1); setSucio(true) }} className="w-16 text-sm p-1 text-right" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} /></label>}
          {plato.incompleto && <p className="text-xs mt-1" style={{ color: 'var(--warning, #b7791f)' }}>{sinEnlazar} ingrediente(s) sin enlazar: enlázalos o quítalos para poder aprobar.</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ingredientes</p>
        {lineas.map((l, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--text)' }}>{l.nombre_libre}</span>
              <input value={l.cantidad_gramos} disabled={!pendiente} onChange={e => cambiar(i, { cantidad_gramos: Number(e.target.value.replace(',', '.')) || 0 })} inputMode="decimal" aria-label={`Gramos de ${l.nombre_libre}`}
                className="w-20 text-sm p-1.5 text-right" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>g</span>
              <span className="text-xs w-24" style={{ color: l.alimento_id ? 'var(--text-muted)' : 'var(--warning, #b7791f)' }}>{l.alimento_id ? 'enlazado' : 'sin enlazar'}</span>
              {pendiente && <button type="button" className="text-xs underline" onClick={() => { setBuscando(buscando === i ? null : i); setQ(''); setSugeridos([]) }}>{l.alimento_id ? 'Cambiar' : 'Enlazar'}</button>}
              {pendiente && <button type="button" className="text-xs" aria-label={`Quitar ${l.nombre_libre}`} onClick={() => { setLineas(ls => ls.filter((_, k) => k !== i)); setSucio(true) }}>✕</button>}
            </div>
            {buscando === i && (
              <div className="ml-2 flex flex-col gap-1">
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar alimento…" className="text-sm p-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                {sugeridos.map(a => <button key={a.id} type="button" className="text-left text-sm py-1 px-2" style={{ background: 'var(--surface)', color: 'var(--text)' }} onClick={() => { cambiar(i, { alimento_id: a.id }); setBuscando(null); setQ('') }}>{a.nombre}</button>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {plato.pasos && <div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Preparación</p><p className="text-sm whitespace-pre-line mt-1" style={{ color: 'var(--text-secondary)' }}>{plato.pasos}</p></div>}

      {msg && <p className="text-sm" role={msg.tipo === 'error' ? 'alert' : 'status'} style={{ color: msg.tipo === 'error' ? 'var(--danger, #d4554a)' : 'var(--text)' }}>{msg.texto}</p>}

      {pendiente && (
        <div className="flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex flex-wrap gap-2">
            {sucio && <button type="button" disabled={ocupado} className="px-3 py-1.5 text-sm font-semibold" style={{ border: '1px solid var(--border)' }} onClick={() => { void guardar() }}>Guardar correcciones</button>}
            <button type="button" disabled={ocupado} className="px-3 py-1.5 text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--bg)' }} onClick={() => { void revisar('aprobar') }}>Aprobar</button>
          </div>
          <div className="flex gap-2">
            <input value={nota} onChange={e => setNota(e.target.value)} maxLength={500} placeholder="Nota para devolverlo (p. ej. «pon menos aceite»)" className="flex-1 text-sm p-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <button type="button" disabled={ocupado || !nota.trim()} className="px-3 py-1.5 text-sm font-semibold" style={{ border: '1px solid var(--border)' }} onClick={() => { void revisar('devolver') }}>Devolver</button>
          </div>
        </div>
      )}

      {aprobado && (
        <div className="flex flex-wrap items-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <label className="text-xs flex flex-col gap-1" style={{ color: 'var(--text-muted)' }}>Día<select value={dia} onChange={e => setDia(e.target.value)} className="text-sm p-1.5" style={{ background: 'var(--surface)', color: 'var(--text)' }}>{DIAS.map(d => <option key={d}>{d}</option>)}</select></label>
          <label className="text-xs flex flex-col gap-1" style={{ color: 'var(--text-muted)' }}>Franja<select value={franja} onChange={e => setFranja(e.target.value)} className="text-sm p-1.5" style={{ background: 'var(--surface)', color: 'var(--text)' }}>{FRANJAS.map(d => <option key={d}>{d}</option>)}</select></label>
          <label className="text-xs flex flex-col gap-1" style={{ color: 'var(--text-muted)' }}>Raciones<input type="number" min={0.25} max={12} step={0.25} value={raciones} onChange={e => setRaciones(Number(e.target.value) || 1)} className="w-20 text-sm p-1.5" style={{ background: 'var(--surface)', color: 'var(--text)' }} /></label>
          <button type="button" disabled={ocupado} className="px-3 py-1.5 text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--bg)' }} onClick={() => { void aDieta() }}>Añadir a su dieta</button>
        </div>
      )}
    </div>
  )
}
