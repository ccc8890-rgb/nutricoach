// app/clientes/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/lib/useDebounce'
import Link from 'next/link'
import { ArrowLeft, Check, Link as LinkIcon, Plus, SpinnerGap, UsersThree } from '@phosphor-icons/react'
import {
  type ClienteRow, type Filtro, type FiltroAlta, type SortKey, type ToolbarCounts,
  calcularScoreAdherencia, esPredictorBaja, calcularDeudaAtencion,
  aplicarFiltros, aplicarSort, diasHastaCaducidad,
} from '@/lib/clientes-utils'
import ClientesToolbar from '@/components/clientes/ClientesToolbar'
import ClientesTabla from '@/components/clientes/ClientesTabla'
import ClientesListaMobile from '@/components/clientes/ClientesListaMobile'
import RespuestasClientes from '@/components/RespuestasClientes'
import type { RespuestaCliente } from '@/types'

type TabActiva = 'clientes' | 'formularios'
type PlanRow = { cliente_id: string }
type TareaRow = { cliente_id: string | null }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [invitando, setInvitando] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  // Tabs
  const [tabActiva, setTabActiva] = useState<TabActiva>('clientes')
  const [respuestas, setRespuestas] = useState<RespuestaCliente[]>([])
  const [respuestasLoading, setRespuestasLoading] = useState(false)
  const [respuestasNoLeidas, setRespuestasNoLeidas] = useState(0)
  const [formulariosCargados, setFormulariosCargados] = useState(false)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 250)
  const [filtro, setFiltro] = useState<Filtro>('atencion')
  const [caducaPronte, setCaducaPronte] = useState(false)
  const [filtroAlta, setFiltroAlta] = useState<FiltroAlta>(null)
  const [filtroRevisiones, setFiltroRevisiones] = useState(false)
  const [filtroChats, setFiltroChats] = useState(false)
  const [sort, setSort] = useState<SortKey>('checkin')

  const loadRespuestas = useCallback(async () => {
    setRespuestasLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('respuestas_clientes')
        .select('*, cuestionario:cuestionarios(titulo)')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
      setRespuestas(data ?? [])
      const unread = (data ?? []).filter((r: RespuestaCliente) => !r.leida).map((r: RespuestaCliente) => r.id)
      if (unread.length > 0) {
        await supabase.from('respuestas_clientes').update({ leida: true, updated_at: new Date().toISOString() }).in('id', unread)
        setRespuestasNoLeidas(0)
      }
    } catch (e) {
      console.error('[clientes] error cargando formularios:', e)
    } finally {
      setRespuestasLoading(false)
      setFormulariosCargados(true)
    }
  }, [])

  useEffect(() => {
    if (tabActiva === 'formularios') loadRespuestas()
  }, [tabActiva, loadRespuestas])

  async function handleInvitar() {
    setInvitando('loading')
    try {
      const res = await fetch('/api/invitaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.url) { await navigator.clipboard.writeText(data.url); setInvitando('done'); setTimeout(() => setInvitando('idle'), 2000) }
      else { setInvitando('error'); setTimeout(() => setInvitando('idle'), 2000) }
    } catch { setInvitando('error'); setTimeout(() => setInvitando('idle'), 2000) }
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data, error } = await supabase
          .from('clientes')
          .select('id, activo, objetivo, nivel, peso_inicial, fecha_proxima_revision, revisado_por_coach, tipo_membresia, fecha_inicio_membresia, fecha_fin_membresia, profile:profiles!profile_id(nombre, apellidos, email)')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })

        if (error) { console.error('[clientes] query error:', error.message); setLoading(false); return }

        const mapped: ClienteRow[] = (data ?? []).map(c => ({
          ...c,
          profile: Array.isArray(c.profile) ? c.profile[0] : c.profile,
        }))

        if (mapped.length > 0) {
          const ids = mapped.map(c => c.id)
          const hace7d = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
          const hace90d = new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0]

          const [checkinsRes, dietasRes, entrenosRes, tareasRes, chatsRes, comidasRes, sesionesRes, chatCoachRes] = await Promise.all([
            supabase.from('checkins').select('cliente_id, fecha, peso').in('cliente_id', ids).gte('fecha', hace90d).order('fecha', { ascending: false }),
            supabase.from('planes_nutricion').select('cliente_id').in('cliente_id', ids).eq('activo', true),
            supabase.from('planes_entrenamiento').select('cliente_id').in('cliente_id', ids).eq('activo', true),
            supabase.from('agente_tareas').select('cliente_id').in('cliente_id', ids).eq('estado', 'pendiente'),
            supabase.from('chat_mensajes').select('cliente_id').in('cliente_id', ids).eq('remitente', 'cliente').eq('leido', false),
            supabase.from('registro_comidas_dia').select('cliente_id').in('cliente_id', ids).gte('fecha', hace7d).in('estado', ['hecha', 'cambiada']),
            supabase.from('registros_entreno').select('cliente_id').in('cliente_id', ids).gte('fecha', hace7d),
            supabase.from('chat_mensajes').select('cliente_id').in('cliente_id', ids).eq('remitente', 'coach').gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
          ])

          const ultimoCheckin = new Map<string, string>()
          const tienePeso7d = new Set<string>()
          for (const ch of checkinsRes.data ?? []) {
            if (!ultimoCheckin.has(ch.cliente_id)) ultimoCheckin.set(ch.cliente_id, ch.fecha)
            if (ch.peso && ch.fecha >= hace7d) tienePeso7d.add(ch.cliente_id)
          }

          const dietasActivas = new Set(((dietasRes.data ?? []) as PlanRow[]).map(p => p.cliente_id))
          const entrenosActivos = new Set(((entrenosRes.data ?? []) as PlanRow[]).map(p => p.cliente_id))

          const tareasPor = new Map<string, number>()
          for (const t of (tareasRes.data ?? []) as TareaRow[]) {
            if (t.cliente_id) tareasPor.set(t.cliente_id, (tareasPor.get(t.cliente_id) ?? 0) + 1)
          }

          const chatsSinLeer = new Map<string, number>()
          for (const m of chatsRes.data ?? []) {
            chatsSinLeer.set(m.cliente_id, (chatsSinLeer.get(m.cliente_id) ?? 0) + 1)
          }

          const comidasHecha = new Map<string, number>()
          for (const r of comidasRes.data ?? []) {
            comidasHecha.set(r.cliente_id, (comidasHecha.get(r.cliente_id) ?? 0) + 1)
          }

          const sesionesComp = new Map<string, number>()
          for (const s of sesionesRes.data ?? []) {
            sesionesComp.set(s.cliente_id, (sesionesComp.get(s.cliente_id) ?? 0) + 1)
          }

          const interaccionesCoach = new Map<string, number>()
          for (const m of chatCoachRes.data ?? []) {
            interaccionesCoach.set(m.cliente_id, (interaccionesCoach.get(m.cliente_id) ?? 0) + 1)
          }

          const ahora = Date.now()
          for (const c of mapped) {
            const fechaCheck = ultimoCheckin.get(c.id)
            c.ultimo_checkin = fechaCheck ?? null
            c.dias_sin_checkin = fechaCheck ? Math.floor((ahora - new Date(fechaCheck).getTime()) / 86_400_000) : 999
            c.tiene_dieta_activa = dietasActivas.has(c.id)
            c.tiene_entreno_activo = entrenosActivos.has(c.id)
            c.tareas_ia_pendientes = tareasPor.get(c.id) ?? 0
            c.chats_sin_leer = chatsSinLeer.get(c.id) ?? 0
            c.comidas_hecha_7d = comidasHecha.get(c.id) ?? 0
            c.sesiones_completadas_7d = sesionesComp.get(c.id) ?? 0
            c.tiene_peso_7d = tienePeso7d.has(c.id)
            c.interacciones_coach_7d = interaccionesCoach.get(c.id) ?? 0
            c.score_adherencia = calcularScoreAdherencia(c)
            c.deuda_atencion = calcularDeudaAtencion(c)
          }
          // predictor baja necesita score_adherencia calculado
          for (const c of mapped) {
            c.es_predictor_baja = esPredictorBaja(c)
          }
        }

        setClientes(mapped)

        // Conteo badge para tab Formularios
        const { count: noLeidas } = await supabase
          .from('respuestas_clientes')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', user.id)
          .eq('leida', false)
        setRespuestasNoLeidas(noLeidas ?? 0)
      } catch (e) {
        console.error('[clientes] error:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  const hoy = Date.now()

  const counts: ToolbarCounts = useMemo(() => ({
    total: clientes.length,
    atencion: clientes.filter(c => c.revisado_por_coach === false || (c.tareas_ia_pendientes ?? 0) > 0 || (c.dias_sin_checkin ?? 0) > 4).length,
    nuevos: clientes.filter(c => c.revisado_por_coach === false).length,
    riesgo: clientes.filter(c => (c.dias_sin_checkin ?? 0) > 10).length,
    sin_checkin: clientes.filter(c => (c.dias_sin_checkin ?? 0) > 4).length,
    activos: clientes.filter(c => c.activo).length,
    caduca_pronto: clientes.filter(c => { const d = diasHastaCaducidad(c); return d !== null && d >= 0 && d <= 30 }).length,
    chats_sin_leer: clientes.filter(c => (c.chats_sin_leer ?? 0) > 0).length,
    revisiones_proximas: clientes.filter(c => {
      if (!c.fecha_proxima_revision) return false
      const d = Math.floor((new Date(c.fecha_proxima_revision).getTime() - hoy) / 86_400_000)
      return d >= 0 && d <= 14
    }).length,
  }), [clientes, hoy])

  const filtrados = useMemo(() =>
    aplicarSort(
      aplicarFiltros(clientes, filtro, busquedaDebounced, caducaPronte, filtroAlta, filtroRevisiones, filtroChats),
      sort
    ),
    [clientes, filtro, busquedaDebounced, caducaPronte, filtroAlta, filtroRevisiones, filtroChats, sort]
  )

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 mb-5">
        {/* Back button — visible en móvil */}
        <Link
          href="/dashboard"
          className="lg:hidden flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </Link>

        <div className="hidden lg:block">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text)' }}>Clientes</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInvitar}
            className="btn-secondary btn-sm"
            disabled={invitando === 'loading'}
          >
            {invitando === 'loading' ? <SpinnerGap size={14} className="animate-spin" /> : invitando === 'done' ? <Check size={14} /> : <LinkIcon size={14} />}
            <span className="hidden sm:inline">{invitando === 'done' ? 'Copiado' : 'Invitar'}</span>
          </button>
          <Link href="/clientes/nuevo" className="btn-primary btn-sm">
            <Plus size={14} />
            <span className="hidden sm:inline">Nuevo</span>
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'clientes', label: 'Clientes', count: clientes.length },
          { key: 'formularios', label: 'Formularios', count: respuestasNoLeidas },
        ] as { key: TabActiva; label: string; count: number }[]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTabActiva(key)}
            className="relative px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tabActiva === key ? 'var(--text)' : 'var(--text-muted)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: tabActiva === key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {label}
            {count > 0 && (
              <span
                className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center inline-block"
                style={{
                  background: key === 'formularios' ? 'var(--error)' : 'var(--accent)',
                  color: '#fff',
                }}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tabActiva === 'formularios' ? (
        <div className="max-w-4xl">
          {!formulariosCargados || respuestasLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl p-4 flex items-center gap-3 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-3 h-3 rounded-full skeleton flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 skeleton rounded w-40" />
                    <div className="h-3 skeleton rounded w-56 max-w-full" />
                  </div>
                  <div className="h-6 w-20 skeleton rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <RespuestasClientes respuestas={respuestas} onActualizar={loadRespuestas} />
          )}
        </div>
      ) : (
        <>
      {/* Toolbar */}
      <ClientesToolbar
        busqueda={busqueda} onBusqueda={setBusqueda}
        filtro={filtro} onFiltro={setFiltro}
        caducaPronte={caducaPronte} onCaducaPronte={setCaducaPronte}
        filtroAlta={filtroAlta} onFiltroAlta={setFiltroAlta}
        filtroRevisiones={filtroRevisiones} onFiltroRevisiones={setFiltroRevisiones}
        filtroChats={filtroChats} onFiltroChats={setFiltroChats}
        sort={sort} onSort={setSort}
        counts={counts}
      />

      {/* Lista */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl p-3 flex items-center gap-3 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-7 h-7 rounded-lg skeleton flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 skeleton rounded w-40" />
                <div className="h-2 skeleton rounded w-56 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl text-center py-16" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <UsersThree size={42} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--text)' }}>No hay clientes en este filtro</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Cambia el filtro o añade un nuevo cliente.</p>
          <Link href="/clientes/nuevo" className="btn-primary mt-4"><Plus size={16} /> Añadir cliente</Link>
        </div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden lg:block">
            <ClientesTabla clientes={filtrados} sort={sort} onSort={setSort} />
          </div>
          {/* Mobile: lista */}
          <div className="lg:hidden">
            <ClientesListaMobile clientes={filtrados} />
          </div>
        </>
      )}
        </>
      )}
    </div>
  )
}
