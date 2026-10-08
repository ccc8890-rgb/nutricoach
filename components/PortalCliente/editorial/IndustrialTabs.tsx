'use client'

import type { ComponentType } from 'react'

export type IndustrialTab<T extends string> = {
  key: T
  label: string
  icon?: ComponentType<{ size?: number }>
}

export type IndustrialTabsProps<T extends string> = {
  items: readonly IndustrialTab<T>[]
  activeKey: T
  onChange: (key: T) => void
  ariaLabel: string
  className?: string
}

export default function IndustrialTabs<T extends string>({ items, activeKey, onChange, ariaLabel, className = '' }: IndustrialTabsProps<T>) {
  return (
    <div className={`industrial-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {items.map(({ key, label, icon: Icon }) => {
        const active = activeKey === key
        return (
          <button key={key} type="button" role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={() => onChange(key)}>
            {Icon ? <Icon size={15} /> : null}
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
