import type { LucideIcon } from 'lucide-react'
import { Dumbbell, Heart, Flame, Zap, Bike, Waves, Trophy } from 'lucide-react'
import type { SportModality } from '@/types'

export interface ModalityConfig {
  label: string
  Icon: LucideIcon
  color: string    // text color class (Tailwind)
  bg: string       // background color class (Tailwind) — use bgRgba for dark-mode-safe icons
  border: string   // border color class (Tailwind)
  /** Dark-mode-safe icon background as rgba — use this for icon containers */
  bgRgba: string
  /** Dark-mode-safe icon color as rgb — use this for icon containers */
  colorRgb: string
}

export const MODALITY_CONFIG: Record<SportModality, ModalityConfig> = {
  gym_estetica: { label: 'Gym Estética', Icon: Dumbbell, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', bgRgba: 'rgba(168,85,247,0.15)', colorRgb: 'rgb(168,85,247)' },
  gym_fuerza: { label: 'Gym Fuerza', Icon: Dumbbell, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', bgRgba: 'rgba(59,130,246,0.15)', colorRgb: 'rgb(59,130,246)' },
  funcional: { label: 'Funcional', Icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', bgRgba: 'rgba(249,115,22,0.15)', colorRgb: 'rgb(249,115,22)' },
  hyrox: { label: 'HYROX', Icon: Zap, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', bgRgba: 'rgba(234,179,8,0.15)', colorRgb: 'rgb(234,179,8)' },
  ciclismo: { label: 'Ciclismo', Icon: Bike, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', bgRgba: 'rgba(6,182,212,0.15)', colorRgb: 'rgb(6,182,212)' },
  running: { label: 'Running', Icon: Heart, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', bgRgba: 'rgba(239,68,68,0.15)', colorRgb: 'rgb(239,68,68)' },
  hibrido: { label: 'Híbrido', Icon: Waves, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', bgRgba: 'rgba(20,184,166,0.15)', colorRgb: 'rgb(20,184,166)' },
  calistenia: { label: 'Calistenia', Icon: Dumbbell, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', bgRgba: 'rgba(99,102,241,0.15)', colorRgb: 'rgb(99,102,241)' },
  natacion: { label: 'Natación', Icon: Waves, color: 'text-sky-500', bg: 'bg-sky-50', border: 'border-sky-200', bgRgba: 'rgba(14,165,233,0.15)', colorRgb: 'rgb(14,165,233)' },
  triatlon: { label: 'Triatlón', Icon: Trophy, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-200', bgRgba: 'rgba(139,92,246,0.15)', colorRgb: 'rgb(139,92,246)' },
}

// Solo para plantillas legacy sin sport_modality en BD
export function detectarSubcategoriaLegacy(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('hyrox')) return 'HYROX'
  if (n.includes('triatlón') || n.includes('triatlon') || n.includes('ironman')) return 'Triatlón'
  if (n.includes('ciclismo') || n.includes('rodillo') || n.includes('ftp') || n.includes('bici')) return 'Ciclismo'
  if (n.includes('running') || n.includes('maratón') || n.includes('maraton') || n.includes('5k') || n.includes('10k') || n.includes('media')) return 'Running'
  if (n.includes('full body')) return 'Full Body'
  if (n.includes('push') || n.includes('pull') || n.includes('ppl')) return 'PPL'
  if (n.includes('torso') || n.includes('pierna')) return 'Torso/Pierna'
  if (n.includes('upper') || n.includes('lower')) return 'Upper/Lower'
  if (n.includes('weider')) return 'Weider'
  if (n.includes('hiit')) return 'HIIT'
  if (n.includes('cardio') || n.includes('steady') || n.includes('liss')) return 'Cardio'
  return ''
}
