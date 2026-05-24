#!/usr/bin/env node
// Test E2E del sistema de agentes contra Supabase real
// Ejecutar: node scripts/test-agentes-e2e.mjs
// Cliente de prueba: Javier Sánchez (d1564f22-9980-4a21-978b-b06881ceda0d)

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Cargar .env.local
const envPath = resolve(process.cwd(), '.env.local')
const env = readFileSync(envPath, 'utf8')
for (const line of env.split('\n')) {
  const [k, ...rest] = line.split('=')
  if (k && rest.length) process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY   = process.env.GEMINI_API_KEY
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY

const CLIENTE_ID = 'd1564f22-9980-4a21-978b-b06881ceda0d'
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const sep = (t) => console.log(`\n${'─'.repeat(60)}\n${t}\n${'─'.repeat(60)}`)
const ok  = (t) => console.log(`  ✅ ${t}`)
const err = (t) => console.log(`  ❌ ${t}`)
const inf = (t) => console.log(`  ℹ️  ${t}`)

// ── PASO 1: Verificar datos del cliente ──────────────────────────
sep('PASO 1 — Verificar datos del cliente Javier')

const { data: cliente } = await db.from('clientes').select('*').eq('id', CLIENTE_ID).single()
if (!cliente) { err('Cliente no encontrado'); process.exit(1) }
const { data: perfil } = await db.from('profiles').select('nombre, apellidos, email').eq('id', cliente.profile_id).single()
ok(`Cliente: ${perfil?.nombre} ${perfil?.apellidos} (${perfil?.email})`)
ok(`Objetivo: ${cliente.objetivo} | Peso inicial: ${cliente.peso_inicial}kg`)

const [{ count: nCheckins }, { count: nPlan }, { count: nEntreno }, { count: nSets }] = await Promise.all([
  db.from('checkins').select('*', { count: 'exact', head: true }).eq('cliente_id', CLIENTE_ID),
  db.from('planes_nutricion').select('*', { count: 'exact', head: true }).eq('cliente_id', CLIENTE_ID).eq('activo', true),
  db.from('planes_entrenamiento').select('*', { count: 'exact', head: true }).eq('cliente_id', CLIENTE_ID).eq('activo', true),
  db.from('registros_sets').select('*', { count: 'exact', head: true }).eq('cliente_id', CLIENTE_ID),
])
ok(`Checkins: ${nCheckins} | Plan nutrición activo: ${nPlan} | Plan entreno activo: ${nEntreno} | Sesiones: ${nSets}`)

const { data: lastCheckin } = await db.from('checkins').select('fecha, adherencia, energia, sueno').eq('cliente_id', CLIENTE_ID).order('fecha', { ascending: false }).limit(1).single()
const { data: lastSet } = await db.from('registros_sets').select('fecha, esfuerzo_percibido').eq('cliente_id', CLIENTE_ID).order('fecha', { ascending: false }).limit(1).single()

const diasSinCheckin = Math.floor((Date.now() - new Date(lastCheckin.fecha).getTime()) / 86_400_000)
const diasSinSesion  = Math.floor((Date.now() - new Date(lastSet.fecha).getTime()) / 86_400_000)
ok(`Último check-in: ${lastCheckin.fecha} (hace ${diasSinCheckin} días) | adherencia=${lastCheckin.adherencia}/10`)
ok(`Última sesión entreno: ${lastSet.fecha} (hace ${diasSinSesion} días) | RPE=${lastSet.esfuerzo_percibido}`)

// ── PASO 2: actualizarPerfilAprendizaje ─────────────────────────
sep('PASO 2 — actualizarPerfilAprendizaje()')

const { data: checkins } = await db.from('checkins').select('fecha, peso, adherencia').eq('cliente_id', CLIENTE_ID).order('fecha', { ascending: false }).limit(30)
const adherenciaMedia = checkins.reduce((s, c) => s + (c.adherencia ?? 0), 0) / checkins.length
const pesos = checkins.filter(c => c.peso).map(c => c.peso)
const diff = pesos.length >= 2 ? pesos[0] - pesos[pesos.length - 1] : 0
const pesoTendencia = diff < -0.3 ? 'bajando' : diff > 0.3 ? 'subiendo' : 'estable'
const riesgoAbandono = Math.min(1, diasSinCheckin / 21)

const { error: upsertErr } = await db.from('cliente_perfil_aprendizaje').upsert({
  cliente_id: CLIENTE_ID,
  adherencia_media: Math.round(adherenciaMedia),
  checkins_completados: checkins.length,
  peso_tendencia: pesoTendencia,
  riesgo_abandono: Math.round(riesgoAbandono * 100) / 100,
  ultima_actualizacion: new Date().toISOString(),
}, { onConflict: 'cliente_id' })

if (upsertErr) { err(`upsert perfil: ${upsertErr.message}`) }
else { ok(`Perfil actualizado — adherencia_media=${Math.round(adherenciaMedia)}, peso_tendencia=${pesoTendencia}, riesgo_abandono=${(riesgoAbandono*100).toFixed(0)}%`) }

// ── PASO 3: Agente Riesgo Nutrición ─────────────────────────────
sep('PASO 3 — Agente Riesgo Nutrición')

if (!GEMINI_KEY) { err('GEMINI_API_KEY no configurada'); process.exit(1) }

inf(`Riesgo abandono: ${(riesgoAbandono*100).toFixed(0)}% (umbral 45%)`)
const UMBRAL = 0.45

if (riesgoAbandono < UMBRAL) {
  inf(`Riesgo bajo el umbral → no genera tarea. (${diasSinCheckin} días sin checkin, umbral activa >9 días)`)
} else {
  inf('Riesgo ALTO → llamando Gemini Flash...')
  const prompt = `Eres el agente de Riesgo de NutriCoach. Cliente: ${perfil?.nombre}, lleva ${diasSinCheckin} días sin check-in, adherencia media ${Math.round(adherenciaMedia)}/10. Genera un mensaje de re-engagement personalizado. Responde en JSON: {"propuesta":"mensaje","razonamiento":"motivo","prioridad":3,"score_confianza":0.7}`
  const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } })
  })
  const gData = await gRes.json()
  const gText = gData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const parsed = JSON.parse(gText)
  ok(`Gemini respondió: "${parsed.propuesta?.slice(0, 80)}..."`)

  const { data: tarea, error: tErr } = await db.from('agente_tareas').insert({
    tipo: 'alerta_riesgo', cliente_id: CLIENTE_ID, agente: 'riesgo', estado: 'pendiente',
    prioridad: parsed.prioridad ?? 3, payload: { riesgo_abandono: riesgoAbandono, dias_sin_checkin: diasSinCheckin },
    propuesta: parsed.propuesta, razonamiento: parsed.razonamiento, fuentes: []
  }).select().single()
  if (tErr) err(`Error guardando tarea riesgo: ${tErr.message}`)
  else ok(`Tarea alerta_riesgo creada → id=${tarea.id}`)
}

