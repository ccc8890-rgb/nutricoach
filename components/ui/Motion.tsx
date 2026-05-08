'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

// Curva ease tipo Apple / iOS — entra suave, termina con snap
const EASE_APPLE: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface WithChildren {
  children: ReactNode
  className?: string
}

// ─────────────────────────────────────────────
// FadeIn — entrada suave con slide up (para secciones, cards individuales)
// ─────────────────────────────────────────────
interface FadeInProps extends Omit<HTMLMotionProps<'div'>, 'children'>, WithChildren {
  delay?: number
  distance?: number
}

export function FadeIn({ delay = 0, distance = 10, children, className, ...props }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: EASE_APPLE }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// StaggerList — contenedor padre que secuencia la animación de sus hijos
// ─────────────────────────────────────────────
const staggerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 }
  }
}

export function StaggerList({ children, className }: WithChildren) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerVariants}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// StaggerItem — cada hijo dentro de un StaggerList
// ─────────────────────────────────────────────
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE_APPLE }
  }
}

export function StaggerItem({ children, className }: WithChildren) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// ScaleIn — entrada con escala (para badges, pills, modals)
// ─────────────────────────────────────────────
interface ScaleInProps extends WithChildren {
  delay?: number
}

export function ScaleIn({ children, className, delay = 0 }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay, ease: EASE_APPLE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// MotionCard — card con hover lift y tap press (reemplaza div+className)
// ─────────────────────────────────────────────
interface MotionCardProps extends Omit<HTMLMotionProps<'div'>, 'children'>, WithChildren {
  hoverable?: boolean
}

export function MotionCard({ children, className, hoverable = true, ...props }: MotionCardProps) {
  return (
    <motion.div
      className={className}
      whileHover={hoverable ? { y: -2, transition: { duration: 0.2, ease: EASE_APPLE } } : undefined}
      whileTap={hoverable ? { y: 0, scale: 0.99, transition: { duration: 0.1 } } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  )
}
