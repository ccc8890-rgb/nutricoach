'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, ChevronDown, ChevronUp, User, Utensils, ExternalLink, Dumbbell } from 'lucide-react'
import PlantillaEntrenoSelector from '@/components/training/PlantillaEntrenoSelector'
import type { PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio } from '@/types'

interface OnboardingData {
  objetivo: string
  actividad_base: string
  dias_entreno: number
  tipo_entreno: string[]
  duracion_sesion_min: number
  restricciones: string[]
  alimentos_no_gustan: string
  nivel_cocina: string
  tiempo_cocina_min: number
  presupuesto_semanal_eur: number | null
}

interface PlanInicial {
  kcal_objetivo: number
  macros: { proteinas_g: number; carbos_g: number; grasas_g: number }
  distribucion_comidas: { nombre: string; porcentaje_kcal: number; kcal: number; hora_sugerida: string }[]
  recomendaciones: string[]
  notas_coach: string
}

interface ClienteData {
  id: string
  profiles: { nombre: string; apellidos: string; email: string } | null
  objetivo: string
  peso_inicial: number
  altura: number
  edad: number
  sexo: string
  revisado_por_coach: boolean
}

const OBJETIVO_LABEL: Record<string, string> = {
  perder_grasa: 'Perder grasa',
  ganar_musculo: 'Ganar músculo',
  rendimiento: 'Rendimiento deportivo',
  mantener: 'Mantener peso',
  salud_general: 'Salud general',
}

const ACTIVIDAD_LABEL: Record<string, string> = {
  sedentario: 'Sedentario',
  ligero: 'Ligeramente activo',
  moderado: 'Moderadamente activo',
  activo: 'Activo',
  muy_activo: 'Muy activo',
}

