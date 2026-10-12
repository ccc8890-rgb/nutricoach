// Añade al catálogo (visible para todos los coaches, coach_id null) ejercicios de pliometría que faltaban. Simula por defecto; --apply inserta.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

const NUEVOS = [
  { nombre: 'Saltos con contramovimiento (CMJ)', grupo_muscular: 'Piernas', dificultad_nivel: 2, descripcion: 'Salto vertical máximo tras bajar rápido a un cuarto de sentadilla. Aterriza suave y estable; descansa entre saltos.' },
  { nombre: 'Sentadilla con salto con carga', grupo_muscular: 'Piernas', dificultad_nivel: 3, descripcion: 'Sentadilla con salto con carga ligera (barra o mancuernas) a máxima velocidad. Para trabajar potencia, no fatiga.' },
  { nombre: 'Saltos a una pierna (hops)', grupo_muscular: 'Piernas', dificultad_nivel: 3, descripcion: 'Saltos continuos y cortos sobre una pierna, con contacto breve y tronco estable.' },
  { nombre: 'Zancadas con salto', grupo_muscular: 'Piernas', dificultad_nivel: 3, descripcion: 'Desde zancada, salto explosivo cambiando de pierna en el aire y aterrizando de nuevo en zancada.' },
  { nombre: 'Saltos de vallas (hurdle hops)', grupo_muscular: 'Piernas', dificultad_nivel: 3, descripcion: 'Saltos seguidos sobre vallas bajas con contacto de suelo mínimo.' },
  { nombre: 'Salto en profundidad (drop jump)', grupo_muscular: 'Piernas', dificultad_nivel: 4, descripcion: 'Bajar de un cajón bajo y saltar de inmediato al tocar el suelo. Solo con buena base de fuerza y técnica de aterrizaje.' },
  { nombre: 'Pogo jumps (saltos de tobillo)', grupo_muscular: 'Piernas', dificultad_nivel: 1, descripcion: 'Saltos rápidos y rígidos solo con tobillos, rodillas casi extendidas. Base de la pliometría para corredores.' },
  { nombre: 'Bounding (zancadas largas con salto)', grupo_muscular: 'Piernas', dificultad_nivel: 3, descripcion: 'Zancadas largas y elásticas alternando piernas, buscando distancia y tiempo de vuelo.' },
  { nombre: 'Lanzamiento de balón medicinal (slam)', grupo_muscular: 'Cuerpo completo', dificultad_nivel: 2, descripcion: 'Elevar el balón sobre la cabeza y lanzarlo al suelo con todo el cuerpo. Potencia de tronco y hombro.' },
  { nombre: 'Salto con barra hexagonal', grupo_muscular: 'Piernas', dificultad_nivel: 4, descripcion: 'Salto vertical con barra hexagonal ligera. Potencia de cadera y pierna con carga.' },
]

;(async () => {
  const { data: existentes } = await db.from('ejercicios').select('nombre')
  const ya = new Set((existentes ?? []).map(e => String(e.nombre).toLowerCase()))
  const nuevos = NUEVOS.filter(e => !ya.has(e.nombre.toLowerCase()))
  for (const e of nuevos) console.log(`${APPLY ? 'añade' : 'añadiría'}: ${e.nombre}`)
  if (APPLY && nuevos.length) {
    const { error } = await db.from('ejercicios').insert(nuevos.map(e => ({ ...e, tipo: 'funcional', custom: false, coach_id: null, video_tipo: 'youtube', equipamiento: [], musculos_secundarios: [] })))
    if (error) { console.error('Error:', error.message); process.exit(1) }
  }
  console.log(nuevos.length, APPLY ? 'insertados' : 'por insertar (usa --apply)', '·', NUEVOS.length - nuevos.length, 'ya existían')
})()
