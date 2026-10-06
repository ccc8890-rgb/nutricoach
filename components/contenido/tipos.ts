import type { EstadoPieza } from '@/lib/contenido/estados'

export type RecetaPieza = {
  id: string; nombre: string; imagen_url: string | null; tiempo_prep_min: number | null
  instrucciones?: string | null; estado?: string; verificacion?: string | null
}

export type Pieza = {
  id: string; titulo: string; enlace_referencia: string | null; notas: string | null; gancho: string | null
  estado: EstadoPieza; fecha_grabacion: string | null; fecha_publicacion: string | null
  receta_id: string | null; plan_id: string | null; planos_hechos: string[]; receta: RecetaPieza | null
}
