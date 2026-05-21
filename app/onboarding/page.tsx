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

const TOTAL_STEPS = 6

/* Steps that auto-advance when a single option is selected */
const AUTO_ADVANCE_STEPS = new Set([0, 1, 5])

interface FormState {
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
}

const INITIAL: FormState = {
  segmento: '',
  objetivo: '',
  body: { peso: 0, altura: 0, edad: 0, sexo: '' },
  actividad: '',
  diasEntreno: 3,
  tipoEntreno: [],
  duracionSesionMin: 60,
  restricciones: [],
  alimentosNoGustan: '',
  nivelCocina: '',
  tiempoCocinaMin: 30,
  presupuestoSemanal: 0,
}

const STEP_LABELS = ['Perfil', 'Objetivo', 'Cuerpo', 'Actividad', 'Dieta', 'Cocina']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward')
  const [visible, setVisible] = useState(true)
  const [autoAdvanceRequest, setAutoAdvanceRequest] = useState({ id: 0, fromStep: 0 })

  useEffect(() => {
    if (autoAdvanceRequest.id === 0) return

    let transitionTimer: ReturnType<typeof setTimeout> | null = null
    const autoTimer = setTimeout(() => {
      setAnimDir('forward')
      setVisible(false)
      transitionTimer = setTimeout(() => {
        setStep(prev => prev === autoAdvanceRequest.fromStep ? Math.min(prev + 1, TOTAL_STEPS - 1) : prev)
        setVisible(true)
      }, 180)
    }, 260)

    return () => {
      clearTimeout(autoTimer)
      if (transitionTimer) clearTimeout(transitionTimer)
    }
  }, [autoAdvanceRequest])

  function navigate(targetStep: number) {
    const dir = targetStep > step ? 'forward' : 'back'
    setAnimDir(dir)
    setVisible(false)
    setTimeout(() => {
      setStep(targetStep)
      setVisible(true)
    }, 180)
  }

  function goNext() {
    if (step < TOTAL_STEPS - 1) navigate(step + 1)
  }

  function goBack() {
    if (step > 0) navigate(step - 1)
  }

  /* Auto-advance handler — used by single-select steps */
  function handleAutoAdvance<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      if (AUTO_ADVANCE_STEPS.has(step)) {
        setAutoAdvanceRequest(prev => ({ id: prev.id + 1, fromStep: step }))
      }
    }
  }

  const canContinue = (): boolean => {
    if (step === 0) return !!form.segmento
    if (step === 1) return !!form.objetivo
    if (step === 2) return form.body.peso > 0 && form.body.altura > 0 && form.body.edad > 0 && !!form.body.sexo
    if (step === 3) return !!form.actividad
    if (step === 4) return true
    if (step === 5) return !!form.nivelCocina
    return false
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      router.push('/onboarding/perfil')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
      setLoading(false)
    }
  }

  const isLastStep = step === TOTAL_STEPS - 1

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 pt-safe h-14 flex-shrink-0">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-0"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Paso anterior"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>

        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {step + 1} / {TOTAL_STEPS}
        </span>

        {/* Step labels */}
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {STEP_LABELS[step]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-0">
        <OnboardingProgress currentStep={step} totalSteps={TOTAL_STEPS} />
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-4">
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible
              ? 'translateX(0)'
              : animDir === 'forward' ? 'translateX(16px)' : 'translateX(-16px)',
            transition: 'opacity 0.18s ease, transform 0.18s ease',
          }}
        >
          {step === 0 && (
            <StepSegment
              value={form.segmento}
              onChange={handleAutoAdvance<Segmento>(v => setForm(f => ({ ...f, segmento: v })))}
            />
          )}
          {step === 1 && (
            <StepGoal
              value={form.objetivo}
              onChange={handleAutoAdvance<Objetivo>(v => setForm(f => ({ ...f, objetivo: v })))}
            />
          )}
          {step === 2 && (
            <StepBody
              value={form.body}
              onChange={v => setForm(f => ({ ...f, body: v }))}
            />
          )}
          {step === 3 && (
            <StepActivity
              actividad={form.actividad}
              diasEntreno={form.diasEntreno}
              tipoEntreno={form.tipoEntreno}
              duracionSesionMin={form.duracionSesionMin}
              onActividadChange={v => setForm(f => ({ ...f, actividad: v }))}
              onDiasChange={v => setForm(f => ({ ...f, diasEntreno: v }))}
              onTipoChange={v => setForm(f => ({ ...f, tipoEntreno: v }))}
              onDuracionChange={v => setForm(f => ({ ...f, duracionSesionMin: v }))}
            />
          )}
          {step === 4 && (
            <StepRestrictions
              restricciones={form.restricciones}
              alimentosNoGustan={form.alimentosNoGustan}
              onRestriccionesChange={v => setForm(f => ({ ...f, restricciones: v }))}
              onAlimentosNogustanChange={v => setForm(f => ({ ...f, alimentosNoGustan: v }))}
            />
          )}
          {step === 5 && (
            <StepCooking
              nivelCocina={form.nivelCocina}
              tiempoCocinaMin={form.tiempoCocinaMin}
              presupuestoSemanal={form.presupuestoSemanal}
              onNivelChange={handleAutoAdvance<NivelCocina>(v => setForm(f => ({ ...f, nivelCocina: v })))}
              onTiempoChange={v => setForm(f => ({ ...f, tiempoCocinaMin: v }))}
              onPresupuestoChange={v => setForm(f => ({ ...f, presupuestoSemanal: v }))}
            />
          )}

          {error && (
            <div className="mt-5 px-4 py-3 rounded-2xl text-sm" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(255,69,58,0.2)' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      {/* Hidden on auto-advance steps when a selection exists (they advance automatically),
          but always visible on data-entry steps and as fallback */}
      <div className="px-5 pb-safe-or-6 flex-shrink-0"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)' }}>

        {/* On auto-advance steps: only show CTA if no selection yet */}
        {AUTO_ADVANCE_STEPS.has(step) && !canContinue() ? (
          <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
            Selecciona una opción para continuar
          </p>
        ) : AUTO_ADVANCE_STEPS.has(step) && canContinue() ? (
          /* Already selected — show subtle skip in case auto-advance didn't fire */
          <button
            type="button"
            onClick={isLastStep ? handleSubmit : goNext}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm cursor-pointer transition-all active:scale-[0.98]"
            style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)' }}
          >
            {isLastStep ? (loading ? <><Loader2 size={16} className="animate-spin" /> Generando tu perfil…</> : 'Finalizar') : 'Continuar'}
            {!loading && <ArrowRight size={15} />}
          </button>
        ) : (
          /* Data-entry steps: prominent CTA */
          <button
            type="button"
            onClick={isLastStep ? handleSubmit : goNext}
            disabled={!canContinue() || loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm cursor-pointer transition-all active:scale-[0.98] disabled:opacity-40"
            style={{
              background: canContinue() && !loading
                ? 'var(--text)'
                : 'var(--surface)',
              color: canContinue() && !loading ? 'var(--bg)' : 'var(--text-muted)',
              border: '1.5px solid transparent',
            }}
          >
            {isLastStep
              ? loading
                ? <><Loader2 size={16} className="animate-spin" /> Generando tu perfil…</>
                : 'Finalizar y generar perfil'
              : <>Continuar <ArrowRight size={15} /></>
            }
          </button>
        )}
      </div>
    </div>
  )
}
