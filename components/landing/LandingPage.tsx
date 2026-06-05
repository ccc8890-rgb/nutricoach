'use client'
import { useState } from 'react'

const PLANES_LANDING = [
  {
    id: 'base' as const,
    nombre: 'Plan Base',
    periodo: 'Trimestral',
    precio: 300,
    features: [
      'Nutrición diseñada para tu estilo de vida',
      'Acceso a la app exclusiva',
      'Libro de recetas premium',
      'Chat directo',
      'Seguimiento y ajustes periódicos',
      'Entrenamiento estructurado',
    ],
  },
  {
    id: 'pro' as const,
    nombre: 'Plan Pro',
    periodo: 'Semestral',
    precio: 500,
    destacado: true as const,
    features: [
      'Todo lo del Plan Base',
      'Seguimiento más frecuente',
      'Ajustes dinámicos por fase',
      'Archivo premium de recursos',
      'Acompañamiento prioritario',
    ],
  },
  {
    id: 'ultra' as const,
    nombre: 'Plan Ultra',
    periodo: 'Anual',
    precio: 800,
    features: [
      'Todo lo del Plan Pro',
      'Plan detallado año completo',
      'Acceso total a todos los módulos',
      'Soporte 7 días / semana',
      'Revisiones ilimitadas',
    ],
  },
]

const FAQ = [
  {
    q: '¿Cómo funciona el servicio online?',
    a: 'Tras el pago recibirás acceso a tu portal personal. Allí completarás tu perfil y recibirás tu plan en 48-72 horas.',
  },
  {
    q: '¿Es adecuado para mí aunque no haga deporte habitualmente?',
    a: 'Sí. El plan se adapta completamente a tu nivel, disponibilidad y objetivos. No necesitas experiencia previa.',
  },
  {
    q: '¿Cuándo es el mejor momento para empezar?',
    a: 'Ahora. No existe el "momento perfecto". El método está diseñado para adaptarse a tu vida, no al revés.',
  },
  {
    q: '¿Qué pasa si me desmotivo?',
    a: 'Estarás acompañado en todo el proceso. El chat directo permite resolver dudas y ajustar el plan cuando lo necesites.',
  },
  {
    q: '¿Puedo seguirlo con una agenda muy exigente?',
    a: 'Es uno de los pilares del método. Se diseña específicamente para encajar con tus horarios y compromisos.',
  },
  {
    q: '¿Cuánto tarda en llegar mi plan?',
    a: 'Entre 48 y 72 horas tras completar tu perfil en la app.',
  },
]

