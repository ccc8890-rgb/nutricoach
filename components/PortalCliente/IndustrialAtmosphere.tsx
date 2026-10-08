'use client'

import { GrainGradient } from '@paper-design/shaders-react'
import { useTheme } from '@/components/ThemeProvider'

export default function IndustrialAtmosphere() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <div className="cliente-industrial-atmosphere" aria-hidden="true">
      <GrainGradient
        colorBack={dark ? '#0B0C0E' : '#E8E8E5'}
        colors={dark
          ? ['#101215', '#383B40', '#9A9DA2', '#1C1F23']
          : ['#D6D6D2', '#F1F0EC', '#8D9093', '#C5C5C1']}
        shape="corners"
        softness={0.9}
        intensity={0.16}
        noise={0.42}
        speed={0.045}
        scale={1.28}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
