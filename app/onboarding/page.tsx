'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ArrowRight, Loader2 } from 'lucide-react'
import OnboardingProgress from '@/components/onboarding/OnboardingProgress'
import StepSegment, { type Segmento } from '@/components/onboarding/StepSegment'
import StepGoal, { type Objetivo } from '@/components/onboarding/StepGoal'
import StepBody, { type BodyData } from '@/components/onboarding/StepBody'
import StepActivity, { type ActividadBase } from '@/components/onboarding/StepActivity'
import StepRestrictions from '@/components/onboarding/StepRestrictions'
import StepCooking, { type NivelCocina } from '@/components/onboarding/StepCooking'
import StepMotivation from '@/components/onboarding/StepMotivation'
import StepDietHistory from '@/components/onboarding/StepDietHistory'
import StepRealFood from '@/components/onboarding/StepRealFood'
import StepTiming from '@/components/onboarding/StepTiming'
import StepHealth from '@/components/onboarding/StepHealth'
import StepSports from '@/components/onboarding/StepSports'
import StepAnalisis from '@/components/onboarding/StepAnalisis'

interface FormState {
  // Básico
  segmento: Segmento | ''
  objetivo: Objetivo | ''
  body: BodyData
  actividad: ActividadBase | ''
  diasEntreno: number
  tipoEntreno: string[]
  duracionSesionMin: number
  restricciones: string[]
  alimentosNoGustan: string
  nivelCocina: NivelCocina | ''
  tiempoCocinaMin: number
  presupuestoSemanal: number
  horarioComidas: Array<{ nombre: string; hora: string }>
  // Motivación
  triggerOnboarding: string
  autoeficacia: number
  // Historia
  historialDietas: string[]
  razonesAbandono: string[]
  relacionComida: string
  todoONada: string
  // Dieta real
  diaTipico: string
  comidasFavoritas: string
  alimentosEvitarExtra: string
  alcoholSemanal: string
  suplementos: string
  comeFueraDias: number
  alimentosBase: string[]
  // Horarios
  horaPrimeraIngesta: string
  horaComidaPrincipal: string
  horaUltimaIngesta: string
  horaEntreno: string
  patronesEnergia: string[]
  // Salud
  condicionesSalud: string
  horasSueno: number
  calidadSueno: number
  nivelEstres: number
  // Deporte (atletas)
  descripcionSemana: string
  fechaCompeticion: string
  tipoCompeticion: string
  nutricionPeriEntreno: string
  // Analítica
  analisisDisponibles: string[]
  analisisValores: Record<string, string>
  testsPendientes: string[]
  notasAnalisis: string
  composicionMetodo: string
  composicionGrasaPct: number
  composicionMasaMuscularKg: number
  composicionObjetivoGrasaPct: number
  pesoCompeticion: number
  vo2max: number
}

const INITIAL: FormState = {
  segmento: '', objetivo: '',
  body: { peso: 0, altura: 0, edad: 0, sexo: '' },
  actividad: '', diasEntreno: 3, tipoEntreno: [], duracionSesionMin: 60,
  restricciones: [], alimentosNoGustan: '',
  nivelCocina: '', tiempoCocinaMin: 30, presupuestoSemanal: 0,
  horarioComidas: [],
  triggerOnboarding: '', autoeficacia: 5,
  historialDietas: [], razonesAbandono: [], relacionComida: '', todoONada: '',
  diaTipico: '', comidasFavoritas: '', alimentosEvitarExtra: '', alcoholSemanal: '',
  suplementos: '', comeFueraDias: 0, alimentosBase: [],
  horaPrimeraIngesta: '', horaComidaPrincipal: '', horaUltimaIngesta: '',
  horaEntreno: '', patronesEnergia: [],
  condicionesSalud: '', horasSueno: 7, calidadSueno: 3, nivelEstres: 2,
  descripcionSemana: '', fechaCompeticion: '', tipoCompeticion: '', nutricionPeriEntreno: '',
  analisisDisponibles: [], analisisValores: {}, testsPendientes: [], notasAnalisis: '',
  composicionMetodo: '', composicionGrasaPct: 0, composicionMasaMuscularKg: 0,
  composicionObjetivoGrasaPct: 0, pesoCompeticion: 0, vo2max: 0,
}

