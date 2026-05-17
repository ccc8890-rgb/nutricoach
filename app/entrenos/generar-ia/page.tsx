'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Loader2, ChevronDown, ChevronUp, Dumbbell, Clock, Calendar, CheckCircle } from 'lucide-react'

const DISCIPLINAS = [
  { value: 'hyrox', label: 'HYROX', emoji: '🏋️' },
  { value: 'running', label: 'Running', emoji: '🏃' },
  { value: 'hibrido', label: 'Híbrido', emoji: '⚡' },
  { value: 'ciclismo', label: 'Ciclismo', emoji: '🚴' },
  { value: 'triatlon', label: 'Triatlón', emoji: '🔱' },
  { value: 'fuerza', label: 'Fuerza', emoji: '💪' },
  { value: 'general', label: 'General', emoji: '🎯' },
]

const NIVELES = ['principiante', 'intermedio', 'avanzado']

const CONDICIONES = [
  'lesión rodilla', 'tendinitis', 'dolor lumbar', 'lesión hombro',
  'fascitis plantar', 'sin equipamiento sled', 'sin skierg', 'embarazo',
  'hipertensión', 'diabetes', 'sobrepeso',
]

const SEMANAS_OPCIONES = [4, 6, 8, 10, 12, 16]

type Sesion = {
  dia: string
  tipo: string
  duracion_min: number
  descripcion: string
  ejercicios: { nombre: string; series: number; reps_o_duracion: string; intensidad: string; notas: string }[]
}

type Semana = {
  numero: number
  objetivo: string
  sesiones: Sesion[]
}

type Plan = {
  semanas: Semana[]
  notas_generales: string
  progresion: string
}

const TIPO_COLOR: Record<string, string> = {
  fuerza: '#7C3AED',
  resistencia: '#059669',
  hiit: '#DC2626',
  especifico: '#8E8E93',
  descanso: '#6B7280',
}

