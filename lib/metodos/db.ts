// lib/metodos/db.ts
// Único sitio que habla con las tablas de la biblioteca de métodos. Toda lectura va filtrada por coach_id:
// el id de una ficha de otra cuenta es, para este coach, una ficha que no existe.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metodo, TipoEventoMetodo } from './constantes'

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function cargarMetodo(admin: SupabaseClient, id: string, coachId: string): Promise<Metodo | null> {
  if (!UUID.test(id)) return null
  const { data } = await admin.from('metodos').select('*').eq('id', id).eq('coach_id', coachId).maybeSingle()
  return (data as Metodo | null) ?? null
}

export async function registrarEvento(admin: SupabaseClient, metodoId: string, tipo: TipoEventoMetodo, nota?: string): Promise<void> {
  await admin.from('metodos_eventos').insert({ metodo_id: metodoId, tipo, nota: nota?.trim().slice(0, 500) || null })
}
