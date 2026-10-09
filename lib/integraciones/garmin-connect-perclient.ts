// lib/integraciones/garmin-connect-perclient.ts
// Garmin Connect sync por cliente usando sus propias credenciales
// Cifrado AES-256-CBC con GARMIN_CREDENTIALS_KEY

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IOauth1Token, IOauth2Token } from 'garmin-connect/dist/garmin/types'
import { syncGarminDay, persistirGarminDays, dateRange } from './garmin-connect-sync'
import { sincronizarEntrenosGarmin } from '@/lib/rendimiento/garmin-entrenos'

export interface ConexionGarminGuardada {
  email: string
  password: string
  oauth1?: IOauth1Token
  oauth2?: IOauth2Token
}

function getKey(): Buffer {
  const KEY_HEX = process.env.GARMIN_CREDENTIALS_KEY ?? ''
  if (!KEY_HEX || KEY_HEX.length < 32) throw new Error('GARMIN_CREDENTIALS_KEY no configurada o demasiado corta')
  return Buffer.from(KEY_HEX.slice(0, 64), 'hex') // 32 bytes = 64 hex chars
}

export function cifrarConexionGarmin(conexion: ConexionGarminGuardada): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const json = JSON.stringify(conexion)
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function cifrarCredenciales(email: string, password: string): string {
  return cifrarConexionGarmin({ email, password })
}

export function descifrarConexionGarmin(cifrado: string): ConexionGarminGuardada {
  const key = getKey()
  const [ivHex, encHex] = cifrado.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return JSON.parse(decrypted.toString('utf8')) as ConexionGarminGuardada
}

export function descifrarCredenciales(cifrado: string): { email: string; password: string } {
  const { email, password } = descifrarConexionGarmin(cifrado)
  return { email, password }
}

// Verificar login con credenciales del cliente antes de guardarlas
export async function crearConexionGarmin(
  email: string,
  password: string,
): Promise<{ displayName: string; conexion: ConexionGarminGuardada }> {
  const { GarminConnect } = await import('garmin-connect')
  const gc = new GarminConnect({ username: email, password })
  await gc.login()
  const profile = await gc.getUserProfile()
  const displayName = (profile as unknown as Record<string, string>).displayName
  if (!displayName) throw new Error('No se pudo obtener el perfil de Garmin Connect')
  const { oauth1, oauth2 } = gc.exportToken()
  return { displayName, conexion: { email, password, oauth1, oauth2 } }
}

export async function verificarCredencialesGarmin(email: string, password: string): Promise<string> {
  return (await crearConexionGarmin(email, password)).displayName
}

// Sync de hoy + ayer para un cliente específico usando sus credenciales
export async function syncGarminClientDays(
  db: SupabaseClient,
  clienteId: string,
  credencialesCifradas: string,
  dias: number = 2
): Promise<number> {
  const conexion = descifrarConexionGarmin(credencialesCifradas)

  const { GarminConnect } = await import('garmin-connect')
  let gc = new GarminConnect({ username: conexion.email, password: conexion.password })

  if (conexion.oauth1 && conexion.oauth2) {
    gc.loadToken(conexion.oauth1, conexion.oauth2)
    try {
      await gc.getUserProfile()
    } catch {
      gc = new GarminConnect({ username: conexion.email, password: conexion.password })
      await gc.login()
    }
  } else {
    await gc.login()
  }

  const profile = await gc.getUserProfile()
  const displayName = (profile as unknown as Record<string, string>).displayName

  const hasta = new Date()
  const desde = new Date(Date.now() - (dias - 1) * 24 * 60 * 60 * 1000)
  const fechas = dateRange(desde, hasta)

  const results = await Promise.all(
    fechas.map(fecha => syncGarminDay(fecha, gc, displayName))
  )
  const validos = results.filter(Boolean) as NonNullable<typeof results[0]>[]
  if (validos.length > 0) {
    await persistirGarminDays(db, clienteId, validos)
  }
  try {
    await sincronizarEntrenosGarmin(db, clienteId, gc, 20)
  } catch (e) {
    console.error('[garmin] entrenos individuales:', e instanceof Error ? e.message : e) // no debe tumbar el resumen diario
  }
  const { oauth1, oauth2 } = gc.exportToken()
  await db
    .from('integraciones_cliente')
    .update({
      credenciales_json: cifrarConexionGarmin({
        email: conexion.email,
        password: conexion.password,
        oauth1,
        oauth2,
      }),
    })
    .eq('cliente_id', clienteId)
    .eq('proveedor', 'garmin_connect')
  return validos.length
}