export default function LandingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [faqAbierto, setFaqAbierto] = useState<number | null>(null)

  async function handleComprar(planId: 'base' | 'pro' | 'ultra') {
    setLoadingPlan(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_tipo: planId }),
      })
      const { url, error } = await res.json()
      if (url) window.location.href = url
      else alert(error || 'Error al iniciar el pago')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-xl font-bold mb-6"
          style={{ background: 'linear-gradient(135deg,#2C2C2E,#3A3A3C)', color: '#fff', boxShadow: '0 4px 16px rgba(44,44,46,0.2)' }}>
          CN
        </div>
        <div className="flex gap-3 mb-4 text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}>
          <span>MÉTODO</span><span>·</span><span>CONSTANCIA</span><span>·</span><span>EVOLUCIÓN</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 max-w-xl leading-tight">
          Nutrición personalizada que transforma
        </h1>
        <p className="text-lg mb-8 max-w-md" style={{ color: 'var(--text-secondary)' }}>
          Un método basado en ciencia y acompañamiento real. Sin restricciones extremas, con resultados duraderos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a href="#precios"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg,#2C2C2E,#3A3A3C)', color: '#fff', boxShadow: '0 2px 8px rgba(44,44,46,0.25)' }}>
            Empieza ya
          </a>
          <a href="https://wa.me/34697456148" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl font-semibold text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            💬 Escríbeme
          </a>
        </div>
      </section>

      {/* PROCESO */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">Nuestro proceso</h2>
        <p className="text-center mb-12" style={{ color: 'var(--text-secondary)' }}>Tres fases diseñadas para una transformación sostenible</p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { num: '01', titulo: 'Reprogramación Corporal', desc: 'Aplicación de sobrecarga progresiva y ajustes nutricionales para mejorar densidad muscular y redefinir composición corporal.' },
            { num: '02', titulo: 'Optimización Metabólica', desc: 'Creación de entorno hormonal favorable mediante ajustes estratégicos para reducción de grasa y preservación muscular.' },
            { num: '03', titulo: 'Integración y Plenitud', desc: 'Educación nutricional y programación sostenible para mantener equilibrio metabólico duradero.' },
          ].map(f => (
            <div key={f.num} className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-3xl font-bold mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>{f.num}</div>
              <h3 className="font-semibold mb-2">{f.titulo}</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* APP FEATURES */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">App exclusiva</h2>
        <p className="text-center mb-12" style={{ color: 'var(--text-secondary)' }}>Todo lo que necesitas en un solo lugar</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            'Dieta y entrenamiento integrados',
            'Plan de nutrición personalizado',
            'Entrenamientos con videos explicativos',
            'Chat directo integrado',
            'Seguimiento continuo y métricas',
            'Ajustes dinámicos por fase',
            'Archivo premium de recursos',
            'Acompañamiento prioritario',
          ].map(f => (
            <div key={f} className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span style={{ color: '#22c55e' }}>✓</span>
              <span className="text-sm">{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PARA QUIÉN ES */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">¿Para quién es?</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            'Buscas una forma física sólida y duradera, no soluciones temporales',
            'Tienes una agenda exigente pero estás comprometido con tu salud',
            'Has probado antes sin conseguir resultados duraderos',
            'Quieres flexibilidad social sin sacrificar tu progreso',
          ].map((t, i) => (
            <div key={i} className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">Resultados reales</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { nombre: 'Maria', texto: 'Conseguí mi objetivo de perder 12kg en 12 semanas y estuve acompañada en todo el proceso.' },
            { nombre: 'Dani', texto: 'Me siento con más energía y seguro de mí mismo. Afronto mi emprendimiento con otro mindset.' },
            { nombre: 'Matias', texto: 'Nunca había sentido un plan tan adaptado a mí. Preciso, claro y transformador.' },
          ].map(t => (
            <div key={t.nombre} className="p-6 rounded-2xl flex flex-col gap-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>"{t.texto}"</p>
              <p className="font-semibold text-sm">{t.nombre}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">Planes</h2>
        <p className="text-center mb-12" style={{ color: 'var(--text-secondary)' }}>Elige el que mejor se adapta a ti</p>
        <div className="grid sm:grid-cols-3 gap-6">
          {PLANES_LANDING.map(plan => (
            <div key={plan.id}
              className="p-6 rounded-2xl flex flex-col gap-4 relative"
              style={{
                background: plan.destacado === true ? 'linear-gradient(135deg,#2C2C2E,#3A3A3C)' : 'var(--surface)',
                border: plan.destacado === true ? 'none' : '1px solid var(--border)',
                color: plan.destacado === true ? '#fff' : 'var(--text)',
              }}>
              {plan.destacado === true && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-yellow-400 text-yellow-900">
                  MÁS POPULAR
                </span>
              )}
              <div>
                <div className="font-bold text-lg">{plan.nombre}</div>
                <div className="text-sm opacity-70">{plan.periodo}</div>
              </div>
              <div className="text-3xl font-bold">{plan.precio}€</div>
              <ul className="space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span style={{ color: plan.destacado === true ? '#86efac' : '#22c55e' }}>✓</span>
                    <span style={{ opacity: plan.destacado === true ? 0.9 : 1 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleComprar(plan.id)}
                disabled={loadingPlan === plan.id}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                style={plan.destacado === true
                  ? { background: '#fff', color: '#2C2C2E' }
                  : { background: 'linear-gradient(135deg,#2C2C2E,#3A3A3C)', color: '#fff' }
                }>
                {loadingPlan === plan.id ? 'Redirigiendo…' : 'Empezar ahora'}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          ¿Tienes dudas antes de elegir?{' '}
          <a href="https://wa.me/34697456148" target="_blank" rel="noopener noreferrer"
            className="underline font-medium">
            Agenda una llamada
          </a>
        </p>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">Preguntas frecuentes</h2>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)' }}>
              <button
                className="w-full text-left px-5 py-4 flex items-center justify-between font-medium text-sm"
                style={{ background: 'var(--surface)' }}
                onClick={() => setFaqAbierto(faqAbierto === i ? null : i)}>
                {item.q}
                <span style={{ color: 'var(--text-secondary)' }}>{faqAbierto === i ? '−' : '+'}</span>
              </button>
              {faqAbierto === i && (
                <div className="px-5 py-3 text-sm" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center px-6 py-10 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="font-bold mb-1">Casanova Nutrition</div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Nutrición personalizada basada en ciencia
        </p>
        <div className="flex gap-4 justify-center text-sm">
          <a href="https://wa.me/34697456148" target="_blank" rel="noopener noreferrer"
            className="underline" style={{ color: 'var(--text-secondary)' }}>WhatsApp</a>
          <a href="mailto:ccc8890@gmail.com"
            className="underline" style={{ color: 'var(--text-secondary)' }}>Email</a>
        </div>
      </footer>

    </div>
  )
}
