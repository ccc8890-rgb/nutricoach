'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OnboardingProgress from '@/components/onboarding/OnboardingProgress'
import StepGoal, { type Objetivo } from '@/components/onboarding/StepGoal'
import StepBody, { type BodyData } from '@/components/onboarding/StepBody'
import StepActivity, { type ActividadBase } from '@/components/onboarding/StepActivity'
import StepRestrictions from '@/components/onboarding/StepRestrictions'
import StepCooking, { type NivelCocina } from '@/components/onboarding/StepCooking'

const STEP_LABELS = ['Objetivo', 'Cuerpo', 'Actividad', 'Dieta', 'Cocina']

interface FormState {
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

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const puedeAvanzar = (): boolean => {
    if (step === 0) return !!form.objetivo
    if (step === 1) return form.body.peso > 0 && form.body.altura > 0 && form.body.edad > 0 && !!form.body.sexo
    if (step === 2) return !!form.actividad
    if (step === 3) return true
    if (step === 4) return !!form.nivelCocina
    return false
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      router.push(`/cliente/${data.cliente_id}/dashboard?onboarding=completo`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text)]">Cuéntame sobre ti</h1>
          <p className="text-[var(--text-muted)] mt-1">Personalizo tu plan en función de tus respuestas.</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border)] p-6">
          <OnboardingProgress currentStep={step} totalSteps={5} labels={STEP_LABELS} />

          <div className="min-h-[380px]">
            {step === 0 && (
              <StepGoal value={form.objetivo} onChange={v => setForm(f => ({ ...f, objetivo: v }))} />
            )}
            {step === 1 && (
              <StepBody value={form.body} onChange={v => setForm(f => ({ ...f, body: v }))} />
            )}
            {step === 2 && (
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
            {step === 3 && (
              <StepRestrictions
                restricciones={form.restricciones}
                alimentosNoGustan={form.alimentosNoGustan}
                onRestriccionesChange={v => setForm(f => ({ ...f, restricciones: v }))}
                onAlimentosNogustanChange={v => setForm(f => ({ ...f, alimentosNoGustan: v }))}
              />
            )}
            {step === 4 && (
              <StepCooking
                nivelCocina={form.nivelCocina}
                tiempoCocinaMin={form.tiempoCocinaMin}
                presupuestoSemanal={form.presupuestoSemanal}
                onNivelChange={v => setForm(f => ({ ...f, nivelCocina: v }))}
                onTiempoChange={v => setForm(f => ({ ...f, tiempoCocinaMin: v }))}
                onPresupuestoChange={v => setForm(f => ({ ...f, presupuestoSemanal: v }))}
              />
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="btn-secondary disabled:opacity-40"
            >
              Atrás
            </button>

            {step < 4 ? (
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
                disabled={!puedeAvanzar() || loading}
                className="btn-primary disabled:opacity-40"
              >
                {loading ? 'Guardando...' : 'Empezar mi plan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
