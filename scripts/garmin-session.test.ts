import assert from 'node:assert/strict'
import {
  cifrarConexionGarmin,
  descifrarConexionGarmin,
  type ConexionGarminGuardada,
} from '../lib/integraciones/garmin-connect-perclient'

const originalKey = process.env.GARMIN_CREDENTIALS_KEY
process.env.GARMIN_CREDENTIALS_KEY = '11'.repeat(32)

try {
  const conexion: ConexionGarminGuardada = {
    email: 'carlos@example.com',
    password: 'secreto',
    oauth1: {
      oauth_token: 'oauth1-token',
      oauth_token_secret: 'oauth1-secret',
    },
    oauth2: {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token_expires_in: 7_776_000,
      scope: 'CONNECT_READ',
      jti: 'token-id',
      expires_at: 1_800_000_000,
      refresh_token_expires_at: 1_900_000_000,
      last_update_date: '2026-10-08T00:00:00.000Z',
      expires_date: '2027-01-15T08:00:00.000Z',
    },
  }

  assert.deepEqual(
    descifrarConexionGarmin(cifrarConexionGarmin(conexion)),
    conexion,
    'los tokens renovables deben sobrevivir al almacenamiento cifrado',
  )

  const cifradoLegacy = cifrarConexionGarmin({
    email: 'legacy@example.com',
    password: 'legacy-secret',
  })
  assert.deepEqual(
    descifrarConexionGarmin(cifradoLegacy),
    { email: 'legacy@example.com', password: 'legacy-secret' },
    'las conexiones antiguas sin tokens deben seguir siendo válidas',
  )

  console.log('garmin-session.test.ts OK')
} finally {
  if (originalKey === undefined) delete process.env.GARMIN_CREDENTIALS_KEY
  else process.env.GARMIN_CREDENTIALS_KEY = originalKey
}
