import type { CSSProperties, ReactNode } from 'react'

// Set propio de la app: pictogramas macizos con cortes finos (estilo estarcido
// de taller), sobre una rejilla de 24 px. Cada icono es un objeto reconocible.
// Acepta las mismas props que los iconos de Phosphor que sustituye; `weight`
// se ignora (el estado activo lo marca quien lo pinta).
export type MarcaIconoProps = {
  size?: number | string
  weight?: 'fill' | 'regular' | 'bold' | 'duotone' | 'light' | 'thin'
  className?: string
  style?: CSSProperties
}

function Base({ size = 24, className, style, children }: MarcaIconoProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const trazo = { fill: 'none', stroke: 'currentColor' } as const

/** Hoy: amanecer, el suelo corta el sol. */
export const IconoHoy = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M8 16a4 4 0 0 1 8 0z" />
    <path d="M5 16a7 7 0 0 1 14 0h-1.6a5.4 5.4 0 0 0-10.8 0z" />
    <rect x={3} y={17.6} width={18} height={1.8} />
    <rect x={11.1} y={3} width={1.8} height={2.8} />
    <rect x={11.1} y={4.2} width={1.8} height={2.8} transform="rotate(-55 12 16)" />
    <rect x={11.1} y={4.2} width={1.8} height={2.8} transform="rotate(55 12 16)" />
  </Base>
)

/** Dieta: cuenco humeante. */
export const IconoDieta = (p: MarcaIconoProps) => (
  <Base {...p}>
    <rect x={3} y={10.6} width={18} height={1.8} />
    <path d="M3.8 13.6h16.4a8.2 8.2 0 0 1-16.4 0z" />
    <rect x={8} y={20.6} width={8} height={1.6} />
    <path d="M9.5 8c-1.2-1.2 1.2-2.2 0-3.8M14.5 8c-1.2-1.2 1.2-2.2 0-3.8" {...trazo} strokeWidth={1.6} strokeLinecap="round" />
  </Base>
)

/** Recetas: libro abierto. */
export const IconoRecetas = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M2.5 5.5c3.5-.7 6.5-.2 8.8 1.3v12.7c-2.3-1.5-5.3-2-8.8-1.3z" />
    <path d="M21.5 5.5c-3.5-.7-6.5-.2-8.8 1.3v12.7c2.3-1.5 5.3-2 8.8-1.3z" />
  </Base>
)

/** Fuerza / Entreno: kettlebell. */
export const IconoFuerza = (p: MarcaIconoProps) => (
  <Base {...p}>
    <circle cx={12} cy={15.4} r={6.6} />
    <path d="M8.4 8.3V7.2A1.2 1.2 0 0 1 9.6 6h4.8a1.2 1.2 0 0 1 1.2 1.2v1.1" {...trazo} strokeWidth={2} />
  </Base>
)

/** Carrera: zapatilla con la suela cortada. */
export const IconoCarrera = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 16.6V11c0-.8.6-1.4 1.4-1.4h2.2l1.2 2.2H12l2.5-3.5 3.2 2.2c2 1.4 3.8 2.4 3.8 4.5v1.6z" />
    <rect x={2.5} y={18} width={19} height={1.9} />
  </Base>
)

/** Datos: barras sobre su base. */
export const IconoDatos = (p: MarcaIconoProps) => (
  <Base {...p}>
    <rect x={3.5} y={13.5} width={4.2} height={6.3} />
    <rect x={9.9} y={9} width={4.2} height={10.8} />
    <rect x={16.3} y={4} width={4.2} height={15.8} />
    <rect x={2} y={21.2} width={20} height={1.3} />
  </Base>
)

/** Compra: cesta con el borde cortado. */
export const IconoCompra = (p: MarcaIconoProps) => (
  <Base {...p}>
    <rect x={2.5} y={9.5} width={19} height={2} />
    <path d="M4.2 13h15.6l-1.7 7H5.9z" />
    <path d="M8 9.2l3.5-5.7M16 9.2l-3.5-5.7" {...trazo} strokeWidth={1.8} />
  </Base>
)