function GenerarIAForm() {
  const params = useSearchParams()
  const router = useRouter()
  const clienteParam = params.get('cliente')

  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([])
  const [form, setForm] = useState({
    cliente_id: clienteParam ?? '',
    disciplina_principal: 'hyrox',
    nivel: 'intermedio',
    objetivo: '',
    semanas_plan: 12,
    fecha_competicion: '',
  })
  const [condicionesSelec, setCondicionesSelec] = useState<string[]>([])
  const [generando, setGenerando] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [meta, setMeta] = useState<{ disciplina: string; semanas: number; fichas_kb: boolean } | null>(null)
  const [error, setError] = useState('')
  const [semanaAbierta, setSemanaAbierta] = useState<number>(1)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('clientes')
        .select('id, profile:profiles!profile_id(nombre, apellidos)')
        .eq('coach_id', user.id)
        .eq('activo', true)
        .then(({ data }) => {
          setClientes((data ?? []).map((c: any) => ({
            id: c.id,
            nombre: `${c.profile?.nombre ?? ''} ${c.profile?.apellidos ?? ''}`.trim() || 'Sin nombre',
          })))
        })
    })
  }, [])

  function set(k: string, v: string | number) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function toggleCondicion(c: string) {
    setCondicionesSelec(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  async function generar() {
    if (!form.cliente_id || !form.objetivo.trim()) {
      setError('Selecciona un cliente y escribe el objetivo')
      return
    }
    setError('')
    setGenerando(true)
    setPlan(null)

    const res = await fetch('/api/entrenos/generar-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        condiciones_especiales: condicionesSelec.length > 0 ? condicionesSelec : undefined,
      }),
    })

    const json = await res.json()
    setGenerando(false)

    if (!res.ok) {
      setError(json.error ?? 'Error al generar el plan')
      return
    }

    setPlan(json.plan)
    setMeta(json.metadata)
    setSemanaAbierta(1)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/entrenos" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Generar plan con IA</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Plan periodizado basado en conocimiento científico
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card space-y-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Configuración</p>

            {/* Cliente */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Cliente *</label>
              <select className="input" value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            {/* Disciplina */}
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Disciplina principal *</label>
              <div className="grid grid-cols-2 gap-1.5">
                {DISCIPLINAS.map(d => (
                  <button key={d.value} onClick={() => set('disciplina_principal', d.value)}
                    className="text-xs px-2 py-2 rounded-lg border font-medium text-left flex items-center gap-1.5"
                    style={form.disciplina_principal === d.value
                      ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                      : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                    <span>{d.emoji}</span> {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nivel */}
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Nivel</label>
              <div className="flex gap-1.5">
                {NIVELES.map(n => (
                  <button key={n} onClick={() => set('nivel', n)}
                    className="flex-1 text-xs py-1.5 rounded-lg border font-medium capitalize"
                    style={form.nivel === n
                      ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                      : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Objetivo */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Objetivo *</label>
              <textarea className="input resize-none h-20 text-sm"
                placeholder="Ej: Completar HYROX en menos de 70 min, mejorar base aeróbica, preparar 10K..."
                value={form.objetivo}
                onChange={e => set('objetivo', e.target.value)} />
            </div>

            {/* Semanas */}
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                Semanas de plan: <strong>{form.semanas_plan}</strong>
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {SEMANAS_OPCIONES.map(s => (
                  <button key={s} onClick={() => set('semanas_plan', s)}
                    className="text-xs px-3 py-1.5 rounded-full border font-medium"
                    style={form.semanas_plan === s
                      ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                      : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                    {s}s
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha competición */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Fecha de competición (opcional)</label>
              <input type="date" className="input" value={form.fecha_competicion}
                onChange={e => set('fecha_competicion', e.target.value)} />
            </div>

            {/* Condiciones especiales */}
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Condiciones especiales</label>
              <div className="flex flex-wrap gap-1.5">
                {CONDICIONES.map(c => (
                  <button key={c} onClick={() => toggleCondicion(c)}
                    className="text-xs px-2.5 py-1 rounded-full border"
                    style={condicionesSelec.includes(c)
                      ? { background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' }
                      : { background: 'var(--surface)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button onClick={generar} disabled={generando || !form.cliente_id || !form.objetivo.trim()}
              className="btn btn-primary w-full disabled:opacity-50">
              {generando
                ? <><Loader2 size={16} className="animate-spin" /> Generando plan… (30-60s)</>
                : <><Sparkles size={16} /> Generar plan con IA</>}
            </button>

            {generando && (
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                DeepSeek está leyendo las fichas científicas y construyendo tu plan periodizado…
              </p>
            )}
          </div>
        </div>

        {/* Plan generado */}
        <div className="lg:col-span-3">
          {!plan && !generando && (
            <div className="card h-full flex flex-col items-center justify-center py-16 text-center">
              <Dumbbell size={40} className="mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                El plan aparecerá aquí
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Configura el perfil y pulsa &ldquo;Generar&rdquo;
              </p>
            </div>
          )}

          {generando && (
            <div className="card h-full flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-green-100 border-t-green-500 animate-spin" />
                <Sparkles size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>Construyendo tu plan…</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Consultando base de conocimiento científica
                </p>
              </div>
            </div>
          )}

          {plan && (
            <div className="space-y-3">
              {/* Header del plan */}
              <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), #15803d)', border: 'none', color: 'white' }}>
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles size={18} />
                  <p className="font-semibold">Plan generado con IA</p>
                  {meta?.fichas_kb && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto"
                      style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <CheckCircle size={11} className="inline mr-1" />
                      Basado en evidencia científica
                    </span>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-green-100">
                  <span className="flex items-center gap-1"><Calendar size={13} /> {meta?.semanas} semanas</span>
                  <span className="capitalize">{meta?.disciplina}</span>
                </div>
                {plan.progresion && (
                  <p className="text-xs text-green-100 mt-2 leading-relaxed">{plan.progresion}</p>
                )}
              </div>

              {/* Semanas */}
              {plan.semanas?.map(semana => (
                <div key={semana.numero} className="card !p-0 overflow-hidden">
                  <button
                    onClick={() => setSemanaAbierta(semanaAbierta === semana.numero ? 0 : semana.numero)}
                    className="w-full flex items-center justify-between p-4 text-left"
                    style={{ borderBottom: semanaAbierta === semana.numero ? '1px solid var(--border)' : 'none' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-1 rounded"
                        style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                        S{semana.numero}
                      </span>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                          Semana {semana.numero}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{semana.objetivo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {semana.sesiones?.length ?? 0} sesiones
                      </span>
                      {semanaAbierta === semana.numero
                        ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </button>

                  {semanaAbierta === semana.numero && semana.sesiones && (
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {semana.sesiones.map((sesion, si) => (
                        <div key={si} className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                              {sesion.dia}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                              style={{
                                background: (TIPO_COLOR[sesion.tipo] ?? '#6B7280') + '20',
                                color: TIPO_COLOR[sesion.tipo] ?? '#6B7280',
                              }}>
                              {sesion.tipo}
                            </span>
                            {sesion.duracion_min > 0 && (
                              <span className="text-xs flex items-center gap-1 ml-auto" style={{ color: 'var(--text-muted)' }}>
                                <Clock size={11} /> {sesion.duracion_min} min
                              </span>
                            )}
                          </div>
                          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                            {sesion.descripcion}
                          </p>
                          {sesion.ejercicios?.length > 0 && sesion.tipo !== 'descanso' && (
                            <div className="space-y-1.5">
                              {sesion.ejercicios.map((ej, ei) => (
                                <div key={ei} className="flex items-start gap-2 text-xs p-2 rounded-lg"
                                  style={{ background: 'var(--surface)' }}>
                                  <span className="font-medium flex-1" style={{ color: 'var(--text)' }}>
                                    {ej.nombre}
                                  </span>
                                  <div className="flex gap-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                    {ej.series > 0 && <span>{ej.series}×{ej.reps_o_duracion}</span>}
                                    {ej.intensidad && (
                                      <span className="px-1.5 py-0.5 rounded font-medium"
                                        style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                                        {ej.intensidad}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Notas generales */}
              {plan.notas_generales && (
                <div className="card" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>Notas del coach IA</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{plan.notas_generales}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GenerarIAPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
      </div>
    }>
      <GenerarIAForm />
    </Suspense>
  )
}