// ── PASO 4: Agente Riesgo Entrenamiento ─────────────────────────
sep('PASO 4 — Agente Riesgo Entrenamiento')

inf(`Días sin sesión de entreno: ${diasSinSesion} (umbral 10 días)`)
if (diasSinSesion < 10) {
  inf('Actividad reciente → no genera tarea')
} else {
  inf(`Inactividad DETECTADA (${diasSinSesion} días) → llamando Gemini Flash...`)
  const { data: planEntreno } = await db.from('planes_entrenamiento').select('nombre').eq('cliente_id', CLIENTE_ID).eq('activo', true).single()
  const promptE = `Eres agente de adherencia al entrenamiento de NutriCoach. Cliente: ${perfil?.nombre}, plan activo: "${planEntreno?.nombre}", lleva ${diasSinSesion} días sin registrar sesión. Genera mensaje de reactivación en 2 frases max. JSON: {"propuesta":"msg","razonamiento":"motivo","prioridad":4}`
  const gResE = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptE }] }], generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } })
  })
  const gDataE = await gResE.json()
  const gTextE = gDataE.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const parsedE = JSON.parse(gTextE)
  ok(`Gemini respondió: "${parsedE.propuesta?.slice(0, 80)}..."`)

  const { data: tareaE, error: tErrE } = await db.from('agente_tareas').insert({
    tipo: 'alerta_riesgo_entreno', cliente_id: CLIENTE_ID, agente: 'riesgo', estado: 'pendiente',
    prioridad: parsedE.prioridad ?? 4, payload: { dias_sin_sesion: diasSinSesion, plan: planEntreno?.nombre },
    propuesta: parsedE.propuesta, razonamiento: parsedE.razonamiento, fuentes: []
  }).select().single()
  if (tErrE) err(`Error guardando tarea riesgo entreno: ${tErrE.message}`)
  else ok(`Tarea alerta_riesgo_entreno creada → id=${tareaE.id}`)
}

