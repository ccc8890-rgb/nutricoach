import type { CSSProperties } from 'react'

// Iconos de la app. Pictogramas de Hugeicons (https://hugeicons.com, licencia MIT,
// Copyright (c) Hugeicons), incrustados uno a uno para no añadir la dependencia.
// Acepta las mismas props que los iconos de Phosphor que sustituye; `weight`
// se ignora (el estado activo lo marca quien lo pinta).
export type MarcaIconoProps = {
  size?: number | string
  weight?: 'fill' | 'regular' | 'bold' | 'duotone' | 'light' | 'thin'
  className?: string
  style?: CSSProperties
}

function Base({ size = 24, className, style, html }: MarcaIconoProps & { html: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** Hoy: calendario con la fecha. */
export const IconoHoy = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M16 2v4M8 2v4m5-2h-2C7.229 4 5.343 4 4.172 5.172S3 8.229 3 12v2c0 3.771 0 5.657 1.172 6.828S7.229 22 11 22h2c3.771 0 5.657 0 6.828-1.172S21 17.771 21 14v-2c0-3.771 0-5.657-1.172-6.828S16.771 4 13 4M3 10h18"/><path d="M10 18.5v-4.653c0-.191-.137-.347-.305-.347H9m5 4.998l1.486-4.606a.3.3 0 0 0-.286-.392H13"/></g>'} />

/** Dieta: tenedor y cuchillo finos (Phosphor Light). */
export const IconoDieta = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="currentColor" transform="scale(0.09375)"><path fill="currentColor" d="M74 88V40a6 6 0 0 1 12 0v48a6 6 0 0 1-12 0m140-48v184a6 6 0 0 1-12 0v-50h-50a6 6 0 0 1-6-6c0-4.41.68-108.25 59.64-133.51A6 6 0 0 1 214 40m-12 10c-36.79 24.29-42.82 91.48-43.81 112H202Zm-84.08-11a6 6 0 1 0-11.84 2L114 88.48a34 34 0 0 1-68 0L53.92 41a6 6 0 0 0-11.84-2l-8 48a6.6 6.6 0 0 0-.08 1a46.06 46.06 0 0 0 40 45.6V224a6 6 0 0 0 12 0v-90.4A46.06 46.06 0 0 0 126 88a6.6 6.6 0 0 0-.08-1Z"/></g>'} />

/** Recetas: libro abierto. */
export const IconoRecetas = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5"><path stroke-linecap="round" d="M8 4.981H6c-1.886 0-2.828 0-3.414.586S2 7.096 2 8.982v6.899c0 1.5 0 2.25.382 2.775a2 2 0 0 0 .443.443c.526.382 1.275.382 2.774.382h3.352a3.11 3.11 0 0 1 3.049 2.5v-15c-.293-.39-.44-.586-.599-.754a4 4 0 0 0-2.438-1.22c-.23-.026-.475-.026-.963-.026"/><path stroke-linecap="square" d="M12 6.981v15a3.11 3.11 0 0 1 3.05-2.5h3.35c1.499 0 2.248 0 2.774-.382q.257-.186.444-.443C22 18.13 22 17.38 22 15.88v-8.4c0-.465 0-.697-.038-.89a2 2 0 0 0-1.572-1.572c-.193-.038-.425-.038-.89-.038"/><path stroke-linecap="round" d="M12 7.48s.77-4.237 5.017-5.273c.812-.198 1.218-.297 1.6.003S19 3 19 3.98v10.5c0 .87 0 1.304-.213 1.576c-.214.271-.733.398-1.77.651C12.77 17.743 12 21.981 12 21.981"/></g>'} />

/** Fuerza / Entreno: barra con discos (Phosphor Thin). */
export const IconoFuerza = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="currentColor" transform="scale(0.09375)"><path fill="currentColor" d="M248 124h-12V88a12 12 0 0 0-12-12h-20V64a12 12 0 0 0-12-12h-24a12 12 0 0 0-12 12v60h-56V64a12 12 0 0 0-12-12H64a12 12 0 0 0-12 12v12H32a12 12 0 0 0-12 12v36H8a4 4 0 0 0 0 8h12v36a12 12 0 0 0 12 12h20v12a12 12 0 0 0 12 12h24a12 12 0 0 0 12-12v-60h56v60a12 12 0 0 0 12 12h24a12 12 0 0 0 12-12v-12h20a12 12 0 0 0 12-12v-36h12a4 4 0 0 0 0-8M32 172a4 4 0 0 1-4-4V88a4 4 0 0 1 4-4h20v88Zm60 20a4 4 0 0 1-4 4H64a4 4 0 0 1-4-4V64a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4Zm104 0a4 4 0 0 1-4 4h-24a4 4 0 0 1-4-4V64a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4Zm32-24a4 4 0 0 1-4 4h-20V84h20a4 4 0 0 1 4 4Z"/></g>'} />

/** Carrera: zapatillas. */
export const IconoCarrera = (p: MarcaIconoProps) => <Base {...p} html={'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12.406 18.992c1.038.748 1.557 1.122 2.156 1.315s1.239.193 2.518.193H19c1.414 0 2.121 0 2.56-.44c.44-.439.44-1.146.44-2.56h-5.21c-.64 0-.96 0-1.259-.097c-.3-.096-.559-.283-1.078-.657L3 8.5l-.69 1.036a1.84 1.84 0 0 0 .455 2.515zM3 8.5l3-5l.307 1.842a2.305 2.305 0 0 0 4.275.765l.558-.976a1.252 1.252 0 0 1 2.206.06l3.93 7.862A.81.81 0 0 0 18 13.5a4 4 0 0 1 4 4m-9.5-8l2-1M14 12l2-1M6 20.5h12m-16-3h3"/>'} />

/** Datos: gráfica ascendente. */
export const IconoDatos = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M7 18v-2m5 2v-3m5 3v-5M2.5 12c0-4.478 0-6.718 1.391-8.109S7.521 2.5 12 2.5c4.478 0 6.718 0 8.109 1.391S21.5 7.521 21.5 12c0 4.478 0 6.718-1.391 8.109S16.479 21.5 12 21.5c-4.478 0-6.718 0-8.109-1.391S2.5 16.479 2.5 12"/><path d="M5.992 11.486c2.155.072 7.042-.253 9.822-4.665m-1.822-.533l1.876-.302c.228-.029.564.152.647.367l.495 1.638"/></g>'} />

/** Compra: cesta. */
export const IconoCompra = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M8 7h8c1.886 0 2.828 0 3.414.586S20 9.114 20 11v4c0 3.3 0 4.95-1.025 5.975S16.3 22 13 22h-2c-3.3 0-4.95 0-5.975-1.025S4 18.3 4 15v-4c0-1.886 0-2.828.586-3.414S6.114 7 8 7"/><path d="M16 9.5C16 5.634 14.21 2 12 2S8 5.634 8 9.5"/></g>'} />

/** Chat. */
export const IconoChat = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5"><path stroke-linecap="round" d="M20 9c-.795-3.985-4.487-7-8.92-7C6.064 2 2 5.855 2 10.61c0 2.285.938 4.36 2.469 5.9c.336.34.561.803.47 1.28a4.75 4.75 0 0 1-.986 2.114a5.95 5.95 0 0 0 3.835-.591c.412-.218.619-.326.764-.348c.102-.016.235-.001.448.035"/><path d="M11 16.262c0 2.905 2.463 5.261 5.5 5.261q.537 0 1.064-.098c.253-.047.379-.071.467-.058c.088.014.213.08.463.213c.706.376 1.53.509 2.323.361a2.9 2.9 0 0 1-.598-1.291c-.055-.292.081-.575.286-.782A5.12 5.12 0 0 0 22 16.262C22 13.356 19.537 11 16.5 11S11 13.356 11 16.262Z"/></g>'} />

/** Check-in: tarea hecha. */
export const IconoCheckin = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M13.498 2h-5a1.5 1.5 0 1 0 0 3h5a1.5 1.5 0 1 0 0-3m-6.5 13h3.429m-3.429-4h8"/><path d="M18.998 13.5V9.483c0-2.829 0-4.243-.879-5.122c-.64-.64-1.567-.814-3.12-.861M11.997 22h-3c-2.828 0-4.243 0-5.121-.88c-.879-.878-.879-2.292-.879-5.12V9.482c0-2.829 0-4.243.879-5.122c.641-.64 1.568-.814 3.121-.861M13.998 20s1 0 2 2c0 0 2.176-5 5-6"/></g>'} />

/** Dispositivo: móvil. */
export const IconoDispositivo = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M13.5 2h-3c-2.357 0-3.536 0-4.268.732S5.5 4.643 5.5 7v10c0 2.357 0 3.535.732 4.268S8.143 22 10.5 22h3c2.357 0 3.535 0 4.268-.732c.732-.733.732-1.911.732-4.268V7c0-2.357 0-3.536-.732-4.268C17.035 2 15.857 2 13.5 2"/><path d="M12.125 19H12m.25 0a.25.25 0 1 1-.5 0a.25.25 0 0 1 .5 0"/></g>'} />

/** Tema claro. */
export const IconoSol = (p: MarcaIconoProps) => <Base {...p} html={'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 12a5 5 0 1 1-10.001 0a5 5 0 0 1 10 0m-4.874-8.75H12m.124 17.5H12m8.751-8.625V12m-17.5.125V12m15.025-6.099l-.088-.088M5.9 18.275l-.089-.088m12.287.089l.088-.089M5.724 5.901l.089-.088M12.25 3.25a.25.25 0 1 1-.5 0a.25.25 0 0 1 .5 0m0 17.5a.25.25 0 1 1-.5 0a.25.25 0 0 1 .5 0m8.5-8.5a.25.25 0 1 1 0-.5a.25.25 0 0 1 0 .5m-17.5 0a.25.25 0 1 1 0-.5a.25.25 0 0 1 0 .5m15.114-6.26a.25.25 0 1 1-.354-.354a.25.25 0 0 1 .354.353M5.989 18.362a.25.25 0 1 1-.354-.353a.25.25 0 0 1 .354.353m12.021.001a.25.25 0 1 1 .354-.354a.25.25 0 0 1-.354.354M5.636 5.99a.25.25 0 1 1 .353-.354a.25.25 0 0 1-.353.354"/>'} />

/** Tema oscuro. */
export const IconoLuna = (p: MarcaIconoProps) => <Base {...p} html={'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.5 14.078A8.557 8.557 0 0 1 9.922 2.5C5.668 3.497 2.5 7.315 2.5 11.873a9.627 9.627 0 0 0 9.627 9.627c4.558 0 8.376-3.168 9.373-7.422"/>'} />

/** Salir. */
export const IconoSalir = (p: MarcaIconoProps) => <Base {...p} html={'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.5 8.04c-.041-1.16-.178-1.885-.636-2.453c-.653-.812-1.77-1.066-4.004-1.576l-1-.228c-3.395-.774-5.092-1.161-6.226-.27C2.5 4.405 2.5 6.126 2.5 9.568v4.864c0 3.442 0 5.164 1.134 6.055s2.83.504 6.225-.27l1.002-.228c2.233-.51 3.35-.764 4.003-1.576c.458-.567.595-1.293.636-2.453m3-6.948s3 2.21 3 3s-3 3-3 3m2.5-3H8.5"/>'} />

/** Inicio. */
export const IconoInicio = (p: MarcaIconoProps) => <Base {...p} html={'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 11.99v2.51c0 3.3 0 4.95 1.025 5.975S6.7 21.5 10 21.5h4c3.3 0 4.95 0 5.975-1.025S21 17.8 21 14.5v-2.51c0-1.682 0-2.522-.356-3.25s-1.02-1.244-2.346-2.276l-2-1.555C14.233 3.303 13.2 2.5 12 2.5s-2.233.803-4.298 2.409l-2 1.555C4.375 7.496 3.712 8.012 3.356 8.74S3 10.308 3 11.99"/>'} />

/** Clientes. */
export const IconoClientes = (p: MarcaIconoProps) => <Base {...p} html={'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.5 20.5c-.234-2.931-2.658-5.252-5.692-5.448L11.999 15q-.431.012-.811.03C8.18 15.172 5.73 17.597 5.5 20.5m9.75-11.25a3.25 3.25 0 1 1-6.5 0a3.25 3.25 0 0 1 6.5 0M5.502 8.5A3.25 3.25 0 0 1 9.5 3.752M18.496 8.5A3.25 3.25 0 0 0 14.5 3.752M22 18c-.18-2.263-2-4.5-4-5M2 18c.18-2.263 2-4.5 4-5"/>'} />

/** Contenido: película. */
export const IconoContenido = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 12c0-4.478 0-6.718 1.391-8.109S7.521 2.5 12 2.5c4.478 0 6.718 0 8.109 1.391S21.5 7.521 21.5 12c0 4.478 0 6.718-1.391 8.109S16.479 21.5 12 21.5c-4.478 0-6.718 0-8.109-1.391S2.5 16.479 2.5 12Z"/><path stroke-linejoin="round" d="M2.5 7h19m-19 10h19"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 17V7M8 7V3m8 4V3M8 21v-4m8 4v-4"/></g>'} />

/** Catálogo. */
export const IconoCatalogo = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="8" ry="3"/><path stroke-linecap="round" d="M7 10.842c.602.18 1.274.33 2 .44"/><path d="M20 12c0 1.657-3.582 3-8 3s-8-1.343-8-3"/><path stroke-linecap="round" d="M7 17.842c.602.18 1.274.33 2 .44"/><path d="M20 5v14c0 1.657-3.582 3-8 3s-8-1.343-8-3V5"/></g>'} />

/** Precios: tienda. */
export const IconoPrecios = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M3.5 10v5c0 2.828 0 4.243.879 5.121C5.257 21 6.672 21 9.5 21h5c2.828 0 4.243 0 5.121-.879c.879-.878.879-2.293.879-5.121v-5"/><path d="M17 7.502a2.5 2.5 0 0 1-5-.002a2.5 2.5 0 0 1-5 0C7 8.88 5.827 10 4.379 10c-.78 0-1.479-.324-1.959-.84c-.825-.884-.294-2.186.394-3.172l.388-.53c.882-1.205 1.323-1.808 1.963-2.133S6.552 3 8.045 3l7.91.001c1.493 0 2.24 0 2.88.326c.64.324 1.08.927 1.962 2.133l.389.53c.688.986 1.22 2.288.394 3.173a2.67 2.67 0 0 1-1.959.839c-1.448 0-2.621-1.12-2.621-2.5M14.997 17c-.684.607-1.772 1-2.998 1S9.684 17.607 9 17"/></g>'} />

/** Tendencia. */
export const IconoTendencia = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="m3 17l4-4c.883-.883 1.324-1.324 1.865-1.373q.135-.012.27 0c.541.05.982.49 1.865 1.373s1.324 1.324 1.865 1.373q.135.012.27 0c.541-.05.982-.49 1.865-1.373l5-5"/><path d="M16 7.277s4.101-.623 4.723 0c.623.622 0 4.723 0 4.723"/></g>'} />

/** Ajustes: reguladores. */
export const IconoAjustes = (p: MarcaIconoProps) => <Base {...p} html={'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" d="M4 5h6m3 0h7m-4 4v6M10 2v6m2 8v6m4-10h4M4 12h9m-1 7h8M4 19h5"/>'} />

/** Barra lateral. */
export const IconoPanel = (p: MarcaIconoProps) => <Base {...p} html={'<g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12c0-3.69 0-5.534.814-6.841a4.8 4.8 0 0 1 1.105-1.243C5.08 3 6.72 3 10 3h4c3.28 0 4.919 0 6.081.916c.43.338.804.759 1.105 1.243C22 6.466 22 8.31 22 12s0 5.534-.814 6.841a4.8 4.8 0 0 1-1.105 1.243C18.92 21 17.28 21 14 21h-4c-3.28 0-4.919 0-6.081-.916a4.8 4.8 0 0 1-1.105-1.243C2 17.534 2 15.69 2 12Z"/><path stroke-linejoin="round" d="M9.5 3v18"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 7h1m-1 3h1"/></g>'} />

// Barra inferior del portal cliente: los mismos pictogramas.
export const NavHoy = IconoHoy
export const NavDieta = IconoDieta
export const NavRecetas = IconoRecetas
export const NavEntreno = IconoFuerza
export const NavDatos = IconoDatos
