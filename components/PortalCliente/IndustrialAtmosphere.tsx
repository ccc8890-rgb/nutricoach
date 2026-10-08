'use client'

import { GrainGradient } from '@paper-design/shaders-react'
import { useTheme } from '@/components/ThemeProvider'

export default function IndustrialAtmosphere() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <div className="cliente-industrial-atmosphere" aria-hidden="true">
      <GrainGradient
        colorBack={dark ? '#090A0C' : '#E6E8EB'}
        colors={dark
          ? ['#17191D', '#777C84', '#D9DBDE', '#2A2D32']
          : ['#D2D5D9', '#F2F3F4', '#858A91', '#C1C4C8']}
        shape="wave"
        softness={0.82}
        intensity={0.24}
        noise={0.38}
        speed={0.08}
        scale={1.15}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
