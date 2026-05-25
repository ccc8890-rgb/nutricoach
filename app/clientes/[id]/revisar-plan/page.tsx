'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, ChevronDown, ChevronUp, User, Utensils, ExternalLink, Dumbbell, RefreshCw } from 'lucide-react'
import PlantillaEntrenoSelector from '@/components/training/PlantillaEntrenoSelector'
import type { PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio } from '@/types'

function generarCodigoPublico(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let codigo = ''
  for (let i = 0; i < 8; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return codigo
}

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
  distribucion_comidas: {
    nombre: string
    porcentaje_kcal: number
    kcal: number
    hora_sugerida: string
    recetas?: { receta_id: string; receta_nombre: string; cantidad_porciones: number }[]
  }[]
  recomendaciones: string[]
  notas_coach: string
  // ── Campos pro (plan de élite) ────────────────────────────────
  notas_cliente?: string
  protocolo_semana?: {
    dia_entreno: string
    dia_descanso: string
    timing_clave: string
  }
  justificacion_coach?: {
    razonamiento_macros: string
    senales_seguimiento: string[]
    proxima_revision: string
  }
}

interface RegistroIA {
  id: string
  respuesta_json: PlanInicial
  created_at: string
}

interface PerfilProfundo {
  trigger_onboarding?: string
  autoeficacia?: number
  historial_dietas?: string[]
  razones_abandono?: string[]
  relacion_comida?: string
  todo_o_nada?: string
  hora_primera_ingesta?: string
  hora_comida_principal?: string
  hora_ultima_ingesta?: string
  hora_entreno?: string
  frecuencia_fuera?: string
  con_quien_come?: string[]
  condiciones_salud?: string
  horas_sueno?: number
  calidad_sueno?: string
  nivel_estres?: string
  composicion_grasa_pct?: number
  composicion_masa_muscular_kg?: number
  composicion_objetivo_grasa_pct?: number
  vo2max?: number
  suplementos?: string
  comidas_favoritas?: string
  alimentos_evitar_extra?: string
}

