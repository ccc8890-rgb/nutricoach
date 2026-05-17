'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import OnboardingProgress from '@/components/onboarding/OnboardingProgress'
import StepMotivation from '@/components/onboarding/StepMotivation'
import StepDietHistory from '@/components/onboarding/StepDietHistory'
import StepRealFood from '@/components/onboarding/StepRealFood'
import StepTiming from '@/components/onboarding/StepTiming'
import StepSocial from '@/components/onboarding/StepSocial'
import StepHealth from '@/components/onboarding/StepHealth'
import StepSports from '@/components/onboarding/StepSports'
import StepAnalisis from '@/components/onboarding/StepAnalisis'
import type { Segmento } from '@/components/onboarding/StepSegment'

interface FormState {
  // A
  triggerOnboarding: string
  autoeficacia: number
  // B
  historialDietas: string[]
  razonesAbandono: string[]
  relacionComida: string
  todoONada: string
  // C
  diaTipico: string
  comidasFavoritas: string
  alimentosEvitarExtra: string
  alcoholSemanal: string
  suplementos: string
  // D
  horaPrimeraIngesta: string
  horaComidaPrincipal: string
  horaUltimaIngesta: string
  horaEntreno: string
  patronesEnergia: string[]
  // E
  conQuienCome: string[]
  frecuenciaFuera: string
  comidaTrampa: string
  // F
  condicionesSalud: string
  horasSueno: number
  calidadSueno: number
  nivelEstres: number
  // G
  descripcionSemana: string
  fechaCompeticion: string
  tipoCompeticion: string
  nutricionPeriEntreno: string
  // H — Análisis
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
  triggerOnboarding: '', autoeficacia: 0,
  historialDietas: [], razonesAbandono: [], relacionComida: '', todoONada: '',
  diaTipico: '', comidasFavoritas: '', alimentosEvitarExtra: '', alcoholSemanal: '', suplementos: '',
  horaPrimeraIngesta: '', horaComidaPrincipal: '', horaUltimaIngesta: '', horaEntreno: '',
  patronesEnergia: [],
  conQuienCome: [], frecuenciaFuera: '', comidaTrampa: '',
  condicionesSalud: '', horasSueno: 7, calidadSueno: 0, nivelEstres: 0,
  descripcionSemana: '', fechaCompeticion: '', tipoCompeticion: '', nutricionPeriEntreno: '',
  analisisDisponibles: [], analisisValores: {}, testsPendientes: [], notasAnalisis: '',
  composicionMetodo: '', composicionGrasaPct: 0, composicionMasaMuscularKg: 0,
  composicionObjetivoGrasaPct: 0, pesoCompeticion: 0, vo2max: 0,
}

