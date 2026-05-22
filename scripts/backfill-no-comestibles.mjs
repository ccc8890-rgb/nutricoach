/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛡️ BACKFILL — Marcar productos no comestibles en BD
 * ═══════════════════════════════════════════════════════════════════════
 * Lee TODOS los alimentos de la BD, aplica esProductoNoComestible()
 * y actualiza es_comestible = false para los que coincidan.
 *
 * Debe reflejar EXACTAMENTE los patrones de guard-no-comestible.ts
 * ═══════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Mismos patrones que lib/scraping/guard-no-comestible.ts ─────────────
const PATRONES_NO_COMESTIBLE: RegExp[] = [
  /comida (gato|gatos|perro|perros|perr[oa])/i,
  /comida (seca|humeda) (gatos|perros)/i,
  /pienso|arena (para )?gato|snack (para )?(perro|gato)/i,
  /mascotas|empapadores mascotas|lecho mascotas/i,
  /compresa|salvaslip|protegeslip|tampon|copa menstrual/i,
  /pan (banador|bano|braguita)/i,
  /preservativo|lubricante sexual/i,
  /pasta (dientes|encias)|dentifrico|cepillo dental|hilo dental/i,
  /enjuague bucal|irrigador dental|arcos dentales/i,
  /champu|acondicionador (cabello|pelo)/i,
  /mascarilla (cabello|capilar)/i,
  /gel fijador|laca (pelo|cabello)|cera pelo|fijador cabello/i,
  /tinte (cabello|pelo)|decolorante cabello|aclarante cabello/i,
  /coloracion permanente|coloracion hombre/i,
  /ampollas (capilares|cabello|tratamiento|flash)/i,
  /serum cabello|{