'use client'

import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion'
import { ReactNode, useEffect, useRef, useState } from 'react'

// Curva ease tipo Apple / iOS — entra suave, termina con snap
export const EASE_APPLE: [number, number, number, number] = [0.16, 1, 0.3, 1]
export const EASE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 24 }

interface WithChildren {
  children: ReactNode
  className?: string
}

// ─────────────────────────────────────────────
// FadeIn — entrada suave con slide up
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
// StaggerList — contenedor que secuencia hijos
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
// StaggerItem — cada hijo dentro de StaggerList
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
// ScaleIn — entrada con escala (badges, pills, modals)
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
// MotionCard — card con hover lift y tap press
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

// ─────────────────────────────────────────────
// SlideIn — slide lateral para paneles / modales
// ─────────────────────────────────────────────
interface SlideInProps extends WithChildren {
  from?: 'left' | 'right' | 'bottom'
  delay?: number
}

const slideDirections = {
  left: { x: -24 },
  right: { x: 24 },
  bottom: { y: 24 },
}

export function SlideIn({ children, className, from = 'bottom', delay = 0 }: SlideInProps) {
  const dir = slideDirections[from]
  return (
    <motion.div
      initial={{ opacity: 0, ...dir }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.35, delay, ease: EASE_APPLE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Pressable — botón con feedback táctil iOS
// ─────────────────────────────────────────────
interface PressableProps extends Omit<HTMLMotionProps<'button'>, 'children'>, WithChildren {
  scale?: number
}

export function Pressable({ children, className, scale = 0.97, ...props }: PressableProps) {
  return (
    <motion.button
      className={className}
      whileHover={{ opacity: 0.85, transition: { duration: 0.15 } }}
      whileTap={{ scale, transition: { duration: 0.08 } }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

// ─────────────────────────────────────────────
// PageTransition — wrapper para páginas (entrada)
// ─────────────────────────────────────────────
export function PageTransition({ children, className }: WithChildren) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_APPLE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// AnimatedCounter — número que cuenta hacia arriba
// ─────────────────────────────────────────────
interface AnimatedCounterProps {
  from?: number
  to: number
  duration?: number
  suffix?: string
  className?: string
}

export function AnimatedCounter({ from = 0, to, duration = 0.6, suffix = '', className }: AnimatedCounterProps) {
  const [value, setValue] = useState(from)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    const startTime = performance.now()
    const delta = to - from

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      setValue(from + delta * eased)
      if (progress < 1) {
        ref.current = requestAnimationFrame(tick)
      }
    }

    ref.current = requestAnimationFrame(tick)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [from, to, duration])

  return <span className={className}>{Math.round(value)}{suffix}</span>
}

// ─────────────────────────────────────────────
// useInView — hook para animaciones al hacer scroll
// ─────────────────────────────────────────────
export function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.unobserve(el) } },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

// ─────────────────────────────────────────────
// FadeInOnView — fade in cuando entra en viewport
// ─────────────────────────────────────────────
export function FadeInOnView({ children, className }: WithChildren) {
  const { ref, inView } = useInView()
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.4, ease: EASE_APPLE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { AnimatePresence }