// Pasos fijos (siempre)
const PASOS_FIJOS = [
  { key: 'segmento',    label: 'Perfil',       autoAdvance: true },
  { key: 'objetivo',    label: 'Objetivo',     autoAdvance: true },
  { key: 'cuerpo',      label: 'Cuerpo',       autoAdvance: false },
  { key: 'actividad',   label: 'Actividad',    autoAdvance: false },
  { key: 'restricciones', label: 'Dieta',      autoAdvance: false },
  { key: 'cocina',      label: 'Cocina',       autoAdvance: true },
  { key: 'motivacion',  label: 'Motivación',   autoAdvance: false },
  { key: 'historia',    label: 'Historia',     autoAdvance: false },
  { key: 'dieta_real',  label: 'Tu dieta',     autoAdvance: false },
  { key: 'horarios',    label: 'Horarios',     autoAdvance: false },
  { key: 'salud',       label: 'Salud',        autoAdvance: false },
]

const PASO_DEPORTE   = { key: 'deporte',    label: 'Deporte',    autoAdvance: false }
const PASO_ANALITICA = { key: 'analitica',  label: 'Analítica',  autoAdvance: false }

export default function OnboardingPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward')
  const [visible, setVisible] = useState(true)
  const [autoAdvanceReq, setAutoAdvanceReq] = useState({ id: 0, fromStep: 0 })

  const esAtleta = form.diasEntreno >= 3
  const pasos = [
    ...PASOS_FIJOS,
    ...(esAtleta ? [PASO_DEPORTE] : []),
    PASO_ANALITICA,
  ]
  const totalSteps = pasos.length
  const pasoActual = pasos[step]

  // Auto-advance
  useEffect(() => {
    if (autoAdvanceReq.id === 0) return
    let t2: ReturnType<typeof setTimeout>
    const t1 = setTimeout(() => {
      setAnimDir('forward')
      setVisible(false)
      t2 = setTimeout(() => {
        setStep(prev => prev === autoAdvanceReq.fromStep ? Math.min(prev + 1, totalSteps - 1) : prev)
        setVisible(true)
      }, 180)
    }, 260)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [autoAdvanceReq, totalSteps])

  function navigate(target: number) {
    const dir = target > step ? 'forward' : 'back'
    setAnimDir(dir)
    setVisible(false)
    setTimeout(() => { setStep(target); setVisible(true) }, 180)
  }

  function goNext() { if (step < totalSteps - 1) navigate(step + 1) }
  function goBack() { if (step > 0) navigate(step - 1) }

  function autoAdvance<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      if (pasoActual?.autoAdvance) {
        setAutoAdvanceReq(prev => ({ id: prev.id + 1, fromStep: step }))
      }
    }
  }

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [field]: value }))

  const canContinue = (): boolean => {
    const k = pasoActual?.key
    if (k === 'segmento')   return !!form.segmento
    if (k === 'objetivo')   return !!form.objetivo
    if (k === 'cuerpo')     return form.body.peso > 0 && form.body.altura > 0 && form.body.edad > 0 && !!form.body.sexo
    if (k === 'actividad')  return !!form.actividad
    if (k === 'cocina')     return !!form.nivelCocina
    if (k === 'dieta_real') return form.diaTipico.trim().length > 10
    return true
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Onboarding básico
          segmento: form.segmento,
          objetivo: form.objetivo,
          peso: form.body.peso,
          altura: form.body.altura,
          edad: form.body.edad,
          sexo: form.body.sexo,
          actividad_base: form.actividad,
          dias_entreno: form.diasEntreno,
          tipo_entreno: form.tipoEntreno,
          duracion_sesion_min: form.duracionSesionMin,
          restricciones: form.restricciones,
          alimentos_no_gustan: form.alimentosNoGustan,
          nivel_cocina: form.nivelCocina,
          tiempo_cocina_min: form.tiempoCocinaMin,
          presupuesto_semanal_eur: form.presupuestoSemanal || null,
          horario_comidas: form.horarioComidas.length > 0 ? form.horarioComidas : null,
          // Perfil profundo
          trigger_onboarding: form.triggerOnboarding || null,
          autoeficacia: form.autoeficacia,
          historial_dietas: form.historialDietas,
          razones_abandono: form.razonesAbandono,
          relacion_comida: form.relacionComida || null,
          todo_o_nada: form.todoONada || null,
          dia_tipico: form.diaTipico || null,
          comidas_favoritas: form.comidasFavoritas || null,
          alimentos_evitar_extra: form.alimentosEvitarExtra || null,
          alcohol_semanal: form.alcoholSemanal || null,
          suplementos: form.suplementos || null,
          come_fuera_dias: form.comeFueraDias,
          alimentos_base: form.alimentosBase.length > 0 ? form.alimentosBase : null,
          hora_primera_ingesta: form.horaPrimeraIngesta || null,
          hora_comida_principal: form.horaComidaPrincipal || null,
          hora_ultima_ingesta: form.horaUltimaIngesta || null,
          hora_entreno: form.horaEntreno || null,
          patrones_energia: form.patronesEnergia,
          con_quien_come: [],
          frecuencia_fuera: null,
          comida_trampa: null,
          condiciones_salud: form.condicionesSalud || null,
          horas_sueno: form.horasSueno,
          calidad_sueno: form.calidadSueno,
          nivel_estres: form.nivelEstres,
          descripcion_semana_entreno: form.descripcionSemana || null,
          fecha_competicion: form.fechaCompeticion || null,
          tipo_competicion: form.tipoCompeticion || null,
          nutricion_peri_entreno: form.nutricionPeriEntreno || null,
          analisis_disponibles: form.analisisDisponibles,
          analisis_valores: form.analisisValores,
          tests_recomendados_pendientes: form.testsPendientes,
          composicion_metodo: form.composicionMetodo || null,
          composicion_grasa_pct: form.composicionGrasaPct || null,
          composicion_masa_muscular_kg: form.composicionMasaMuscularKg || null,
          composicion_objetivo_grasa_pct: form.composicionObjetivoGrasaPct || null,
          peso_competicion: form.pesoCompeticion || null,
          vo2max: form.vo2max || null,
          notas_analisis: form.notasAnalisis || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      router.push('/cliente?onboarding=completo')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
      setLoading(false)
    }
  }

  const isLastStep = step === totalSteps - 1

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-safe h-14 flex-shrink-0">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-0"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Paso anterior"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>

        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {step + 1} / {totalSteps}
        </span>

        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {pasoActual?.label}
        </span>
      </div>

      {/* Progress */}
      <div className="px-5">
        <OnboardingProgress currentStep={step} totalSteps={totalSteps} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-4">
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : animDir === 'forward' ? 'translateX(16px)' : 'translateX(-16px)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}>

          {pasoActual?.key === 'segmento' && (
            <StepSegment value={form.segmento} onChange={autoAdvance<Segmento>(v => set('segmento', v))} />
          )}
          {pasoActual?.key === 'objetivo' && (
            <StepGoal value={form.objetivo} onChange={autoAdvance<Objetivo>(v => set('objetivo', v))} />
          )}
          {pasoActual?.key === 'cuerpo' && (
            <StepBody value={form.body} onChange={v => set('body', v)} />
          )}
          {pasoActual?.key === 'actividad' && (
            <StepActivity
              actividad={form.actividad}
              diasEntreno={form.diasEntreno}
              tipoEntreno={form.tipoEntreno}
              duracionSesionMin={form.duracionSesionMin}
              horarioComidas={form.horarioComidas}
              onActividadChange={v => set('actividad', v)}
              onDiasChange={v => set('diasEntreno', v)}
              onTipoChange={v => set('tipoEntreno', v)}
              onDuracionChange={v => set('duracionSesionMin', v)}
              onHorarioChange={v => set('horarioComidas', v)}
            />
          )}
          {pasoActual?.key === 'restricciones' && (
            <StepRestrictions
              restricciones={form.restricciones}
              alimentosNoGustan={form.alimentosNoGustan}
              onRestriccionesChange={v => set('restricciones', v)}
              onAlimentosNogustanChange={v => set('alimentosNoGustan', v)}
            />
          )}
          {pasoActual?.key === 'cocina' && (
            <StepCooking
              nivelCocina={form.nivelCocina}
              tiempoCocinaMin={form.tiempoCocinaMin}
              presupuestoSemanal={form.presupuestoSemanal}
              onNivelChange={autoAdvance<NivelCocina>(v => set('nivelCocina', v))}
              onTiempoChange={v => set('tiempoCocinaMin', v)}
              onPresupuestoChange={v => set('presupuestoSemanal', v)}
            />
          )}
          {pasoActual?.key === 'motivacion' && (
            <StepMotivation
              trigger={form.triggerOnboarding}
              autoeficacia={form.autoeficacia}
              onTriggerChange={v => set('triggerOnboarding', v)}
              onAutoeficaciaChange={v => set('autoeficacia', v)}
            />
          )}
          {pasoActual?.key === 'historia' && (
            <StepDietHistory
              historialDietas={form.historialDietas}
              razonesAbandono={form.razonesAbandono}
              relacionComida={form.relacionComida}
              todoONada={form.todoONada}
              onDietasChange={v => set('historialDietas', v)}
              onRazonesChange={v => set('razonesAbandono', v)}
              onRelacionChange={v => set('relacionComida', v)}
              onTodoONadaChange={v => set('todoONada', v)}
            />
          )}
          {pasoActual?.key === 'dieta_real' && (
            <StepRealFood
              diaTipico={form.diaTipico}
              comidasFavoritas={form.comidasFavoritas}
              alimentosEvitarExtra={form.alimentosEvitarExtra}
              alcoholSemanal={form.alcoholSemanal}
              suplementos={form.suplementos}
              comeFueraDias={form.comeFueraDias}
              alimentosBase={form.alimentosBase}
              onDiaTipicoChange={v => set('diaTipico', v)}
              onComidasFavoritasChange={v => set('comidasFavoritas', v)}
              onAlimentosEvitarChange={v => set('alimentosEvitarExtra', v)}
              onAlcoholChange={v => set('alcoholSemanal', v)}
              onSuplementosChange={v => set('suplementos', v)}
              onComeFueraDiasChange={v => set('comeFueraDias', v)}
              onAlimentosBaseChange={v => set('alimentosBase', v)}
            />
          )}
          {pasoActual?.key === 'horarios' && (
            <StepTiming
              horaPrimeraIngesta={form.horaPrimeraIngesta}
              horaComidaPrincipal={form.horaComidaPrincipal}
              horaUltimaIngesta={form.horaUltimaIngesta}
              horaEntreno={form.horaEntreno}
              patronesEnergia={form.patronesEnergia}
              esAtleta={esAtleta}
              onHoraChange={(field, v) => set(field as keyof FormState, v as never)}
              onPatronesChange={v => set('patronesEnergia', v)}
            />
          )}
          {pasoActual?.key === 'salud' && (
            <StepHealth
              condicionesSalud={form.condicionesSalud}
              horasSueno={form.horasSueno}
              calidadSueno={form.calidadSueno}
              nivelEstres={form.nivelEstres}
              onCondicionesChange={v => set('condicionesSalud', v)}
              onHorasSuenoChange={v => set('horasSueno', v)}
              onCalidadSuenoChange={v => set('calidadSueno', v)}
              onNivelEstresChange={v => set('nivelEstres', v)}
            />
          )}
          {pasoActual?.key === 'deporte' && (
            <StepSports
              descripcionSemana={form.descripcionSemana}
              fechaCompeticion={form.fechaCompeticion}
              tipoCompeticion={form.tipoCompeticion}
              nutricionPeriEntreno={form.nutricionPeriEntreno}
              onDescripcionChange={v => set('descripcionSemana', v)}
              onFechaChange={v => set('fechaCompeticion', v)}
              onTipoChange={v => set('tipoCompeticion', v)}
              onNutricionChange={v => set('nutricionPeriEntreno', v)}
            />
          )}
          {pasoActual?.key === 'analitica' && (
            <StepAnalisis
              segmento={form.segmento as Segmento}
              analisisDisponibles={form.analisisDisponibles}
              analisisValores={form.analisisValores}
              testsPendientes={form.testsPendientes}
              notasAnalisis={form.notasAnalisis}
              composicionMetodo={form.composicionMetodo}
              composicionGrasaPct={form.composicionGrasaPct}
              composicionMasaMuscularKg={form.composicionMasaMuscularKg}
              composicionObjetivoGrasaPct={form.composicionObjetivoGrasaPct}
              pesoCompeticion={form.pesoCompeticion}
              vo2max={form.vo2max}
              onDisponiblesChange={v => set('analisisDisponibles', v)}
              onValoresChange={v => set('analisisValores', v)}
              onTestsPendientesChange={v => set('testsPendientes', v)}
              onNotasChange={v => set('notasAnalisis', v)}
              onComposicionChange={(field, v) => {
                const mapping: Record<string, keyof FormState> = {
                  composicionMetodo: 'composicionMetodo',
                  composicionGrasaPct: 'composicionGrasaPct',
                  composicionMasaMuscularKg: 'composicionMasaMuscularKg',
                  composicionObjetivoGrasaPct: 'composicionObjetivoGrasaPct',
                  pesoCompeticion: 'pesoCompeticion',
                  vo2max: 'vo2max',
                }
                const key = mapping[field]
                if (key) set(key, v as never)
              }}
            />
          )}

          {error && (
            <div className="mt-5 px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(255,69,58,0.08)', color: '#FF453A', border: '1px solid rgba(255,69,58,0.2)' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-safe-or-6 flex-shrink-0"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)' }}>

        {pasoActual?.autoAdvance && !canContinue() ? (
          <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
            Selecciona una opción para continuar
          </p>
        ) : pasoActual?.autoAdvance && canContinue() ? (
          <button
            type="button"
            onClick={isLastStep ? handleSubmit : goNext}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
            style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)' }}
          >
            {isLastStep
              ? loading ? <><Loader2 size={16} className="animate-spin" /> Creando tu perfil…</> : 'Crear mi plan'
              : <><ArrowRight size={15} /> Continuar</>}
          </button>
        ) : (
          <button
            type="button"
            onClick={isLastStep ? handleSubmit : goNext}
            disabled={(!canContinue() && !isLastStep) || loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40"
            style={{
              background: (canContinue() || isLastStep) && !loading ? 'var(--text)' : 'var(--surface)',
              color: (canContinue() || isLastStep) && !loading ? 'var(--bg)' : 'var(--text-muted)',
            }}
          >
            {isLastStep
              ? loading
                ? <><Loader2 size={16} className="animate-spin" /> Creando tu plan…</>
                : '✓ Crear mi plan personalizado'
              : <>Continuar <ArrowRight size={15} /></>}
          </button>
        )}
      </div>
    </div>
  )
}
