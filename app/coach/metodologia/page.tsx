'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { MetodologiaCoach } from '@/types'

type FormField = Omit<MetodologiaCoach, 'id' | 'coach_id' | 'updated_at'>

const OBJETIVOS: { key: keyof FormField; label: string }[] = [
  { key: 'proteina_perdida_grasa',    label: 'Pérdida de grasa' },
  { key: 'proteina_recomposicion',    label: 'Recomposición' },
  { key: 'proteina_rendimiento',      label: 'Rendimiento deportivo' },
  { key: 'proteina_ganancia_musculo', label: 'Ganancia muscular' },
  { key: 'proteina_salud_general',    label: 'Salud general' },
]

const ESTILOS_DISPONIBLES = [
  { id: 'mediterraneo',  label: 'Mediterráneo' },
  { id: 'flexible',      label: 'Flexible (tracking macros)' },
  { id: 'plant_based',   label: 'Plant-based / vegetariano' },
  { id: 'keto',          label: 'Keto / low-carb' },
  { id: 'high_protein',  label: 'Alto en proteína' },
  { id: 'sin_gluten',    label: 'Sin gluten' },
]

const DEFAULTS: FormField = {
  proteina_perdida_grasa: 2.2,
  proteina_recomposicion: 2.0,
  proteina_rendimiento: 1.8,
  proteina_ganancia_musculo: 2.0,
  proteina_salud_general: 1.0,
  reglas_fijas: [],
  estilos_dieta: ['mediterraneo', 'flexible'],
  filosofia_coaching: '',
  num_comidas_default: 4,
  deficit_maximo_kcal: 500,
  superavit_maximo_kcal: 400,
}

export default function MetodologiaPage() {
  const [form, setForm] = useState<FormField>(DEFAULTS)
  const [nuevaRegla, setNuevaRegla] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/metodologia-coach')
        const data = await res.json()
        if (data.metodologia) {
          const { id, coach_id, updated_at, ...rest } = data.metodologia
          void id; void coach_id; void updated_at
          setForm({ ...DEFAULTS, ...rest })
        }
      } catch {
        // Sin datos — usar defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/metodologia-coach', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const toggleEstilo = (id: string) => {
    setForm(f => ({
      ...f,
      estilos_dieta: f.estilos_dieta.includes(id)
        ? f.estilos_dieta.filter(e => e !== id)
        : [...f.estilos_dieta, id],
    }))
  }

  const addRegla = () => {
    const trimmed = nuevaRegla.trim()
    if (!trimmed) return
    setForm(f => ({ ...f, reglas_fijas: [...f.reglas_fijas, trimmed] }))
    setNuevaRegla('')
  }

  const removeRegla = (idx: number) => {
    setForm(f => ({ ...f, reglas_fijas: f.reglas_fijas.filter((_, i) => i !== idx) }))
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Mi metodología</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1,2,3].map(i => (
            <div key={i} className="card animate-pulse" style={{ height: '120px', background: 'rgba(255,255,255,0.05)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi metodología</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            La IA usa estas reglas en cada plan que genera. Tú controlas la lógica.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Proteína por objetivo */}
        <div className="card">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Proteína por objetivo (g/kg peso corporal)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {OBJETIVOS.map(({ key, label }) => (
              <div key={key}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                  {label}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="range"
                    min={0.8}
                    max={3.0}
                    step={0.1}
                    value={form[key] as number}
                    onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) }))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: '2.5rem', textAlign: 'right' }}>
                    {(form[key] as number).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Déficit / superávit máximo */}
        <div className="card">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Límites calóricos
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Déficit máximo (kcal)
              </label>
              <input
                type="number"
                className="input"
                min={100}
                max={1000}
                value={form.deficit_maximo_kcal}
                onChange={e => setForm(f => ({ ...f, deficit_maximo_kcal: parseInt(e.target.value) || 500 }))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Superávit máximo (kcal)
              </label>
              <input
                type="number"
                className="input"
                min={100}
                max={800}
                value={form.superavit_maximo_kcal}
                onChange={e => setForm(f => ({ ...f, superavit_maximo_kcal: parseInt(e.target.value) || 400 }))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Nº comidas por defecto
              </label>
              <input
                type="number"
                className="input"
                min={2}
                max={7}
                value={form.num_comidas_default}
                onChange={e => setForm(f => ({ ...f, num_comidas_default: parseInt(e.target.value) || 4 }))}
              />
            </div>
          </div>
        </div>

        {/* Reglas fijas */}
        <div className="card">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Reglas que siempre aplico
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {form.reglas_fijas.map((regla, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                <span style={{ color: 'rgb(34,197,94)', fontWeight: 600 }}>✓</span>
                <span style={{ flex: 1, fontSize: '0.875rem' }}>{regla}</span>
                <button
                  onClick={() => removeRegla(i)}
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                  title="Eliminar regla"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input"
              placeholder="Añadir regla… (ej: Desayuno siempre con ≥25g proteína)"
              value={nuevaRegla}
              onChange={e => setNuevaRegla(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRegla()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={addRegla}>Añadir</button>
          </div>
        </div>

        {/* Estilo de alimentación */}
        <div className="card">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Estilo de alimentación preferido
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {ESTILOS_DISPONIBLES.map(({ id, label }) => {
              const activo = form.estilos_dieta.includes(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleEstilo(id)}
                  style={{
                    padding: '0.35rem 1rem',
                    borderRadius: '20px',
                    border: activo ? '1px solid rgba(34,197,94,0.5)' : '1px solid var(--border)',
                    background: activo ? 'rgba(34,197,94,0.15)' : 'transparent',
                    color: activo ? 'rgb(34,197,94)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: activo ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Filosofía */}
        <div className="card">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Mi filosofía de coaching
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            La IA lee esto como contexto adicional al generar planes. Escribe lo que te define como coach.
          </p>
          <textarea
            className="input"
            rows={5}
            placeholder="Priorizo la adherencia por encima de la perfección. Un plan que el cliente sigue al 80% es mejor que uno perfecto que abandona en semana 2…"
            value={form.filosofia_coaching}
            onChange={e => setForm(f => ({ ...f, filosofia_coaching: e.target.value }))}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {form.filosofia_coaching.length} caracteres
          </p>
        </div>

      </div>

      {/* Botón bottom para móvil */}
      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: '160px' }}
        >
          {saving ? 'Guardando…' : saved ? '✓ Cambios guardados' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
