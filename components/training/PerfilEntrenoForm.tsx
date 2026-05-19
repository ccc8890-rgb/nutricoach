'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import type { PerfilEntrenoCliente, SportModality, PlantillaEntrenoNivel } from '@/types'

const SPORT_MODALITY_LABELS: Record<SportModality, string> = {
  gym_estetica: 'Gimnasio — Estética',
  gym_fuerza: 'Gimnasio — Fuerza',
  funcional: 'Funcional',
  hyrox: 'Hyrox',
  ciclismo: 'Ciclismo',
  running: 'Running',
  hibrido: 'Híbrido',
  calistenia: 'Calistenia',
  natacion: 'Natación',
  triatlon: 'Triatlón',
}

const NIVEL_LABELS: Record<PlantillaEntrenoNivel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

const EQUIPO_OPCIONES = [
  'Barra olímpica', 'Mancuernas', 'Kettlebell', 'TRX / anillas', 'Máquinas cardio',
  'Máquinas musculación', 'Barras dominadas', 'Poleas', 'Cajón', 'Banda elástica',
  'Triatlón (bici+natación)', 'Pista atletismo', 'Cinta correr', 'Solo peso corporal',
]

type Partial<T> = { [K in keyof T]?: T[K] }
type FormData = Partial<PerfilEntrenoCliente>