export default function PerfilProfundoPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [esAtleta, setEsAtleta] = useState(false)
  const [segmento, setSegmento] = useState<Segmento | ''>('')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/onboarding/perfil', { method: 'GET' })
      .then(r => r.json())
      .then(data => {
        if (data.cliente_id) setClienteId(data.cliente_id)
        if (data.dias_entreno > 2) setEsAtleta(true)
        if (data.segmento) setSegmento(data.segmento as Segmento)
      })
      .catch(() => {})
  }, [])

  const steps = [
    { label: 'Motivación', component: 'A' },
    { label: 'Historia', component: 'B' },
    { label: 'Tu dieta real', component: 'C' },
    { label: 'Horarios', component: 'D' },
    { label: 'Social', component: 'E' },
    { label: 'Salud', component: 'F' },
    ...(esAtleta ? [{ label: 'Deporte', component: 'G' }] : []),
    { label: 'Analítica', component: 'H' },
  ]

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [field]: value }))

  const puedeAvanzar = () => {
    const s = steps[step]?.component
    if (s === 'A') return form.autoeficacia >= 0
    if (s === 'C') return form.diaTipico.trim().length > 10
    return true
  }

  const handleSkip = () => {
    if (step < steps.length - 1) setStep(s => s + 1)
    else handleSubmit()
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_onboarding: form.triggerOnboarding,
          autoeficacia: form.autoeficacia,
          historial_dietas: form.historialDietas,
          razones_abandono: form.razonesAbandono,
          relacion_comida: form.relacionComida,
          todo_o_nada: form.todoONada,
          dia_tipico: form.diaTipico,
          comidas_favoritas: form.comidasFavoritas,
          alimentos_evitar_extra: form.alimentosEvitarExtra,
          alcohol_semanal: form.alcoholSemanal,
          suplementos: form.suplementos,
          hora_primera_ingesta: form.horaPrimeraIngesta,
          hora_comida_principal: form.horaComidaPrincipal,
          hora_ultima_ingesta: form.horaUltimaIngesta,
          hora_entreno: form.horaEntreno,
          patrones_energia: form.patronesEnergia,
          con_quien_come: form.conQuienCome,
          frecuencia_fuera: form.frecuenciaFuera,
          comida_trampa: form.comidaTrampa,
          condiciones_salud: form.condicionesSalud,
          horas_sueno: form.horasSueno,
          calidad_sueno: form.calidadSueno,
          nivel_estres: form.nivelEstres,
          descripcion_semana_entreno: form.descripcionSemana,
          fecha_competicion: form.fechaCompeticion || null,
          tipo_competicion: form.tipoCompeticion,
          nutricion_peri_entreno: form.nutricionPeriEntreno,
          analisis_disponibles: form.analisisDisponibles,
          analisis_valores: form.analisisValores,
          tests_recomendados_pendientes: form.testsPendientes,
          composicion_metodo: form.composicionMetodo,
          composicion_grasa_pct: form.composicionGrasaPct || null,
          composicion_masa_muscular_kg: form.composicionMasaMuscularKg || null,
          composicion_objetivo_grasa_pct: form.composicionObjetivoGrasaPct || null,
          peso_competicion: form.pesoCompeticion || null,
          vo2max: form.vo2max || null,
          notas_analisis: form.notasAnalisis,
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

  const currentStepLabel = steps[step]?.component

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            Perfil completo — paso {step + 1} de {steps.length}
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Tu vida real, tu plan real</h1>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            Con esto la IA puede crear algo exclusivo para ti — no un plan genérico.
          </p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border)] p-6">
          <OnboardingProgress currentStep={step} totalSteps={steps.length} labels={steps.map(s => s.label)} />

          <div className="min-h-[400px]">
            {currentStepLabel === 'A' && (
              <StepMotivation
                trigger={form.triggerOnboarding}
                autoeficacia={form.autoeficacia}
                onTriggerChange={v => set('triggerOnboarding', v)}
                onAutoeficaciaChange={v => set('autoeficacia', v)}
              />
            )}
            {currentStepLabel === 'B' && (
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
            {currentStepLabel === 'C' && (
              <StepRealFood
                diaTipico={form.diaTipico}
                comidasFavoritas={form.comidasFavoritas}
                alimentosEvitarExtra={form.alimentosEvitarExtra}
                alcoholSemanal={form.alcoholSemanal}
                suplementos={form.suplementos}
                onDiaTipicoChange={v => set('diaTipico', v)}
                onComidasFavoritasChange={v => set('comidasFavoritas', v)}
                onAlimentosEvitarChange={v => set('alimentosEvitarExtra', v)}
                onAlcoholChange={v => set('alcoholSemanal', v)}
                onSuplementosChange={v => set('suplementos', v)}
              />
            )}
            {currentStepLabel === 'D' && (
              <StepTiming
                horaPrimeraIngesta={form.horaPrimeraIngesta}
                horaComidaPrincipal={form.horaComidaPrincipal}
                horaUltimaIngesta={form.horaUltimaIngesta}
                horaEntreno={form.horaEntreno}
                patronesEnergia={form.patronesEnergia}
                onHoraChange={(field, v) => set(field as keyof FormState, v as never)}
                onPatronesChange={v => set('patronesEnergia', v)}
                esAtleta={esAtleta}
              />
            )}
            {currentStepLabel === 'E' && (
              <StepSocial
                conQuienCome={form.conQuienCome}
                frecuenciaFuera={form.frecuenciaFuera}
                comidaTrampa={form.comidaTrampa}
                onConQuienChange={v => set('conQuienCome', v)}
                onFrecuenciaChange={v => set('frecuenciaFuera', v)}
                onComidaTrampaChange={v => set('comidaTrampa', v)}
              />
            )}
            {currentStepLabel === 'F' && (
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
            {currentStepLabel === 'G' && (
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
            {currentStepLabel === 'H' && (
              <StepAnalisis
                segmento={(segmento || 'standard') as Segmento}
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
                onComposicionChange={(field, v) => set(field as keyof FormState, v as never)}
              />
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="btn-secondary disabled:opacity-40"
            >
              Atrás
            </button>

            <div className="flex items-center gap-2">
              {/* Skip disponible en pasos no obligatorios */}
              {currentStepLabel !== 'A' && currentStepLabel !== 'C' && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] px-3 py-2"
                >
                  Saltar
                </button>
              )}

              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  disabled={!puedeAvanzar()}
                  className="btn-primary disabled:opacity-40"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-primary disabled:opacity-40"
                >
                  {loading ? 'Generando tu plan...' : '✨ Crear mi plan personalizado'}
                </button>
              )}
            </div>
          </div>
        </div>

        {clienteId && (
          <p className="text-center text-xs text-[var(--text-muted)] mt-4">
            Puedes completar esto más tarde desde tu perfil.{' '}
            <button
              type="button"
              onClick={() => router.push(`/cliente/${clienteId}/dashboard`)}
              className="underline hover:text-[var(--text)]"
            >
              Ir al dashboard
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
