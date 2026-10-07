import assert from 'node:assert/strict'

process.env.STRAVA_CLIENT_ID = '12345'
process.env.STRAVA_CLIENT_SECRET = 'secret'
process.env.NEXT_PUBLIC_APP_URL = 'https://nutricoach.example'
process.env.INTEGRACIONES_STATE_SECRET = 'state-secret'

async function main() {
  const { stravaProvider, validarScopesStrava } = await import('../lib/integraciones/strava')

  const authUrl = new URL(stravaProvider.getAuthUrl('cliente-1', 'portal'))
  assert.equal(
    authUrl.searchParams.get('approval_prompt'),
    'force',
    'reconectar debe mostrar el consentimiento para recuperar permisos revocados',
  )

  assert.doesNotThrow(() => validarScopesStrava('read,activity:read_all'))
  assert.throws(
    () => validarScopesStrava('read,activity:read'),
    /activity:read_all/,
    'no debe guardar una conexión sin acceso completo a las actividades',
  )

  console.log('strava-auth.test.ts OK')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