/** Chat: bocadillo con tres huecos. */
export const IconoChat = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 4h18v13H10l-4 3.5V17H3zM7 9h2v2H7zM11 9h2v2h-2zM15 9h2v2h-2z" />
  </Base>
)

/** Check-in: tablilla con filas. */
export const IconoCheckin = (p: MarcaIconoProps) => (
  <Base {...p}>
    <rect x={9} y={2} width={6} height={2.2} />
    <path d="M5 5h14v16H5zM8 10h2v2H8zM11.5 10h5v2h-5zM8 15h2v2H8zM11.5 15h5v2h-5z" />
  </Base>
)

/** Dispositivo: móvil. */
export const IconoDispositivo = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M7 2.5h10v19H7zM9 4.5h6v12H9zM11 18h2v1.5h-2z" />
  </Base>
)

/** Tema claro. */
export const IconoSol = (p: MarcaIconoProps) => (
  <Base {...p}>
    <circle cx={12} cy={12} r={4} />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" {...trazo} strokeWidth={1.8} />
  </Base>
)

/** Tema oscuro. */
export const IconoLuna = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Base>
)

/** Salir: marco de puerta y flecha. */
export const IconoSalir = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M4 4h7v2H6v12h5v2H4z" />
    <rect x={9} y={11} width={9} height={2} />
    <path d="M16.5 7.5 21.5 12l-5 4.5z" />
  </Base>
)

/** Inicio: casa con ventana. */
export const IconoInicio = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M12 3 21.5 11H2.5z" />
    <path d="M5 12.5h14v8H5zM10.5 14.5h3v3h-3z" />
  </Base>
)

/** Clientes: dos personas. */
export const IconoClientes = (p: MarcaIconoProps) => (
  <Base {...p}>
    <circle cx={9} cy={8} r={3.2} />
    <path d="M3 20v-1.5A5.8 5.8 0 0 1 8.8 13h.4a5.8 5.8 0 0 1 5.8 5.5V20z" />
    <circle cx={17.5} cy={9} r={2.4} />
    <path d="M16.6 13.4a4.3 4.3 0 0 1 4.4 4.3V20h-4.4v-1.5a7 7 0 0 0-.6-3z" />
  </Base>
)

/** Contenido: fotograma de película. */
export const IconoContenido = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 5h18v14H3zM4.5 7h2v2h-2zM4.5 11h2v2h-2zM4.5 15h2v2h-2zM17.5 7h2v2h-2zM17.5 11h2v2h-2zM17.5 15h2v2h-2zM9 8h6v8H9z" />
  </Base>
)

/** Catálogo: tres capas apiladas. */
export const IconoCatalogo = (p: MarcaIconoProps) => (
  <Base {...p}>
    <rect x={4} y={4.5} width={16} height={4} />
    <rect x={4} y={10} width={16} height={4} />
    <rect x={4} y={15.5} width={16} height={4} />
  </Base>
)

/** Precios: tienda con toldo. */
export const IconoPrecios = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 9l1.5-5h15L21 9z" />
    <path d="M5 10.5h14v10H5zM10 14h4v6.5h-4z" />
  </Base>
)

/** Tendencia: línea que sube con punta de flecha. */
export const IconoTendencia = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 17l6-6 4 4 7-7" {...trazo} strokeWidth={2.2} />
    <path d="M14.5 6H21v6.5z" />
  </Base>
)

/** Ajustes: dos reguladores. */
export const IconoAjustes = (p: MarcaIconoProps) => (
  <Base {...p}>
    <rect x={3} y={6.3} width={18} height={1.6} />
    <rect x={7} y={4} width={4} height={6.2} />
    <rect x={3} y={16.1} width={18} height={1.6} />
    <rect x={13} y={13.8} width={4} height={6.2} />
  </Base>
)

/** Barra lateral: panel con la columna maciza. */
export const IconoPanel = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 4h18v16H3zM10.5 6.5H19v11h-8.5z" />
  </Base>
)

// Barra inferior del portal cliente: los mismos pictogramas.
export const NavHoy = IconoHoy
export const NavDieta = IconoDieta
export const NavRecetas = IconoRecetas
export const NavEntreno = IconoFuerza
export const NavDatos = IconoDatos
