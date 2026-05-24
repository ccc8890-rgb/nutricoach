'use client'
// Perfil profundo ya está integrado en el flujo principal /onboarding
// Este redirect mantiene compatibilidad con links anteriores
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PerfilProfundoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/onboarding') }, [router])
  return null
}
