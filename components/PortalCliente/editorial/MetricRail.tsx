import type { ReactNode } from 'react'

export default function MetricRail({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`metric-rail ${className}`.trim()}>{children}</section>
}
