'use client'

import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useTransform, animate, motion } from 'framer-motion'

interface CountUpProps {
  to: number
  duration?: number
  suffix?: string
  prefix?: string
  decimals?: number
  className?: string
}

export function CountUp({
  to,
  duration = 1.2,
  suffix = '',
  prefix = '',
  decimals = 0,
  className
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const count = useMotionValue(0)
  const isInView = useInView(ref, { once: true, margin: '-20px' })

  const rounded = useTransform(count, (v) => {
    const fixed = v.toFixed(decimals)
    return `${prefix}${fixed}${suffix}`
  })

  useEffect(() => {
    if (!isInView) return
    const controls = animate(count, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    })
    return controls.stop
  }, [isInView, to, duration, count])

  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  )
}
