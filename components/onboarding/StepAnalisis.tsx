'use client'

import type { Segmento } from './StepSegment'

// ── Marcadores por tier ─────────────────────────────────────────────────────

const MARCADORES_BASE = [
  { key: 'glucosa', label: 'Glucosa en ayunas', unit: 'mg/dL', ref: '70-99', why: 'Metabolismo de carbohidratos' },
  { key: 'hba1c', label: 'HbA1c', unit: '%', ref: '<5.7', why: 'Control glucémico últimos 3 meses' },
  { key: 'colesterol_total', label: 'Colesterol total', unit: 'mg/dL', ref: '<200', why: 'Salud cardiovascular' },
  { key: 'ldl', label: 'LDL (colesterol malo)', unit: 'mg/dL', ref: '<100', why: 'Riesgo cardiovascular' },
  { key: 'hdl', label: 'HDL (colesterol bueno)', unit: 'mg/dL', ref: '>60', why: 'Protector cardiovascular' },
  { key: 'trigliceridos', label: 'Triglicéridos', unit: 'mg/dL', ref: '<150', why: 'Metabolismo graso' },
  { key: 'tsh', label: 'TSH (tiroides)', unit: 'mUI/L', ref: '0.4-4.0', why: 'Metabolismo basal' },
  { key: 'vitamina_d', label: 'Vitamina D (25-OH)', unit: 'ng/mL', ref: '30-80', why: 'Inmunidad, huesos, músculo' },
  { key: 'hierro', label: 'Hierro sérico', unit: 'µg/dL', ref: '60-170', why: 'Energía y transporte de oxígeno' },
  { key: 'ferritina', label: 'Ferritina', unit: 'ng/mL', ref: '20-300', why: 'Reservas de hierro, recuperación' },
]

const MARCADORES_PERFORMANCE = [
  { key: 'b12', label: 'Vitamina B12', unit: 'pg/mL', ref: '200-900', why: 'Energía, sistema nervioso' },
  { key: 'acido_folico', label: 'Ácido fólico', unit: 'ng/mL', ref: '3-20', why: 'Síntesis de ADN, eritrocitos' },
  { key: 'zinc', label: 'Zinc', unit: 'µg/dL', ref: '60-130', why: 'Testosterona, inmunidad, recuperación' },
  { key: 'magnesio', label: 'Magnesio', unit: 'mg/dL', ref: '1.6-2.6', why: 'Función muscular, sueño, energía' },
  { key: 'hemoglobina', label: 'Hemoglobina', unit: 'g/dL', ref: 'H:13.5-17.5 / M:12-15.5', why: 'Transporte de oxígeno' },
  { key: 'hematocrito', label: 'Hematocrito', unit: '%', ref: 'H:41-53 / M:36-46', why: 'Capacidad aeróbica' },
  { key: 'cpk', label: 'CPK (creatina quinasa)', unit: 'U/L', ref: 'H:<200 / M:<170', why: 'Daño muscular, recuperación' },
  { key: 'pcr', label: 'PCR (inflamación)', unit: 'mg/L', ref: '<1.0', why: 'Inflamación sistémica' },
]

const MARCADORES_ELITE = [
  { key: 'testosterona_total', label: 'Testosterona total', unit: 'ng/dL', ref: 'H:300-1000 / M:15-70', why: 'Anabolismo, recuperación, libido' },
  { key: 'testosterona_libre', label: 'Testosterona libre', unit: 'pg/mL', ref: 'H:5-21', why: 'Fracción activa — más precisa' },
  { key: 'cortisol', label: 'Cortisol (mañana)', unit: 'µg/dL', ref: '6-23', why: 'Estrés, sobreentrenamiento' },
  { key: 'igf1', label: 'IGF-1', unit: 'ng/mL', ref: 'según edad', why: 'Eje GH, síntesis proteica' },
  { key: 'insulina_ayunas', label: 'Insulina en ayunas', unit: 'µU/mL', ref: '<25', why: 'Sensibilidad a insulina' },
  { key: 'homocisteina', label: 'Homocisteína', unit: 'µmol/L', ref: '<15', why: 'Riesgo cardiovascular, vitaminas B' },
  { key: 'acido_urico', label: 'Ácido úrico', unit: 'mg/dL', ref: 'H:3.5-7.2 / M:2.5-6.0', why: 'Dietas altas en proteína, gota' },
  { key: 'albumina', label: 'Albúmina', unit: 'g/dL', ref: '3.5-5.0', why: 'Estado nutricional proteico' },
  { key: 'omega3_index', label: 'Índice Omega-3', unit: '%', ref: '>8%', why: 'Inflamación, recuperación, corazón' },
  { key: 'lh_fsh', label: 'LH / FSH (mujeres)', unit: 'mUI/mL', ref: 'según fase ciclo', why: 'Función hormonal, RED-S' },
]

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
      const { [key]: _, ...rest } = analisisValores
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
