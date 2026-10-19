/** Título de una fase de la receta (Bizcocho, Salsa…): marca con brillo + nombre legible + filete. Vale en claro y oscuro. */
export function FaseTitulo({ nombre, className = '' }: { nombre: string; className?: string }) {
    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <span
                aria-hidden
                className="h-2 w-2 shrink-0"
                style={{ background: 'var(--accent)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 10px 1px color-mix(in srgb, var(--accent) 55%, transparent)' }}
            />
            <span
                className="shrink-0 text-xs font-bold uppercase"
                style={{ color: 'var(--text)', letterSpacing: '0.14em', fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
            >
                {nombre}
            </span>
            <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(to right, var(--border-strong, var(--border)), transparent)' }} />
        </div>
    )
}