export default function PerfilEntrenoForm({ clienteId }: { clienteId: string }) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState<FormData>({
    dias_disponibles: 3,
    capacidad_recuperacion: 'media',
    respuesta_a_volumen: 'medio',
    respuesta_psicologica: 'rutina',
    plateau_detectado: false,
    semanas_sin_progresion: 0,
    equipo_disponible: [],
    patron_lesiones: [],
    fisio_informe: [],
    analisis_sangre: [],
    apple_health_enabled: false,
  })

  useEffect(() => {
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/perfil-entreno/${clienteId}`, {
        headers: { 'Cookie': document.cookie },
      })
      if (res.ok) {
        const { perfil } = await res.json()
        if (perfil) setForm(perfil)
      }
      setLoading(false)
    }
    cargar()
  }, [clienteId])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleEquipo(item: string) {
    setForm(prev => {
      const arr = prev.equipo_disponible ?? []
      return {
        ...prev,
        equipo_disponible: arr.includes(item)
          ? arr.filter(e => e !== item)
          : [...arr, item],
      }
    })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    try {
      const res = await fetch(`/api/perfil-entreno/${clienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Error al guardar')
      addToast({ type: 'success', title: 'Perfil guardado', message: 'Perfil atleta actualizado correctamente' })
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar el perfil' })
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="space-y-6">

      {/* ── Modalidad y Objetivo ── */}
      <section className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Modalidad y objetivo</h3>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Modalidad deportiva</span>
            <select
              className="input"
              value={form.sport_modality ?? ''}
              onChange={e => set('sport_modality', (e.target.value || undefined) as SportModality | undefined)}
            >
              <option value="">Sin especificar</option>
              {(Object.entries(SPORT_MODALITY_LABELS) as [SportModality, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Nivel</span>
            <select
              className="input"
              value={form.nivel ?? ''}
              onChange={e => set('nivel', (e.target.value || undefined) as PlantillaEntrenoNivel | undefined)}
            >
              <option value="">Sin especificar</option>
              {(Object.entries(NIVEL_LABELS) as [PlantillaEntrenoNivel, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Objetivo específico (texto libre)</span>
          <input
            className="input"
            type="text"
            placeholder="Ej: Bajar 5kg, correr maratón en <4h, subir dominadas…"
            value={form.objetivo_especifico ?? ''}
            onChange={e => set('objetivo_especifico', e.target.value || undefined)}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Días disponibles / semana</span>
            <input
              className="input"
              type="number" min={1} max={7}
              value={form.dias_disponibles ?? 3}
              onChange={e => set('dias_disponibles', Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Mejor momento de sesión</span>
            <select
              className="input"
              value={form.mejor_momento_sesion ?? ''}
              onChange={e => set('mejor_momento_sesion', (e.target.value || undefined) as FormData['mejor_momento_sesion'])}
            >
              <option value="">Sin preferencia</option>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
              <option value="noche">Noche</option>
              <option value="variable">Variable</option>
            </select>
          </label>
        </div>
      </section>

      {/* ── Métricas de rendimiento ── */}
      <section className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Métricas de rendimiento</h3>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">FTP (W)</span>
            <input className="input" type="number" min={0}
              value={form.ftp_watts ?? ''}
              onChange={e => set('ftp_watts', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">VDOT</span>
            <input className="input" type="number" min={0} step={0.1}
              value={form.vdot ?? ''}
              onChange={e => set('vdot', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">VO2max estimado</span>
            <input className="input" type="number" min={0} step={0.1}
              value={form.vo2max_estimado ?? ''}
              onChange={e => set('vo2max_estimado', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">RM Sentadilla (kg)</span>
            <input className="input" type="number" min={0}
              value={form.rm_sentadilla_kg ?? ''}
              onChange={e => set('rm_sentadilla_kg', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">RM Banca (kg)</span>
            <input className="input" type="number" min={0}
              value={form.rm_banca_kg ?? ''}
              onChange={e => set('rm_banca_kg', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">RM Peso muerto (kg)</span>
            <input className="input" type="number" min={0}
              value={form.rm_peso_muerto_kg ?? ''}
              onChange={e => set('rm_peso_muerto_kg', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Dominadas máx. reps</span>
            <input className="input" type="number" min={0}
              value={form.dominadas_max_reps ?? ''}
              onChange={e => set('dominadas_max_reps', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Adherencia histórica (%)</span>
            <input className="input" type="number" min={0} max={100}
              value={form.adherencia_historica_pct ?? ''}
              onChange={e => set('adherencia_historica_pct', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
        </div>
      </section>

      {/* ── Capacidades y psicología ── */}
      <section className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Capacidades y psicología</h3>

        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Capacidad de recuperación</span>
            <select className="input" value={form.capacidad_recuperacion ?? 'media'}
              onChange={e => set('capacidad_recuperacion', e.target.value as FormData['capacidad_recuperacion'])}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Respuesta a volumen</span>
            <select className="input" value={form.respuesta_a_volumen ?? 'medio'}
              onChange={e => set('respuesta_a_volumen', e.target.value as FormData['respuesta_a_volumen'])}>
              <option value="bajo">Bajo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Respuesta psicológica</span>
            <select className="input" value={form.respuesta_psicologica ?? 'rutina'}
              onChange={e => set('respuesta_psicologica', e.target.value as FormData['respuesta_psicologica'])}>
              <option value="variedad">Le motiva la variedad</option>
              <option value="rutina">Le da seguridad la rutina</option>
              <option value="competicion">Le motiva la competición</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded"
              checked={form.plateau_detectado ?? false}
              onChange={e => set('plateau_detectado', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Plateau detectado</span>
          </label>

          {form.plateau_detectado && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Semanas sin progresión</span>
              <input className="input w-20" type="number" min={0}
                value={form.semanas_sin_progresion ?? 0}
                onChange={e => set('semanas_sin_progresion', Number(e.target.value))}
              />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Restricciones temporales</span>
          <input className="input" type="text"
            placeholder="Ej: Viajes de trabajo frecuentes, horario nocturno…"
            value={form.restricciones_temporales ?? ''}
            onChange={e => set('restricciones_temporales', e.target.value || undefined)}
          />
        </label>
      </section>

      {/* ── Equipo disponible ── */}
      <section className="card p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Equipo disponible</h3>
        <div className="flex flex-wrap gap-2">
          {EQUIPO_OPCIONES.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => toggleEquipo(item)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${(form.equipo_disponible ?? []).includes(item)
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {/* ── Wearables ── */}
      <section className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Wearables y datos biométricos</h3>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">HRV baseline (ms)</span>
            <input className="input" type="number" min={0}
              value={form.hrv_baseline ?? ''}
              onChange={e => set('hrv_baseline', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">HRV fecha último</span>
            <input className="input" type="date"
              value={form.hrv_fecha_ultimo ?? ''}
              onChange={e => set('hrv_fecha_ultimo', e.target.value || undefined)}
            />
          </label>
          <label className="flex items-center gap-2 pt-4">
            <input type="checkbox" className="rounded"
              checked={form.apple_health_enabled ?? false}
              onChange={e => set('apple_health_enabled', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Apple Health activo</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Garmin User ID</span>
            <input className="input" type="text"
              value={form.garmin_user_id ?? ''}
              onChange={e => set('garmin_user_id', e.target.value || undefined)}
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Strava Athlete ID</span>
            <input className="input" type="text"
              value={form.strava_athlete_id ?? ''}
              onChange={e => set('strava_athlete_id', e.target.value || undefined)}
              placeholder="—"
            />
          </label>
        </div>
      </section>

      {/* ── Patrón de lesiones ── */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Patrón de lesiones</h3>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => set('patron_lesiones', [
              ...(form.patron_lesiones ?? []),
              { zona: '', frecuencia: '', ultima_vez: '' }
            ])}
          >
            + Añadir
          </button>
        </div>

        {(form.patron_lesiones ?? []).length === 0 && (
          <p className="text-xs text-gray-400">Sin lesiones registradas</p>
        )}

        {(form.patron_lesiones ?? []).map((lesion, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input className="input flex-1" placeholder="Zona (rodilla, hombro…)"
              value={lesion.zona}
              onChange={e => {
                const arr = [...(form.patron_lesiones ?? [])]
                arr[i] = { ...arr[i], zona: e.target.value }
                set('patron_lesiones', arr)
              }}
            />
            <input className="input flex-1" placeholder="Frecuencia"
              value={lesion.frecuencia}
              onChange={e => {
                const arr = [...(form.patron_lesiones ?? [])]
                arr[i] = { ...arr[i], frecuencia: e.target.value }
                set('patron_lesiones', arr)
              }}
            />
            <input className="input w-36" type="date"
              value={lesion.ultima_vez}
              onChange={e => {
                const arr = [...(form.patron_lesiones ?? [])]
                arr[i] = { ...arr[i], ultima_vez: e.target.value }
                set('patron_lesiones', arr)
              }}
            />
            <button type="button" className="text-gray-400 hover:text-red-500 mt-2"
              onClick={() => set('patron_lesiones', (form.patron_lesiones ?? []).filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
      </section>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar perfil atleta'}
        </button>
      </div>
    </form>
  )
}
