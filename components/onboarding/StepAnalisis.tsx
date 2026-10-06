'use client'

import type { Segmento } from './StepSegment'
import { MARCADORES_BASE, MARCADORES_ELITE, MARCADORES_PERFORMANCE } from '@/lib/analiticas-marcadores'

// ── Marcadores por tier ─────────────────────────────────────────────────────

const TESTS_RECOMENDADOS_ELITE = [
  { id: 'dexa', label: 'DEXA scan', desc: 'Gold standard composición corporal: % grasa, masa muscular, densidad ósea (~50-80€ en clínica privada)' },
  { id: 'vo2max', label: 'Test VO2max / umbral', desc: 'Capacidad aeróbica máxima y umbrales de entrenamiento (laboratorio de fisiología deportiva)' },
  { id: 'micronutrientes', label: 'Panel micronutrientes completo', desc: 'Vitaminas A, C, E, K, B-complex, minerales traza — laboratorios privados (Genova, Synlab)' },
  { id: 'microbioma', label: 'Análisis de microbioma intestinal', desc: 'Para digestión crónica o rendimiento. Útil si hay hinchazón o intolerancias sin diagnosticar (~200€)' },
  { id: 'intolerancia_ig4', label: 'Panel intolerancias IgG4', desc: 'Alimentos que generan respuesta inflamatoria retardada. Controvertido pero informativo (~150€)' },
  { id: 'hormonas_completo', label: 'Panel hormonal completo', desc: 'Testosterona libre/total, DHEA-S, estradiol, progesterona, cortisol 24h. Endocrinólogo o clínica deportiva' },
  { id: 'calorimetria', label: 'Calorimetría indirecta', desc: 'Medición real del metabolismo basal — más preciso que cualquier fórmula (~100€ en clínica)' },
]

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  segmento: Segmento
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
  onDisponiblesChange: (v: string[]) => void
  onValoresChange: (v: Record<string, string>) => void
  onTestsPendientesChange: (v: string[]) => void
  onNotasChange: (v: string) => void
  onComposicionChange: (field: string, v: string | number) => void
}