interface RecetaSugerida {
  id: string
  nombre: string
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  imagen_url: string | null
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

function nombreATipoPlato(nombre: string): string | null {
  const n = nombre.toLowerCase()
  if (n.includes('desayuno') || n.includes('brunch')) return 'Desayuno'
  if (n.includes('merienda') || n.includes('snack') || n.includes('tentempié') || n.includes('media mañana')) return 'Merienda'
  if (n.includes('cena')) return 'Cena'
  if (n.includes('comida') || n.includes('almuerzo') || n.includes('mediodía')) return 'Comida'
  if (n.includes('post') || n.includes('recuper')) return 'Snack'
  if (n.includes('pre') || n.includes('antes del entreno')) return 'Snack'
  return null
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
  const [errorPlan, setErrorPlan] = useState<string | null>(null)
  const [reintentandoPlan, setReintentandoPlan] = useState(false)
  const [regenerandoPlan, setRegenerandoPlan] = useState(false)
  const [versiones, setVersiones] = useState<RegistroIA[]>([])
  const [versionIdx, setVersionIdx] = useState(0)
  const [perfilProfundo, setPerfilProfundo] = useState<PerfilProfundo | null>(null)
  const [showPerfilProfundo, setShowPerfilProfundo] = useState(false)
  const [recetasPorComida, setRecetasPorComida] = useState<Record<number, RecetaSugerida[]>>({})
  const [cargandoRecetas, setCargandoRecetas] = useState(false)
  const [proponendoPlanIA, setProponendoPlanIA] = useState(false)
  const [propuestaIA, setPropuestaIA] = useState<Record<string, unknown> | null>(null)
  const [errorPropuestaIA, setErrorPropuestaIA] = useState<string | null>(null)
  const [showPropuestaIA, setShowPropuestaIA] = useState(false)
  const [generandoEntrenoIA, setGenerandoEntrenoIA] = useState(false)

  const cargarRecetasPlan = useCallback(async (planData: PlanInicial) => {
    if (!planData.distribucion_comidas?.length) return
    setCargandoRecetas(true)
    const resultados: Record<number, RecetaSugerida[]> = {}
    await Promise.all(
      planData.distribucion_comidas.map(async (comida, idx) => {
        try {
          const tipoPlatoFiltro = nombreATipoPlato(comida.nombre)
          const protTarget = Math.round((comida.kcal * 0.30) / 4)
          const qs = new URLSearchParams({
            kcal: String(comida.kcal),
            proteinas: String(protTarget),
            limite: '3',
            cliente_id: params.id as string,
            ...(tipoPlatoFiltro ? { tipo_plato: tipoPlatoFiltro } : {}),
          })
          const res = await fetch(`/api/recetas/sugeridas?${qs}`)
          if (res.ok) {
            const data = await res.json()
            resultados[idx] = data.recetas ?? []
          }
        } catch {
          // Non-critical
        }
      })
    )
    setRecetasPorComida(resultados)
    setCargandoRecetas(false)
  }, [params.id])

  useEffect(() => {
    const id = params.id as string
    Promise.all([
      fetch(`/api/clientes/${id}/revisar-data`).then(r => r.json()),
      supabase.from('planes_entrenamiento').select('id').eq('cliente_id', id).eq('activo', true).limit(1),
    ])
      .then(([{ cliente: c, onboarding: o, registros: rs, perfilProfundo: pp }, { data: planesExistentes }]) => {
        setCliente(c as ClienteData)
        setOnboarding(o as OnboardingData)
        const registros = (rs ?? []) as RegistroIA[]
        setVersiones(registros)
        setVersionIdx(0)
        if (registros.length > 0) {
          setPlan(registros[0].respuesta_json)
          cargarRecetasPlan(registros[0].respuesta_json)
        }
        if (pp) setPerfilProfundo(pp as PerfilProfundo)
        setLoading(false)

        // Auto-generar plan de entrenamiento si no hay ninguno activo
        if (!planesExistentes || planesExistentes.length === 0) {
          setGenerandoEntrenoIA(true)
          fetch('/api/entrenos/proponer-plan-ciencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ cliente_id: id }),
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.plan_id) setEntrenoCreado({ id: data.plan_id })
              if (data?.plan) { setPropuestaIA(data); setShowPropuestaIA(true) }
            })
            .catch(() => { /* no bloqueante */ })
            .finally(() => setGenerandoEntrenoIA(false))
        } else {
          setEntrenoCreado({ id: planesExistentes[0].id })
        }
      })
      .catch(e => {
        console.error('[revisar-plan] Error cargando datos:', e)
        setLoading(false)
      })
  }, [params.id, cargarRecetasPlan])

  const cargarVersiones = async (): Promise<number> => {
    const { data } = await supabase
      .from('registros_ia')
      .select('id, respuesta_json, created_at')
      .eq('cliente_id', params.id as string)
      .in('tipo', ['plan_inicial', 'dieta'])
      .order('created_at', { ascending: false })
    const registros = (data ?? []) as RegistroIA[]
    setVersiones(registros)
    setVersionIdx(0)
    if (registros.length > 0) {
      setPlan(registros[0].respuesta_json)
      cargarRecetasPlan(registros[0].respuesta_json)
    }
    return registros.length
  }

  const reintentarPlan = async () => {
    setReintentandoPlan(true)
    await cargarVersiones()
    setReintentandoPlan(false)
  }

  const regenerarPlan = async () => {
    setRegenerandoPlan(true)
    setErrorPlan(null)
    try {
      if (!onboarding) {
        setErrorPlan('No se puede generar dieta: el cliente aún no ha completado el onboarding.')
        return
      }
      const res = await fetch('/api/generar-plan-inicial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_id: params.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setErrorPlan(data?.error ?? 'No se pudo generar el plan.')
        return
      }
      const total = await cargarVersiones()
      if (total === 0) setErrorPlan('La generación terminó, pero no se encontró ningún plan guardado. Revisa registros_ia.')
    } catch (err) {
      setErrorPlan(err instanceof Error ? err.message : 'Error inesperado al generar el plan.')
    } finally {
      setRegenerandoPlan(false)
    }
  }

  const proponerPlanEntrenoIA = async () => {
    setProponendoPlanIA(true)
    setErrorPropuestaIA(null)
    setPropuestaIA(null)
    try {
      const res = await fetch('/api/entrenos/proponer-plan-ciencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_id: params.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setErrorPropuestaIA(data?.error ?? 'No se pudo generar la propuesta.')
        return
      }
      setPropuestaIA(data)
      setShowPropuestaIA(true)
    } catch (err) {
      setErrorPropuestaIA(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setProponendoPlanIA(false)
    }
  }

  const aprobar = async () => {
    const ok = window.confirm(
      `¿Confirmas que ${nombreCompleto} tiene dieta y entrenamiento asignados y está listo para activarse?`
    )
    if (!ok) return
    setAprobando(true)
    await fetch('/api/aprobar-cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cliente_id: params.id }),
    })
    router.push(`/clientes/${params.id}`)
  }

  const crearPlan = async () => {
    if (!plan) return
    if (!plan.distribucion_comidas?.length) {
      setErrorDieta('El plan no tiene comidas definidas. Espera a que la IA termine de generarlo o recarga.')
      return
    }
    const kcalMin = cliente?.sexo === 'mujer' ? 1200 : 1500
    if (plan.kcal_objetivo < kcalMin) {
      const ok = window.confirm(
        `⚠️ El plan tiene ${plan.kcal_objetivo} kcal/día, por debajo del mínimo recomendado de ${kcalMin} kcal para ${cliente?.sexo === 'mujer' ? 'mujer' : 'hombre'}.\n\n¿Confirmas que quieres crear este plan igualmente?`
      )
      if (!ok) return
    }
    setCreandoDieta(true)
    setErrorDieta(null)
    try {
      // ── 1. Verificar si generar-plan-inicial ya persisitió el plan ──────────
      // El server route.ts (líneas 648-800) ya creó plan + comidas + alimentos en BD.
      // Si existe, redirigimos directamente en vez de duplicar.
      const { data: planExistente } = await supabase
        .from('planes_nutricion')
        .select('id')
        .eq('cliente_id', params.id as string)
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planExistente?.id) {
        setDietaCreada({ id: planExistente.id })
        return // No creamos duplicado, el usuario ve el plan ya persistido
      }

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
          codigo_publico: generarCodigoPublico(),
        })
        .select('id')
        .single()

      if (errorPlan || !planCreado) throw new Error(errorPlan?.message ?? 'Error al crear el plan')

      // Insertar comidas una a una para obtener sus IDs (necesarios para comida_alimentos)
      const comidasCreadas: { id: string; nombre: string; orden: number }[] = []
      for (let index = 0; index < plan.distribucion_comidas.length; index++) {
        const item = plan.distribucion_comidas[index]
        const { data: comidaCreada } = await supabase
          .from('comidas')
          .insert({
            plan_id: planCreado.id,
            nombre: item.nombre,
            orden: index,
            hora_sugerida: item.hora_sugerida,
          })
          .select('id, nombre, orden')
          .single()
        if (comidaCreada) comidasCreadas.push(comidaCreada)
      }

      // ── 2. Persistir las recetas REALES de DeepSeek (no las sugeridas al azar) ──
      // usar plan.distribucion_comidas[].recetas que vienen de la IA,
      // NO recetasPorComida[index] que son sugeridas por rango de kcal.
      for (let index = 0; index < comidasCreadas.length; index++) {
        const comida = comidasCreadas[index]
        const recetasDeepSeek = plan.distribucion_comidas[index]?.recetas
        if (!recetasDeepSeek?.length) {
          // Fallback: si DeepSeek no asignó recetas, usar las sugeridas por kcal
          const recetasSugeridas = recetasPorComida[index]
          if (!recetasSugeridas?.length) continue
          const primeraReceta = recetasSugeridas[0]
          try {
            await fetch(`/api/comidas/${comida.id}/receta`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ receta_id: primeraReceta.id }),
            })
          } catch (err) {
            console.error(`Error al persistir receta en comida "${comida.nombre}":`, err)
          }
          continue
        }

        // Usar las recetas que DeepSeek seleccionó
        for (const r of recetasDeepSeek) {
          try {
            if (!r.receta_id) continue
            await fetch(`/api/comidas/${comida.id}/receta`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ receta_id: r.receta_id }),
            })
          } catch (err) {
            console.error(`Error al persistir receta IA en comida "${comida.nombre}":`, err)
          }
        }
      }

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
        activo: true,
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

  if (!cliente) {
    return <div className="p-6 text-[var(--text-muted)]">Cliente no encontrado.</div>
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
        {!onboarding ? (
          <p className="text-sm text-[var(--text-muted)]">El cliente aún no ha completado el cuestionario inicial.</p>
        ) : (
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
        )}
      </div>

      {/* Perfil profundo — colapsable */}
      {perfilProfundo && (
        <div className="card p-4">
          <button
            type="button"
            onClick={() => setShowPerfilProfundo(v => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="font-semibold text-[var(--text)]">Perfil profundo del cliente</h2>
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              {showPerfilProfundo ? 'Ocultar' : 'Ver'}
              {showPerfilProfundo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {showPerfilProfundo && (
            <div className="mt-4 space-y-4">

              {/* Psicología y motivación */}
              {(perfilProfundo.trigger_onboarding || perfilProfundo.autoeficacia != null || perfilProfundo.relacion_comida || perfilProfundo.todo_o_nada || (perfilProfundo.historial_dietas?.length ?? 0) > 0 || (perfilProfundo.razones_abandono?.length ?? 0) > 0) && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Psicología y motivación</p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                    {perfilProfundo.trigger_onboarding && <div><dt className="text-[var(--text-muted)] text-xs">Detonante</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.trigger_onboarding}</dd></div>}
                    {perfilProfundo.autoeficacia != null && <div><dt className="text-[var(--text-muted)] text-xs">Autoeficacia (0-10)</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.autoeficacia}/10</dd></div>}
                    {perfilProfundo.relacion_comida && <div><dt className="text-[var(--text-muted)] text-xs">Relación con la comida</dt><dd className="font-medium text-[var(--text)] capitalize">{perfilProfundo.relacion_comida}</dd></div>}
                    {perfilProfundo.todo_o_nada && <div><dt className="text-[var(--text-muted)] text-xs">Mentalidad todo/nada</dt><dd className="font-medium text-[var(--text)] capitalize">{perfilProfundo.todo_o_nada}</dd></div>}
                    {(perfilProfundo.historial_dietas?.length ?? 0) > 0 && <div className="sm:col-span-2"><dt className="text-[var(--text-muted)] text-xs">Historial de dietas</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.historial_dietas!.join(', ')}</dd></div>}
                    {(perfilProfundo.razones_abandono?.length ?? 0) > 0 && <div className="sm:col-span-2"><dt className="text-[var(--text-muted)] text-xs">Razones de abandono anteriores</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.razones_abandono!.join(', ')}</dd></div>}
                  </dl>
                </div>
              )}

              {/* Horarios y hábitos */}
              {(perfilProfundo.hora_primera_ingesta || perfilProfundo.hora_entreno || perfilProfundo.frecuencia_fuera || perfilProfundo.comidas_favoritas || perfilProfundo.alimentos_evitar_extra || perfilProfundo.suplementos) && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Horarios y hábitos</p>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
                    {perfilProfundo.hora_primera_ingesta && <div><dt className="text-[var(--text-muted)] text-xs">Primera ingesta</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.hora_primera_ingesta}</dd></div>}
                    {perfilProfundo.hora_comida_principal && <div><dt className="text-[var(--text-muted)] text-xs">Comida principal</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.hora_comida_principal}</dd></div>}
                    {perfilProfundo.hora_ultima_ingesta && <div><dt className="text-[var(--text-muted)] text-xs">Última ingesta</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.hora_ultima_ingesta}</dd></div>}
                    {perfilProfundo.hora_entreno && <div><dt className="text-[var(--text-muted)] text-xs">Hora de entreno</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.hora_entreno}</dd></div>}
                    {perfilProfundo.frecuencia_fuera && <div><dt className="text-[var(--text-muted)] text-xs">Come fuera</dt><dd className="font-medium text-[var(--text)] capitalize">{perfilProfundo.frecuencia_fuera}</dd></div>}
                    {perfilProfundo.suplementos && <div className="sm:col-span-2"><dt className="text-[var(--text-muted)] text-xs">Suplementos</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.suplementos}</dd></div>}
                    {perfilProfundo.comidas_favoritas && <div className="col-span-2 sm:col-span-3"><dt className="text-[var(--text-muted)] text-xs">Comidas favoritas</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.comidas_favoritas}</dd></div>}
                    {perfilProfundo.alimentos_evitar_extra && <div className="col-span-2 sm:col-span-3"><dt className="text-[var(--text-muted)] text-xs">Alimentos a evitar (extra)</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.alimentos_evitar_extra}</dd></div>}
                  </dl>
                </div>
              )}

              {/* Salud */}
              {(perfilProfundo.condiciones_salud || perfilProfundo.horas_sueno != null || perfilProfundo.calidad_sueno || perfilProfundo.nivel_estres) && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Salud y bienestar</p>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
                    {perfilProfundo.horas_sueno != null && <div><dt className="text-[var(--text-muted)] text-xs">Horas de sueño</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.horas_sueno}h</dd></div>}
                    {perfilProfundo.calidad_sueno && <div><dt className="text-[var(--text-muted)] text-xs">Calidad sueño</dt><dd className="font-medium text-[var(--text)] capitalize">{perfilProfundo.calidad_sueno}</dd></div>}
                    {perfilProfundo.nivel_estres && <div><dt className="text-[var(--text-muted)] text-xs">Nivel de estrés</dt><dd className="font-medium text-[var(--text)] capitalize">{perfilProfundo.nivel_estres}</dd></div>}
                    {perfilProfundo.condiciones_salud && <div className="col-span-2 sm:col-span-3"><dt className="text-[var(--text-muted)] text-xs">Condiciones de salud</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.condiciones_salud}</dd></div>}
                  </dl>
                </div>
              )}

              {/* Composición corporal */}
              {(perfilProfundo.composicion_grasa_pct != null || perfilProfundo.composicion_masa_muscular_kg != null || perfilProfundo.vo2max != null) && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Composición y rendimiento</p>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
                    {perfilProfundo.composicion_grasa_pct != null && <div><dt className="text-[var(--text-muted)] text-xs">% grasa actual</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.composicion_grasa_pct}%</dd></div>}
                    {perfilProfundo.composicion_objetivo_grasa_pct != null && <div><dt className="text-[var(--text-muted)] text-xs">% grasa objetivo</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.composicion_objetivo_grasa_pct}%</dd></div>}
                    {perfilProfundo.composicion_masa_muscular_kg != null && <div><dt className="text-[var(--text-muted)] text-xs">Masa muscular</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.composicion_masa_muscular_kg} kg</dd></div>}
                    {perfilProfundo.vo2max != null && <div><dt className="text-[var(--text-muted)] text-xs">VO₂ max</dt><dd className="font-medium text-[var(--text)]">{perfilProfundo.vo2max} ml/kg/min</dd></div>}
                  </dl>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Plan IA — estado "generando" cuando aún no existe */}
      {!plan && (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {reintentandoPlan
                ? <Loader2 className="animate-spin shrink-0" size={18} style={{ color: 'var(--primary)' }} />
                : <RefreshCw className="shrink-0 opacity-50" size={18} style={{ color: 'var(--text-muted)' }} />}
              <div>
                <p className="text-sm font-medium text-[var(--text)]">No hay plan IA guardado todavía</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {onboarding
                    ? 'Genera el plan inicial para poder crear la dieta del cliente.'
                    : 'El cliente debe completar el onboarding antes de generar la dieta.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={reintentarPlan}
                disabled={reintentandoPlan}
                className="btn-secondary text-sm"
              >
                {reintentandoPlan ? 'Comprobando…' : 'Recargar'}
              </button>
              <button
                type="button"
                onClick={regenerarPlan}
                disabled={regenerandoPlan || !onboarding}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {regenerandoPlan ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {regenerandoPlan ? 'Generando…' : 'Generar plan'}
              </button>
            </div>
          </div>
        </div>
      )}
      {errorPlan && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{errorPlan}</p>
      )}

      {/* Plan IA */}
      {plan && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[var(--text)]">Plan inicial generado por IA</h2>
            <button
              type="button"
              onClick={regenerarPlan}
              disabled={regenerandoPlan}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
              title="Pedir un nuevo plan a la IA"
            >
              <RefreshCw size={13} className={regenerandoPlan ? 'animate-spin' : ''} />
              {regenerandoPlan ? 'Generando…' : 'Regenerar'}
            </button>
          </div>

          {/* Selector de versiones */}
          {versiones.length > 1 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-[11px] text-[var(--text-muted)]">Versión:</span>
              {[...versiones].reverse().map((v, displayIdx) => {
                const arrIdx = versiones.length - 1 - displayIdx
                const isActive = arrIdx === versionIdx
                const fecha = new Date(v.created_at).toLocaleString('es-ES', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                })
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setVersionIdx(arrIdx); setPlan(v.respuesta_json) }}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${isActive
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30 font-medium'
                      : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)] hover:border-gray-300'
                      }`}
                  >
                    V{displayIdx + 1} · {fecha}
                  </button>
                )
              })}
            </div>
          )}
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

          {/* ── Mensaje para el cliente (campo pro) ────────────── */}
          {plan.notas_cliente && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm mb-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">💬 Mensaje sugerido al cliente</p>
              <p className="text-blue-900 dark:text-blue-100 italic">&ldquo;{plan.notas_cliente}&rdquo;</p>
            </div>
          )}

          {/* ── Protocolo semanal (campo pro) ───────────────────── */}
          {plan.protocolo_semana && (
            <div className="p-3 border rounded-lg text-sm mb-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Protocolo semanal</p>
              <div className="space-y-1.5">
                <div className="flex gap-2"><span className="text-xs font-medium text-green-600 dark:text-green-400 w-24 shrink-0">Día entreno</span><span className="text-xs text-[var(--text)]">{plan.protocolo_semana.dia_entreno}</span></div>
                <div className="flex gap-2"><span className="text-xs font-medium text-slate-500 w-24 shrink-0">Día descanso</span><span className="text-xs text-[var(--text)]">{plan.protocolo_semana.dia_descanso}</span></div>
                <div className="flex gap-2"><span className="text-xs font-medium text-amber-600 dark:text-amber-400 w-24 shrink-0">Clave</span><span className="text-xs text-[var(--text)] font-medium">{plan.protocolo_semana.timing_clave}</span></div>
              </div>
            </div>
          )}

          {/* ── Justificación para el coach (campo pro) ─────────── */}
          {plan.justificacion_coach && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm mb-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">🔬 Justificación científica (solo coach)</p>
              <p className="text-amber-900 dark:text-amber-200 mb-2">{plan.justificacion_coach.razonamiento_macros}</p>
              {plan.justificacion_coach.senales_seguimiento?.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Señales a monitorizar en 2-4 semanas:</p>
                  <ul className="space-y-0.5">
                    {plan.justificacion_coach.senales_seguimiento.map((s, i) => (
                      <li key={i} className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-1"><span>•</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-amber-700 dark:text-amber-400"><span className="font-medium">Si no hay progreso en 3 semanas:</span> {plan.justificacion_coach.proxima_revision}</p>
            </div>
          )}

          {/* ── Nota IA fallback (si no hay campos pro) ─────────── */}
          {plan.notas_coach && !plan.notas_cliente && (
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

          {/* Distribución de comidas + recetas compatibles */}
          {plan.distribucion_comidas?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Distribución de comidas
              </p>
              <div className="flex flex-col gap-2">
                {plan.distribucion_comidas.map((comida, idx) => {
                  const sugeridas = recetasPorComida[idx] ?? []
                  const deepSeekRecetas = comida.recetas ?? []
                  const mostrarDeepSeek = deepSeekRecetas.length > 0
                  return (
                    <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--text)]">{comida.nombre}</span>
                        <span className="text-xs text-[var(--text-muted)]">{comida.hora_sugerida} · {comida.kcal} kcal</span>
                      </div>
                      {cargandoRecetas ? (
                        <div className="flex gap-2 mt-1">
                          {[1, 2, 3].map(i => <div key={i} className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />)}
                        </div>
                      ) : mostrarDeepSeek ? (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {deepSeekRecetas.map((r, ri) => (
                            <span
                              key={ri}
                              className="text-xs px-2 py-0.5 rounded-full border"
                              style={{ borderColor: 'var(--primary)/30', color: 'var(--primary)', background: 'var(--primary)/8' }}
                              title={`${r.cantidad_porciones} porción(es) · seleccionada por IA`}
                            >
                              {r.receta_nombre}
                            </span>
                          ))}
                          <span className="text-[10px] text-[var(--text-muted)] self-center ml-1">🤖 IA</span>
                        </div>
                      ) : sugeridas.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {sugeridas.map(r => (
                            <a
                              key={r.id}
                              href={`/recetas/${r.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs px-2 py-0.5 rounded-full border hover:opacity-80 transition-opacity"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg)' }}
                              title={`${r.kcal} kcal · ${r.proteinas}g P`}
                            >
                              {r.nombre}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
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

          {generandoEntrenoIA ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <span>Generando plan de entrenamiento con IA científica…</span>
            </div>
          ) : entrenoCreado ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle size={16} />
                  <span>Entrenamiento asignado{propuestaIA ? ' · generado por IA' : ''}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={proponerPlanEntrenoIA}
                    disabled={proponendoPlanIA}
                    className="btn-secondary flex items-center gap-2 text-sm"
                    title="Regenerar plan con IA (reemplaza el actual)"
                  >
                    {proponendoPlanIA ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Regenerar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEntrenoCreado(null); setShowSelectorEntreno(true) }}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Dumbbell size={14} />
                    Cambiar plantilla
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/entrenos/${entrenoCreado.id}`)}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <ExternalLink size={14} />
                    Ver →
                  </button>
                </div>
              </div>
              {propuestaIA && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPropuestaIA(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-[var(--text-muted)]"
                  >
                    <span>Ver sesiones propuestas por IA</span>
                    {showPropuestaIA ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showPropuestaIA && (() => {
                    const p = propuestaIA.plan as Record<string, unknown>
                    const sesiones = (p?.sesiones as Record<string, unknown>[]) ?? []
                    return (
                      <div className="px-4 pb-3 space-y-2 text-xs text-[var(--text-muted)]">
                        {typeof p?.fundamentacion === 'string' && <p className="text-[var(--text)]">{p.fundamentacion}</p>}
                        {sesiones.map((s, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="w-20 font-medium shrink-0">{String(s.dia_semana ?? '')}</span>
                            <span>{String(s.nombre ?? '')} · {Number(s.duracion_min ?? 0)} min</span>
                          </div>
                        ))}
                        {typeof p?.progresion_semanal === 'string' && <p className="border-t border-[var(--border)] pt-2">{p.progresion_semanal}</p>}
                      </div>
                    )
                  })()}
                </div>
              )}
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
              clienteId={params.id as string}
            />
          ) : (
            <div className="space-y-3">
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
              {errorPropuestaIA && (
                <p className="text-sm text-red-600 dark:text-red-400">{errorPropuestaIA}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {plan && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.open(`/clientes/${params.id}`, '_blank')}
            className="btn-secondary flex-1"
          >
            Ver perfil completo
          </button>
          {dietaCreada ? (
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
          )}
          {!cliente.revisado_por_coach ? (
            <button
              type="button"
              onClick={aprobar}
              disabled={aprobando}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {aprobando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Aprobar y activar cliente
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/clientes/${params.id}`)}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              Volver a ficha
            </button>
          )}
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
