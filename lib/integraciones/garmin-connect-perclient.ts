// lib/integraciones/garmin-connect-perclient.ts
// Garmin Connect sync por cliente usando sus propias credenciales
// Cifrado AES-256-CBC con GARMIN_CREDENTIALS_KEY

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncGarminDay, persistirGarminDays, dateRange } from './garmin-connect-sync'

const KEY_HEX = process.env.GARMIN_CREDENTIALS_KEY ?? ''

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 32) throw new Error('GARMIN_CREDENTIALS_KEY no configurada o demasiado corta')
  return Buffer.from(KEY_HEX.slice(0, 64), 'hex') // 32 bytes = 64 hex chars
}

export function cifrarCredenciales(email: string, password: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const json = JSON.stringify({ email, password })
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function descifrarCredenciales(cifrado: string): { email: string; password: string } {
  const key = getKey()
  const [ivHex, encHex] = cifrado.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}

// Verificar login con credenciales del cliente antes de guardarlas
export async function verificarCredencialesGarmin(email: string, password: string): Promise<string> {
  const { GarminConnect } = await import('garmin-connect')
  const gc = new GarminConnect({ username: email, password })
  await gc.login()
  const profile = await gc.getUserProfile()
  const displayName = (profile as unknown as Record<string, string>).displayName
  if (!displayName) throw new Error('No se pudo obtener el perfil de Garmin Connect')
  return displayName
}

// Sync de hoy + ayer para un cliente específico usando sus credenciales
export async function syncGarminClientDays(
  db: SupabaseClient,
  clienteId: string,
  credencialesCifradas: string,
  dias: number = 2
): Promise<number> {
  const { email, password } = descifrarCredenciales(credencialesCifradas)

  // Login con credenciales del cliente
  const { GarminConnect } = await import('garmin-connect')
  const gc = new GarminConnect({ username: email, password })
  await gc.login()

  const profile = await gc.getUserProfile()
  const displayName = (profile as unknown as Record<string, string>).displayName

  const hasta = new Date()
  const desde = new Date(Date.now() - (dias - 1) * 24 * 60 * 60 * 1000)
  const fechas = dateRange(desde, hasta)

  const results = await Promise.all(
    fechas.map(fecha => syncGarminDay(fecha, gc, displayName))
  )
  const validos = results.filter(Boolean) as NonNullable<typeof results[0]>[]
  if (validos.length === 0) return 0

  await persistirGarminDays(db, clienteId, validos)
  return validos.length
}
