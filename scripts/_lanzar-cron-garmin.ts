// Lanza una pasada del cron enviar-garmin en local (necesita .env.local). Uso: npx tsx scripts/_lanzar-cron-garmin.ts
import fs from 'fs'
import { NextRequest } from 'next/server'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { if (l.includes('=') && !l.startsWith('#')) { const i = l.indexOf('='); process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^"|"$/g, '') } }
process.env.CRON_SECRET = 'local-' + Math.random().toString(36).slice(2)
async function main() {
  const { GET } = await import('../app/api/cron/enviar-garmin/route')
  const res = await GET(new NextRequest('http://localhost/api/cron/enviar-garmin', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))
  console.log(res.status, JSON.stringify(await res.json()))
}
main()
