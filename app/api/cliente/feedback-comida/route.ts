// app/api/cliente/feedback-comida/route.ts
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint obsoleto. Usa /api/cliente/[codigo]/comidas/[comidaId]/receta o /api/cliente/[codigo]/intercambios/elegir.' },
    { status: 410 }
  )
}
