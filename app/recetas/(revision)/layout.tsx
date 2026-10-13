import CabeceraRevision from '@/components/recetas/CabeceraRevision'

// Revisión e Imágenes comparten espacio de trabajo: misma cabecera, mismo «volver» y pestañas entre ambas vistas.
export default function RevisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CabeceraRevision />
      {children}
    </>
  )
}
