import type { CSSProperties, ReactNode } from 'react'

// Set propio de la app: rejilla de 24 px, trazo fino con esquinas secas y un
// punto de acento por icono (el mismo punto luminoso del icono de la PWA).
// Acepta las mismas props que los iconos de Phosphor que sustituye.
export type MarcaIconoProps = {
  size?: number | string
  weight?: 'fill' | 'regular' | 'bold' | 'duotone' | 'light' | 'thin'
  className?: string
  style?: CSSProperties
}

function Base({ size = 24, weight = 'regular', className, style, children }: MarcaIconoProps & { children: ReactNode }) {
  const trazo = weight === 'bold' ? 2 : weight === 'light' || weight === 'thin' ? 1.2 : 1.5
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trazo}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const Punto = ({ cx, cy }: { cx: number; cy: number }) => <circle cx={cx} cy={cy} r={1.6} fill="currentColor" stroke="none" />

/** Hoy: amanecer sobre la línea del día, el punto es el sol. */
export const IconoHoy = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 17h18" />
    <path d="M6.5 17a5.5 5.5 0 0 1 11 0" />
    <path d="M12 3.5v3M4.5 8l2 2M19.5 8l-2 2" />
    <Punto cx={12} cy={17} />
  </Base>
)

/** Dieta: cuenco con un bocado encima. */
export const IconoDieta = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 11h18" />
    <path d="M4.5 11a7.5 7.5 0 0 0 15 0" />
    <path d="M9 20.5h6" />
    <Punto cx={12} cy={6.5} />
  </Base>
)

/** Recetas: libro abierto de lomo recto. */
export const IconoRecetas = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M12 6.5V19M12 6.5 10.5 5H3v12.5h7.5L12 19l1.5-1.5H21V5h-7.5z" />
    <Punto cx={17} cy={11} />
  </Base>
)

/** Fuerza: barra con discos planos, el punto marca el centro de la barra. */
export const IconoFuerza = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M2 12h20" />
    <rect x={4.5} y={6.5} width={3} height={11} />
    <rect x={16.5} y={6.5} width={3} height={11} />
    <Punto cx={12} cy={12} />
  </Base>
)

/** Carrera: pista de atletismo con el corredor como punto. */
export const IconoCarrera = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M8 6h8a6 6 0 0 1 0 12H8a6 6 0 0 1 0-12z" />
    <path d="M8 10h8a2 2 0 0 1 0 4H8a2 2 0 0 1 0-4z" />
    <Punto cx={12} cy={8} />
  </Base>
)

/** Datos: ejes y línea que termina en un punto. */
export const IconoDatos = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M4 4v16h16" />
    <path d="M7.5 15 11 11l3 2.5 3.5-5" />
    <Punto cx={17.5} cy={8.5} />
  </Base>
)

/** Compra: cesta de asas rectas. */
export const IconoCompra = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 9h18l-2 11H5z" />
    <path d="M8 9l3-5M16 9l-3-5" />
    <Punto cx={12} cy={14.5} />
  </Base>
)

/** Chat: bocadillo cuadrado. */
export const IconoChat = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 4h18v13H10l-4 3.5V17H3z" />
    <Punto cx={12} cy={10.5} />
  </Base>
)

/** Check-in: tablilla con dos líneas marcadas. */
export const IconoCheckin = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M5 4h14v17H5z" />
    <path d="M9 2.5h6v3H9z" />
    <path d="M12 11h4M12 16h4" />
    <Punto cx={8.5} cy={11} />
    <Punto cx={8.5} cy={16} />
  </Base>
)

/** Dispositivo: móvil con el punto como botón. */
export const IconoDispositivo = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M7 2.5h10v19H7z" />
    <Punto cx={12} cy={18} />
  </Base>
)

/** Tema claro. */
export const IconoSol = (p: MarcaIconoProps) => (
  <Base {...p}>
    <circle cx={12} cy={12} r={3.5} />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" />
  </Base>
)

/** Tema oscuro. */
export const IconoLuna = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    <Punto cx={16.5} cy={6.5} />
  </Base>
)

/** Salir: puerta con flecha. */
export const IconoSalir = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M10 4H4v16h6" />
    <path d="M9 12h11M16 8l4 4-4 4" />
  </Base>
)

/** Inicio: casa de tejado recto. */
export const IconoInicio = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <Punto cx={12} cy={15} />
  </Base>
)

/** Clientes: dos personas, la segunda a medias. */
export const IconoClientes = (p: MarcaIconoProps) => (
  <Base {...p}>
    <circle cx={9} cy={8} r={3} />
    <path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2" />
    <path d="M16 5.5a3 3 0 0 1 0 5.5M17.5 13.2A5 5 0 0 1 20.5 18v2" />
  </Base>
)

/** Contenido: fotograma de película. */
export const IconoContenido = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 5h18v14H3z" />
    <path d="M7 5v14M17 5v14" />
    <Punto cx={12} cy={12} />
  </Base>
)

/** Catálogo: tres capas apiladas. */
export const IconoCatalogo = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M4 4.5h16v4.5H4zM4 10h16v4.5H4zM4 15.5h16V20H4z" />
    <Punto cx={7.5} cy={6.75} />
  </Base>
)

/** Precios: tienda con toldo. */
export const IconoPrecios = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 9l1.5-5h15L21 9H3z" />
    <path d="M5 9v11h14V9" />
    <Punto cx={12} cy={15} />
  </Base>
)

/** Tendencia: línea que sube con flecha cuadrada. */
export const IconoTendencia = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Base>
)

/** Ajustes: dos reguladores. */
export const IconoAjustes = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 17h16" />
    <Punto cx={9} cy={7} />
    <Punto cx={15} cy={17} />
  </Base>
)

/** Barra lateral: panel con columna a la izquierda. */
export const IconoPanel = (p: MarcaIconoProps) => (
  <Base {...p}>
    <path d="M3 4h18v16H3z" />
    <path d="M9 4v16" />
    <Punto cx={6} cy={8} />
  </Base>
)