export default function StepAnalisis({
  segmento, analisisDisponibles, analisisValores, testsPendientes, notasAnalisis,
  composicionMetodo, composicionGrasaPct, composicionMasaMuscularKg,
  composicionObjetivoGrasaPct, pesoCompeticion, vo2max,
  onDisponiblesChange, onValoresChange, onTestsPendientesChange,
  onNotasChange, onComposicionChange,
}: Props) {
  const isPerformance = segmento === 'performance' || segmento === 'elite'
  const isElite = segmento === 'elite'

  const marcadores = [
    ...MARCADORES_BASE,
    ...(isPerformance ? MARCADORES_PERFORMANCE : []),
    ...(isElite ? MARCADORES_ELITE : []),
  ]

  const toggleDisponible = (key: string) => {
    if (analisisDisponibles.includes(key)) {
      onDisponiblesChange(analisisDisponibles.filter(k => k !== key))
      const rest = { ...analisisValores }
      delete rest[key]
      onValoresChange(rest)
    } else {
      onDisponiblesChange([...analisisDisponibles, key])
    }
  }

  const setValor = (key: string, val: string) =>
    onValoresChange({ ...analisisValores, [key]: val })

  const toggleTest = (id: string) =>
    onTestsPendientesChange(
      testsPendientes.includes(id)
        ? testsPendientes.filter(t => t !== id)
        : [...testsPendientes, id]
    )

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">
        {isElite ? 'Analítica y composición corporal' : isPerformance ? 'Marcadores de salud y rendimiento' : 'Analítica reciente'}
      </h2>
      <p className="text-[var(--text-muted)] mb-4 text-sm">
        {isElite
          ? 'Los marcadores biológicos permiten ajustar el plan con una precisión que ninguna fórmula puede alcanzar. Rellena los que tengas disponibles.'
          : isPerformance
          ? 'Algunos valores sanguíneos revelan limitantes ocultos del rendimiento que la dieta puede corregir.'
          : 'Si tienes analítica reciente, puedo personalizar mejor el plan. Es completamente opcional.'}
      </p>

      {/* ── Marcadores sanguíneos ── */}
      <div className="mb-6">
        <p className="text-sm font-medium text-[var(--text)] mb-3">
          Marca los valores que tienes disponibles e introduce el resultado
        </p>
        <div className="space-y-2">
          {marcadores.map(m => {
            const activo = analisisDisponibles.includes(m.key)
            return (
              <div
                key={m.key}
                className={`rounded-xl border-2 transition-all ${
                  activo ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleDisponible(m.key)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <div className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center text-xs transition-all ${
                    activo ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)]'
                  }`}>
                    {activo && '✓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[var(--text)] text-sm">{m.label}</span>
                      <span className="text-xs text-[var(--text-muted)]">{m.unit}</span>
                      <span className="text-xs text-[var(--text-muted)]">· Ref: {m.ref}</span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{m.why}</div>
                  </div>
                </button>
                {activo && (
                  <div className="px-3 pb-3">
                    <input
                      type="text"
                      value={analisisValores[m.key] ?? ''}
                      onChange={e => setValor(m.key, e.target.value)}
                      className="input w-full text-sm"
                      placeholder={`Valor en ${m.unit} — ej: 45`}
                      autoFocus={analisisDisponibles[analisisDisponibles.length - 1] === m.key}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Composición corporal (performance + elite) ── */}
      {isPerformance && (
        <div className="mb-6">
          <p className="text-sm font-medium text-[var(--text)] mb-3">Composición corporal</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Método de medición</label>
              <select
                value={composicionMetodo}
                onChange={e => onComposicionChange('composicionMetodo', e.target.value)}
                className="input w-full text-sm"
              >
                <option value="">No medido</option>
                <option value="dexa">DEXA scan</option>
                <option value="plicometria">Plicometría (calipers)</option>
                <option value="bioimpedancia">Bioimpedancia</option>
                <option value="visual_estimado">Estimación visual</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">% Grasa corporal actual</label>
              <input
                type="number"
                min={3} max={60} step={0.1}
                value={composicionGrasaPct || ''}
                onChange={e => onComposicionChange('composicionGrasaPct', parseFloat(e.target.value) || 0)}
                className="input w-full text-sm"
                placeholder="Ej: 18.5"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Masa muscular (kg)</label>
              <input
                type="number"
                min={20} max={100} step={0.1}
                value={composicionMasaMuscularKg || ''}
                onChange={e => onComposicionChange('composicionMasaMuscularKg', parseFloat(e.target.value) || 0)}
                className="input w-full text-sm"
                placeholder="Ej: 45.2"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">% Grasa objetivo</label>
              <input
                type="number"
                min={3} max={40} step={0.5}
                value={composicionObjetivoGrasaPct || ''}
                onChange={e => onComposicionChange('composicionObjetivoGrasaPct', parseFloat(e.target.value) || 0)}
                className="input w-full text-sm"
                placeholder="Ej: 14"
              />
            </div>
            {isElite && (
              <>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Peso de competición (kg)</label>
                  <input
                    type="number"
                    min={40} max={200} step={0.5}
                    value={pesoCompeticion || ''}
                    onChange={e => onComposicionChange('pesoCompeticion', parseFloat(e.target.value) || 0)}
                    className="input w-full text-sm"
                    placeholder="Ej: 74.5 (categoría powerlifting)"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">VO2max (ml/kg/min)</label>
                  <input
                    type="number"
                    min={20} max={90} step={0.5}
                    value={vo2max || ''}
                    onChange={e => onComposicionChange('vo2max', parseFloat(e.target.value) || 0)}
                    className="input w-full text-sm"
                    placeholder="Ej: 52.3 (si lo tienes medido)"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tests recomendados (elite) ── */}
      {isElite && (
        <div className="mb-6">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-lg">🔬</span>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Pruebas recomendadas para máxima precisión</p>
              <p className="text-xs text-[var(--text-muted)]">
                Si no las tienes, marca las que te interesaría hacer. Las tendremos en cuenta para la hoja de ruta.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {TESTS_RECOMENDADOS_ELITE.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTest(t.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  testsPendientes.includes(t.id)
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-[var(--border)] hover:border-emerald-300'
                }`}
              >
                <div className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center text-xs mt-0.5 transition-all ${
                  testsPendientes.includes(t.id)
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-[var(--border)]'
                }`}>
                  {testsPendientes.includes(t.id) && '✓'}
                </div>
                <div>
                  <div className="font-medium text-sm text-[var(--text)]">{t.label}</div>
                  <div className="text-xs text-[var(--text-muted)]">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Notas libres ── */}
      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          ¿Algo más que deba saber sobre tu salud o analíticas?
          <span className="text-[var(--text-muted)] font-normal ml-1">(opcional)</span>
        </label>
        <textarea
          value={notasAnalisis}
          onChange={e => onNotasChange(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Ej: tengo anemia ferropénica diagnosticada / mi médico dijo que el cortisol está alto / tomo levotiroxina 50 mcg..."
        />
      </div>
    </div>
  )
}
