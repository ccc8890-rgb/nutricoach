'use client'

import type { ComponentType } from 'react'
import { motion } from 'framer-motion'

export type LiquidDockItem<T extends string> = {
  key: T
  label: string
  icon: ComponentType<{ size?: number; weight?: 'fill' | 'regular' }>
}

export default function LiquidDock<T extends string>({ items, activeKey, onChange, reduceMotion = false }: {
  items: readonly LiquidDockItem<T>[]
  activeKey: T
  onChange: (key: T) => void
  reduceMotion?: boolean
}) {
  return (
    <nav className="cliente-bottom-nav fixed bottom-0 left-0 right-0 z-30" aria-label="Navegación principal">
      <div className="cliente-bottom-nav-surface flex">
        {items.map(({ key, label, icon: Icon }) => {
          const active = activeKey === key
          return (
            <button key={key} type="button" onClick={() => onChange(key)} aria-label={label} aria-current={active ? 'page' : undefined} className={`cliente-bottom-item flex-1 ${active ? 'is-active' : ''}`}>
              {active ? <motion.span layoutId="cliente-nav-active" className="cliente-bottom-active-surface" transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }} /> : null}
              <span className="cliente-bottom-icon" aria-hidden="true">
                <Icon size={22} weight="regular" />
              </span>
              <span className="cliente-bottom-label sr-only">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
