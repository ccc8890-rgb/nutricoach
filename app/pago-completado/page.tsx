export default function PagoCompletado() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(160deg, #F7F7F9 0%, #EDEDF0 100%)' }}>
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text)' }}>
          ¡Pago completado!
        </h1>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Recibirás un email en los próximos minutos con el enlace de acceso a tu portal personalizado.
          Si no lo ves, revisa la carpeta de spam.
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          ¿Dudas? Escríbenos a{' '}
          <a href="mailto:ccc8890@gmail.com" className="underline">ccc8890@gmail.com</a>
        </p>
      </div>
    </div>
  )
}