// ── PASO 5: Verificar tareas generadas ──────────────────────────
sep('PASO 5 — Verificar tareas en agente_tareas')

const { data: tareas } = await db.from('agente_tareas').select('tipo, estado, prioridad, propuesta').eq('cliente_id', CLIENTE_ID).order('created_at', { ascending: false })
if (!tareas?.length) {
  err('No se generaron tareas')
} else {
  ok(`${tareas.length} tarea(s) generada(s):`)
  for (const t of tareas) {
    console.log(`    • [${t.estado}] tipo=${t.tipo} | prioridad=${t.prioridad}`)
    console.log(`      propuesta: "${t.propuesta?.slice(0, 90)}..."`)
  }
}

// ── PASO 6: Simular APROBACIÓN de una tarea ─────────────────────
sep('PASO 6 — Simular aprobación coach → aplicarTarea()')

const tareaParaAprobar = tareas?.[0]
if (!tareaParaAprobar) { err('No hay tareas para aprobar'); process.exit(0) }

// Actualizar estado a aprobado
const { error: approveErr } = await db.from('agente_tareas')
  .update({ estado: 'aprobado', revisado_at: new Date().toISOString() })
  .eq('cliente_id', CLIENTE_ID)
  .eq('tipo', tareaParaAprobar.tipo)
  .eq('estado', 'pendiente')

if (approveErr) { err(`Error aprobando: ${approveErr.message}`) }
else { ok('Tarea marcada como aprobada en BD') }

// Aplicar: insertar mensaje en chat_mensajes
const { data: msg, error: msgErr } = await db.from('chat_mensajes').insert({
  cliente_id: CLIENTE_ID,
  remitente: 'coach',
  contenido: tareaParaAprobar.propuesta,
  leido: false,
}).select().single()

if (msgErr) err(`Error insertando chat_mensajes: ${msgErr.message}`)
else ok(`Mensaje insertado en chat_mensajes → id=${msg.id}`)

// ── PASO 7: Verificar mensaje en portal cliente ──────────────────
sep('PASO 7 — Verificar mensaje visible en portal cliente')

const { data: msgs } = await db.from('chat_mensajes')
  .select('id, remitente, contenido, leido, created_at')
  .eq('cliente_id', CLIENTE_ID)
  .eq('remitente', 'coach')
  .eq('leido', false)
  .order('created_at', { ascending: false })

if (!msgs?.length) {
  err('No hay mensajes del coach no leídos en chat_mensajes')
} else {
  ok(`${msgs.length} mensaje(s) no leído(s) del coach en chat_mensajes:`)
  for (const m of msgs) {
    console.log(`    • id=${m.id}`)
    console.log(`      contenido: "${m.contenido?.slice(0, 100)}..."`)
    console.log(`      leido=${m.leido} | created_at=${m.created_at}`)
  }
}

// ── RESUMEN FINAL ────────────────────────────────────────────────
sep('RESUMEN E2E')

const { count: totalTareas } = await db.from('agente_tareas').select('*', { count: 'exact', head: true }).eq('cliente_id', CLIENTE_ID)
const { count: totalMsgs }   = await db.from('chat_mensajes').select('*', { count: 'exact', head: true }).eq('cliente_id', CLIENTE_ID)
const { data: perfilFinal }   = await db.from('cliente_perfil_aprendizaje').select('*').eq('cliente_id', CLIENTE_ID).single()

ok(`Total tareas generadas: ${totalTareas}`)
ok(`Total mensajes en chat: ${totalMsgs}`)
ok(`Perfil aprendizaje: riesgo_abandono=${perfilFinal?.riesgo_abandono}, adherencia_media=${perfilFinal?.adherencia_media}, peso_tendencia=${perfilFinal?.peso_tendencia}`)
console.log('\n🟢 TEST E2E COMPLETADO\n')