export default function RevisarPlanPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [cliente, setCliente] = useState<ClienteData | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null)
  const [plan, setPlan] = useState<PlanInicial | null>(null)
  const [loading, setLoading] = useState(true)
  const [aprobando, setAprobando] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [creandoDieta, setCreandoDieta] = useState(false)
  const [dietaCreada, setDietaCreada] = useState<{ id: string } | null>(null)
  const [errorDieta, setErrorDieta] = useState<string | null>(null)
  const [showSelectorEntreno, setShowSelectorEntreno] = useState(false)
  const [plantillaSeleccionadaEntreno, setPlantillaSeleccionadaEntreno] = useState<PlantillaEntrenamiento | null>(null)
  const [creandoEntreno, setCreandoEntreno] = useState(false)
  const [entrenoCreado, setEntrenoCreado] = useState<{ id: string } | null>(null)
  const [errorEntreno, setErrorEntreno] = useState<string | null>(null)
  const [reintentandoPlan, setReintentandoPlan] = useState(false)

  useEffect(() => {
    const id = params.id as string
    Promise.all([
      supabase.from('clientes').select('*, profiles(nombre, apellidos, email)').eq('id', id).single(),
      supabase.from('onboarding_responses').select('*').eq('cliente_id', id).single(),
      supabase.from('registros_ia').select('respuesta_json').eq('cliente_id', id).eq('tipo', 'plan_inicial').order('created_at', { ascending: false }).limit(1).single(),
    ]).then(([{ data: c }, { data: o }, { data: r }]) => {
      setCliente(c as ClienteData)
      setOnboarding(o as OnboardingData)
      if (r?.respuesta_json) setPlan(r.respuesta_json as PlanInicial)
      setLoading(false)
    })
  }, [params.id])

  const reintentarPlan = async () => {
    setReintentandoPlan(true)
    const { data: r } = await supabase
      .from('registros_ia')
      .select('respuesta_json')
      .eq('cliente_id', params.id as string)
      .eq('tipo', 'plan_inicial')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (r?.respuesta_json) setPlan(r.respuesta_json as PlanInicial)
    setReintentandoPlan(false)
  }

  const aprobar = async () => {
    setAprobando(true)
    await supabase
      .from('clientes')
      .update({ revisado_por_coach: true, activo: true })
      .eq('id', params.id as string)
    router.push(`/clientes/${params.id}`)
  }

  const crearPlan = async () => {
    if (!plan) return
    if (!plan.distribucion_comidas?.length) {
      setErrorDieta('El plan no tiene comidas definidas. Espera a que la IA termine de generarlo o recarga.')
      return
    }
    setCreandoDieta(true)
    setErrorDieta(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: planCreado, error: errorPlan } = await supabase
        .from('planes_nutricion')
        .insert({
          coach_id: user.id,
          cliente_id: params.id as string,
          nombre: `Plan inicial - ${cliente?.profiles ? `${cliente.profiles.nombre} ${cliente.profiles.apellidos}` : 'Cliente'}`,
          descripcion: plan.notas_coach || null,
          kcal_objetivo: plan.kcal_objetivo,
          proteinas_objetivo: plan.macros.proteinas_g,
          carbohidratos_objetivo: plan.macros.carbos_g,
          grasas_objetivo: plan.macros.grasas_g,
          activo: true,
          generado_por_ia: true,
        })
        .select('id')
        .single()

      if (errorPlan || !planCreado) throw new Error(errorPlan?.message ?? 'Error al crear el plan')

      const comidas = plan.distribucion_comidas.map((item, index) => ({
        plan_id: planCreado.id,
        nombre: item.nombre,
        orden: index,
        hora_sugerida: item.hora_sugerida,
      }))

      const { error: errorComidas } = await supabase.from('comidas').insert(comidas)
      if (errorComidas) throw new Error(errorComidas.message)

      setDietaCreada({ id: planCreado.id })
    } catch (err) {
      setErrorDieta(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setCreandoDieta(false)
    }
  }

  const crearPlanDesdeEntrenamiento = async (plantilla: PlantillaEntrenamiento) => {
    setCreandoEntreno(true)
    setErrorEntreno(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: plan, error } = await supabase.from('planes_entrenamiento').insert({
        coach_id: user.id,
        cliente_id: params.id as string,
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion ?? null,
        duracion_semanas: plantilla.duracion_semanas ?? null,
      }).select().single()

      if (error || !plan) throw new Error(error?.message ?? 'Error al crear el plan de entrenamiento')

      const sesiones = (plantilla.sesiones ?? []) as PlantillaSesion[]
      if (!sesiones.length) {
        setErrorEntreno('La plantilla seleccionada no tiene sesiones. Elige otra plantilla.')
        setCreandoEntreno(false)
        return
      }
      for (const sesion of sesiones) {
        const { data: nuevaSesion } = await supabase
          .from('sesiones_entrenamiento')
          .insert({
            plan_id: plan.id,
            nombre: sesion.nombre,
            dia_semana: sesion.dia_semana ?? null,
            orden: sesion.orden,
            notas: sesion.notas ?? null,
          })
          .select('id')
          .single()

        if (!nuevaSesion) continue

        const ejercicios = (sesion.ejercicios ?? []) as PlantillaSesionEjercicio[]
        for (const ej of ejercicios) {
          await supabase.from('sesion_ejercicios').insert({
            sesion_id: nuevaSesion.id,
            ejercicio_id: ej.ejercicio_id,
            series: ej.series ?? null,
            repeticiones: ej.repeticiones ?? null,
            descanso_segundos: ej.descanso_segundos ?? null,
            peso_sugerido: ej.peso_sugerido ?? null,
            notas: ej.notas ?? null,
            orden: ej.orden,
          })
        }
      }

      setEntrenoCreado({ id: plan.id })
      setShowSelectorEntreno(false)
    } catch (err) {
      setErrorEntreno(err instanceof Error ? err.message : 'Error al crear el plan de entrenamiento')
    } finally {
      setCreandoEntreno(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  if (!cliente || !onboarding) {
    return <div className="p-6 text-[var(--text-muted)]">Cliente o datos de onboarding no encontrados.</div>
  }

  const perfil = cliente.profiles
  const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellidos}` : 'Cliente'

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
          <User size={24} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">{nombreCompleto}</h1>
          <p className="text-sm text-[var(--text-muted)]">{perfil?.email}</p>
        </div>
        {!cliente.revisado_por_coach && (
          <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Pendiente revisión
          </span>
        )}
      </div>

      {/* Datos corporales */}
      <div className="card p-4">
        <h2 className="font-semibold text-[var(--text)] mb-3">Datos corporales</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Peso', value: `${cliente.peso_inicial ?? '—'} kg` },
            { label: 'Altura', value: `${cliente.altura ?? '—'} cm` },
            { label: 'Edad', value: `${cliente.edad ?? '—'} años` },
            { label: 'Sexo', value: cliente.sexo === 'hombre' ? '♂ Hombre' : '♀ Mujer' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--bg)] rounded-lg p-3">
              <div className="text-xs text-[var(--text-muted)]">{label}</div>
              <div className="font-semibold text-[var(--text)]">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Onboarding */}
      <div className="card p-4">
        <h2 className="font-semibold text-[var(--text)] mb-3">Perfil del cliente</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div><dt className="text-[var(--text-muted)]">Objetivo</dt><dd className="font-medium text-[var(--text)]">{OBJETIVO_LABEL[onboarding.objetivo] ?? onboarding.objetivo}</dd></div>
          <div><dt className="text-[var(--text-muted)]">Actividad</dt><dd className="font-medium text-[var(--text)]">{ACTIVIDAD_LABEL[onboarding.actividad_base] ?? onboarding.actividad_base}</dd></div>
          <div><dt className="text-[var(--text-muted)]">Entrenos/semana</dt><dd className="font-medium text-[var(--text)]">{onboarding.dias_entreno} días · {onboarding.duracion_sesion_min} min</dd></div>
          <div><dt className="text-[var(--text-muted)]">Tipo entreno</dt><dd className="font-medium text-[var(--text)]">{onboarding.tipo_entreno?.join(', ') || '—'}</dd></div>
          <div><dt className="text-[var(--text-muted)]">Restricciones</dt><dd className="font-medium text-[var(--text)]">{onboarding.restricciones?.join(', ') || 'Ninguna'}</dd></div>
          <div><dt className="text-[var(--text-muted)]">No le gusta</dt><dd className="font-medium text-[var(--text)]">{onboarding.alimentos_no_gustan || '—'}</dd></div>
          <div><dt className="text-[var(--text-muted)]">Nivel cocina</dt><dd className="font-medium text-[var(--text)] capitalize">{onboarding.nivel_cocina?.replace('_', ' ')}</dd></div>
          <div><dt className="text-[var(--text-muted)]">Tiempo cocina</dt><dd className="font-medium text-[var(--text)]">{onboarding.tiempo_cocina_min} min/día</dd></div>
          {onboarding.presupuesto_semanal_eur && (
            <div><dt className="text-[var(--text-muted)]">Presupuesto</dt><dd className="font-medium text-[var(--text)]">{onboarding.presupuesto_semanal_eur}€/semana</dd></div>
          )}
        </dl>
      </div>

      {/* Plan IA — estado "generando" cuando aún no existe */}
      {!plan && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {reintentandoPlan
                ? <Loader2 className="animate-spin shrink-0" size={18} style={{ color: 'var(--primary)' }} />
                : <Loader2 className="animate-spin shrink-0opacity-40" size={18} style={{ color: 'var(--text-muted)' }} />}
              <div>
                <p className="text-sm font-medium text-[var(--text)]">Generando plan con IA…</p>
                <p className="text-xs text-[var(--text-muted)]">Suele tardar menos de 1 minuto</p>
              </div>
            </div>
            <button
              type="button"
              onClick={reintentarPlan}
              disabled={reintentandoPlan}
              className="btn-secondary text-sm shrink-0"
            >
              {reintentandoPlan ? 'Comprobando…' : 'Recargar'}
            </button>
          </div>
        </div>
      )}

      {/* Plan IA */}
      {plan && (
        <div className="card p-4">
          <h2 className="font-semibold text-[var(--text)] mb-3">Plan inicial generado por IA</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[var(--primary)]/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[var(--primary)]">{plan.kcal_objetivo}</div>
              <div className="text-xs text-[var(--text-muted)]">kcal/día</div>
            </div>
            <div className="bg-[var(--bg)] rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-[var(--text)]">{plan.macros?.proteinas_g}g</div>
              <div className="text-xs text-[var(--text-muted)]">proteína</div>
            </div>
            <div className="bg-[var(--bg)] rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-[var(--text)]">{plan.macros?.carbos_g}g C · {plan.macros?.grasas_g}g G</div>
              <div className="text-xs text-[var(--text-muted)]">carbos · grasas</div>
            </div>
          </div>

          {plan.notas_coach && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300 mb-3">
              <span className="font-semibold">Nota IA:</span> {plan.notas_coach}
            </div>
          )}

          {plan.recomendaciones?.length > 0 && (
            <ul className="text-sm text-[var(--text-muted)] space-y-1 mb-3">
              {plan.recomendaciones.map((r, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-[var(--primary)] mt-0.5">•</span>{r}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setShowRaw(v => !v)}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {showRaw ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Ver JSON completo
          </button>
          {showRaw && (
            <pre className="mt-2 p-3 bg-[var(--bg)] rounded-lg text-xs overflow-auto max-h-48 text-[var(--text-muted)]">
              {JSON.stringify(plan, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Entrenamiento inicial */}
      {onboarding && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell size={18} style={{ color: 'var(--primary)' }} />
            <h2 className="font-semibold text-[var(--text)]">Entrenamiento inicial</h2>
          </div>

          {entrenoCreado ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle size={16} />
                <span>Entrenamiento asignado</span>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/entrenos/${entrenoCreado.id}`)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <ExternalLink size={14} />
                Ver entrenamiento →
              </button>
            </div>
          ) : plantillaSeleccionadaEntreno ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--text)] font-medium truncate">{plantillaSeleccionadaEntreno.nombre}</p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setPlantillaSeleccionadaEntreno(null); setShowSelectorEntreno(true) }}
                  className="btn-secondary text-sm"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={() => crearPlanDesdeEntrenamiento(plantillaSeleccionadaEntreno)}
                  disabled={creandoEntreno}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {creandoEntreno ? <Loader2 size={14} className="animate-spin" /> : <Dumbbell size={14} />}
                  Asignar entrenamiento
                </button>
              </div>
            </div>
          ) : showSelectorEntreno ? (
            <PlantillaEntrenoSelector
              onSeleccionar={(plantilla) => {
                setPlantillaSeleccionadaEntreno(plantilla)
                setShowSelectorEntreno(false)
              }}
              seleccionada={plantillaSeleccionadaEntreno}
            />
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-muted)]">No hay plantilla seleccionada</p>
              <button
                type="button"
                onClick={() => setShowSelectorEntreno(true)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Dumbbell size={14} />
                Seleccionar plantilla
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!cliente.revisado_por_coach && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/clientes/${params.id}`)}
            className="btn-secondary flex-1"
          >
            Ver perfil completo
          </button>
          {plan && (
            dietaCreada ? (
              <button
                type="button"
                onClick={() => router.push(`/dietas/${dietaCreada.id}`)}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} />
                Ver dieta →
              </button>
            ) : (
              <button
                type="button"
                onClick={crearPlan}
                disabled={creandoDieta}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                {creandoDieta ? <Loader2 size={16} className="animate-spin" /> : <Utensils size={16} />}
                Crear plan de dieta
              </button>
            )
          )}
          <button
            type="button"
            onClick={aprobar}
            disabled={aprobando}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {aprobando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Aprobar y activar cliente
          </button>
        </div>
      )}
      {errorDieta && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{errorDieta}</p>
      )}
      {errorEntreno && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{errorEntreno}</p>
      )}
    </div>
  )
}
