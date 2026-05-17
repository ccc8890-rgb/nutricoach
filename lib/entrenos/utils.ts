import type { LucideIcon } from 'lucide-react'
import { Dumbbell, Heart, Flame, Zap, Bike, Waves } from 'lucide-react'
import type { SportModality } from '@/types'

export interface ModalityConfig {
  label: string
  Icon: LucideIcon
  color: string    // text color class
  bg: string       // background color class
  border: string   // border color class
}

export const MODALITY_CONFIG: Record<SportModality, ModalityConfig> = {
  gym_estetica: { label: 'Gym Estética', Icon: Dumbbell, color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-200' },
  gym_fuerza:   { label: 'Gym Fuerza',   Icon: Dumbbell, color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  funcional:    { label: 'Funcional',    Icon: Flame,    color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-200' },
  hyrox:        { label: 'HYROX',        Icon: Zap,      color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  ciclismo:     { label: 'Ciclismo',     Icon: Bike,     color: 'text-cyan-600',   bg: 'bg-cyan-50',    border: 'border-cyan-200'   },
  running:      { label: 'Running',      Icon: Heart,    color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-200'    },
  hibrido:      { label: 'Híbrido',      Icon: Waves,    color: 'text-teal-600',   bg: 'bg-teal-50',    border: 'border-teal-200'   },
  calistenia:   { label: 'Calistenia',   Icon: Dumbbell, color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-200' },
}

// Solo para plantillas legacy sin sport_modality en BD
export function detectarSubcategoriaLegacy(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('hyrox'))                                                                       return 'HYROX'
  if (n.includes('triatlón') || n.includes('triatlon') || n.includes('ironman'))                 return 'Triatlón'
  if (n.includes('ciclismo') || n.includes('rodillo') || n.includes('ftp') || n.includes('bici')) return 'Ciclismo'
  if (n.includes('running') || n.includes('maratón') || n.includes('maraton') || n.includes('5k') || n.includes('10k') || n.includes('media')) return 'Running'
  if (n.includes('full body'))                                                                    return 'Full Body'
  if (n.includes('push') || n.includes('pull') || n.includes('ppl'))                             return 'PPL'
  if (n.includes('torso') || n.includes('pierna'))                                               return 'Torso/Pierna'
  if (n.includes('upper') || n.includes('lower'))                                                return 'Upper/Lower'
  if (n.includes('weider'))                                                                       return 'Weider'
  if (n.includes('hiit'))                                                                         return 'HIIT'
  if (n.includes('cardio') || n.includes('steady') || n.includes('liss'))                        return 'Cardio'
  return ''
}
