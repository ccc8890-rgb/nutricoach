#!/usr/bin/env tsx
/**
 * 📊 Auto-entrenamiento: Analiza qué papers de Knowledge Base se están usando realmente
 * en los planes nutricionales y recomienda ajustes al TAG_BRIDGE.
 *
 * Uso:
 *   npx tsx scripts/analizar-uso-papers.ts
 *   npx tsx scripts/analizar-uso-papers.ts --json     → output JSON
 *   npx tsx scripts/analizar-uso-papers.ts --top 10   → solo top N usados
 *   npx tsx scripts/analizar-uso-papers.ts --bottom 10 → solo menos usados
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceSupabase } from '../lib/supabase-server'

interface ProtocoloUsado {
  id: string
  titulo: string
  vecesUsado: number
  clientes: string[]        // nombres de clientes donde aparece
}

interface StatsUso {
  totalPlanes: number
  totalProtocolos: number
  protocolosUsados: ProtocoloUsado[]
  protocolosNoUsados: { id: string; titulo: string; tags: string[] }[]
  cobertura: number          // % de protocolos que se usan al menos una vez
  sugerencias: string[]
}

function extraerProtocolosDePlan(planJson: any): string[] {
  if (!planJson || typeof planJson !== 'object') return []

  const ids = new Set<string>()

  // Buscar en evidencia_cientifica (formato TAG_BRIDGE)
  const evidencia = planJson.evidencia_cientifica
  if (evidencia?.protocolos) {
    for (const p of evidencia.protocolos) {
      if (p.id) ids.add(p.id)
      if (p.titulo) ids.add(p.titulo)    // fallback si no hay id
    }
  }

  // Buscar en contexto_conocimiento (legacy)
  if (Array.isArray(planJson.contexto_conocimiento)) {
    for (const ctx of planJson.contexto_conocimiento) {
      if (ctx.id) ids.add(ctx.id)
      if (ctx.titulo) ids.add(ctx.titulo)
    }
  }

  // Buscar en conocimiento_str (string concatenado)
  if (typeof planJson.conocimiento_str === 'string') {
    // Marcadores de protocolos inyectados en el prompt
    const matches = planJson.conocimiento_str.match(/\[([A-Z_]+)\]/g)
    if (matches) matches.forEach((m: string) => ids.add(m.replace(/[[\]]/g, '')))
  }

  // Buscar en knowledgeContext (array de objetos con id)
  if (Array.isArray(planJson.knowledgeContext)) {
    for (const kc of planJson.knowledgeContext) {
      if (kc.id) ids.add(kc.id)
      if (kc.titulo) ids.add(kc.titulo)
    }
  }

  return Array.from(ids)
}

async function main() {
  const supabase = createServiceSupabase()
  const args = process.argv.slice(2)
  const outputJson = args.includes('--json')
  const topN = args.includes('--top') ? parseInt(args[args.indexOf('--top') + 1], 10) : null
  const bottomN = args.includes('--bottom') ? parseInt(args[args.indexOf('--bottom') + 1], 10) : null

  console.log('\n🔬 Analizando uso de papers en planes nutricionales...\n')

  // 1. Obtener todos los planes con plan_json
  const { data: planes, error: errPlanes } = await supabase
    .from('planes_nutricion')
    .select('id, nombre, cliente_id, plan_json')

  if (errPlanes) {
    console.error('❌ Error al obtener planes:', errPlanes.message)
    process.exit(1)
  }

  if (!planes || planes.length === 0) {
    console.log('⚠️  No hay planes nutricionales para analizar.')
    process.exit(0)
  }

  // 2. Obtener nombres de clientes
  const clienteIds = [...new Set(planes.map(p => p.cliente_id).filter(Boolean))]
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, profile:profiles!profile_id(nombre, apellidos)')
    .in('id', clienteIds)

  const mapCliente: Record<string, string> = {}
  if (clientes) {
    for (const c of clientes) {
      const p = (c as any).profile
      mapCliente[c.id] = p ? `${p.nombre ?? ''} ${p.apellidos ?? ''}`.trim() || 'Cliente' : 'Cliente'
    }
  }

  // 3. Obtener todos los protocolos de knowledge_base
  const { data: protocolos } = await supabase
    .from('knowledge_base')
    .select('id, titulo, tags, activo')
    .eq('activo', true)

  const mapProtocolo: Record<string, { titulo: string; tags: string[] }> = {}
  const mapPorTitulo: Record<string, string> = {}  // titulo normalizado → id
  if (protocolos) {
    for (const p of protocolos) {
      mapProtocolo[p.id] = { titulo: p.titulo, tags: p.tags ?? [] }
      // Mapa auxiliar para buscar por título normalizado (fallback)
      const key = p.titulo.toLowerCase().trim()
      if (!mapPorTitulo[key]) mapPorTitulo[key] = p.id
    }
  }

  // 4. Extraer uso
  const uso: Record<string, string[]> = {}  // protocoloId → cliente names
  const noReconocidos = new Set<string>()

  for (const plan of planes) {
    if (!plan.plan_json) continue

    const idsEncontrados = extraerProtocolosDePlan(plan.plan_json)
    const clienteNombre = plan.cliente_id ? (mapCliente[plan.cliente_id] ?? 'Cliente') : 'Cliente'

    for (const idOrTitulo of idsEncontrados) {
      // Intentar lookup por id (UUID) primero, luego por título normalizado
      const matchedId = mapProtocolo[idOrTitulo]
        ? idOrTitulo
        : mapPorTitulo[idOrTitulo.toLowerCase().trim()] ?? null

      if (matchedId) {
        if (!uso[matchedId]) uso[matchedId] = []
        if (!uso[matchedId].includes(clienteNombre)) {
          uso[matchedId].push(clienteNombre)
        }
      } else {
        noReconocidos.add(idOrTitulo)
      }
    }
  }

  // 5. Construir stats
  const protocolosUsados: ProtocoloUsado[] = Object.entries(uso)
    .map(([id, clientes]) => ({
      id,
      titulo: mapProtocolo[id]?.titulo ?? id,
      vecesUsado: clientes.length,
      clientes,
    }))
    .sort((a, b) => b.vecesUsado - a.vecesUsado)

  const protocolosNoUsados = protocolos
    ?.filter(p => !uso[p.id] && p.activo)
    .map(p => ({ id: p.id, titulo: p.titulo, tags: p.tags ?? [] })) ?? []

  const totalProtocolos = protocolos?.length ?? 0
  const totalUsados = protocolosUsados.length
  const cobertura = totalProtocolos > 0 ? Math.round((totalUsados / totalProtocolos) * 100) : 0

  // 6. Generar sugerencias automáticas
  const sugerencias: string[] = []

  if (protocolosNoUsados.length > 0) {
    sugerencias.push(`🔴 ${protocolosNoUsados.length} protocolos NUNCA usados. Revisar si: (a) no matchean con TAG_BRIDGE, (b) están obsoletos, (c) desactivarlos.`)
  }

  // Tags que aparecen en KB pero no en TAG_BRIDGE
  const tagsKB = new Set<string>()
  for (const p of protocolos ?? []) {
    for (const t of p.tags ?? []) tagsKB.add(t.toLowerCase())
  }
  const tagsBridge = new Set<string>()
  const TAG_BRIDGE = (await import('../lib/knowledge-base')).TAG_BRIDGE
  for (const vals of Object.values(TAG_BRIDGE)) {
    for (const v of vals) tagsBridge.add(v.toLowerCase())
  }

  const tagsSinPuente = [...tagsKB].filter(t => !tagsBridge.has(t))
  if (tagsSinPuente.length > 0) {
    sugerencias.push(`🟡 ${tagsSinPuente.length} tags en papers NO tienen entrada en TAG_BRIDGE: ${tagsSinPuente.slice(0, 10).join(', ')}${tagsSinPuente.length > 10 ? ` y ${tagsSinPuente.length - 10} más` : ''}`)
  }

  // Papers más usados vs menos usados
  if (protocolosUsados.length > 0) {
    const maxUso = protocolosUsados[0].vecesUsado
    const minUso = protocolosUsados[protocolosUsados.length - 1].vecesUsado

    const infrautilizados = protocolosUsados.filter(p => p.vecesUsado <= 1 && protocolosUsados.length > 5)
    if (infrautilizados.length > 0) {
      sugerencias.push(`🟡 ${infrautilizados.length} protocolos usados solo 1 vez. Posible gap en TAG_BRIDGE o falta de clientes con ese perfil.`)
    }

    if (maxUso > minUso * 3 && protocolosUsados.length > 3) {
      sugerencias.push(`💡 Alta concentración en "${protocolosUsados[0].titulo.slice(0, 60)}" (${maxUso} usos). El TAG_BRIDGE prioriza mucho este perfil.`)
    }
  }

  // 7. Output
  const stats: StatsUso = {
    totalPlanes: planes.length,
    totalProtocolos,
    protocolosUsados,
    protocolosNoUsados,
    cobertura,
    sugerencias,
  }

  if (outputJson) {
    console.log(JSON.stringify(stats, null, 2))
    process.exit(0)
  }

  // ── Output legible ──
  console.log('══════════════════════════════════════════════════')
  console.log('📊 AUTO-ENTRENAMIENTO — Uso de Papers en Planes')
  console.log('══════════════════════════════════════════════════\n')

  console.log(`📋 Total planes analizados:  ${stats.totalPlanes}`)
  console.log(`📚 Total protocolos en KB:   ${stats.totalProtocolos}`)
  console.log(`✅ Protocolos usados:         ${totalUsados}`)
  console.log(`❌ Protocolos NO usados:      ${protocolosNoUsados.length}`)
  console.log(`📈 Cobertura:                 ${cobertura}%\n`)

  // ── Ranking de uso ──
  console.log('─── TOP MÁS USADOS ───')
  const top = protocolosUsados.slice(0, topN ?? 10)
  for (let i = 0; i < top.length; i++) {
    const p = top[i]
    console.log(`  ${String(i + 1).padEnd(2)}. ${p.vecesUsado.toString().padEnd(3)} usos  ${p.titulo.slice(0, 70)}`)
  }

  if (protocolosUsados.length > 0) {
    console.log()
    console.log('─── MENOS USADOS ───')
    const bottom = bottomN
      ? protocolosUsados.slice(-bottomN).reverse()
      : protocolosUsados.slice(-5).reverse()
    for (let i = 0; i < bottom.length; i++) {
      const p = bottom[i]
      console.log(`  ${String(i + 1).padEnd(2)}. ${p.vecesUsado.toString().padEnd(3)} usos  ${p.titulo.slice(0, 70)}`)
    }
  }

  // ── No usados ──
  if (protocolosNoUsados.length > 0) {
    console.log('\n─── PROTOCOLOS NUNCA USADOS ───')
    const mostrar = bottomN
      ? protocolosNoUsados.slice(0, bottomN)
      : protocolosNoUsados.slice(0, 15)
    for (const p of mostrar) {
      console.log(`  · ${p.titulo}  [tags: ${p.tags.join(', ').slice(0, 60)}]`)
    }
    if (protocolosNoUsados.length > mostrar.length) {
      console.log(`  ... y ${protocolosNoUsados.length - mostrar.length} más`)
    }
  }

  // ── No reconocidos ──
  if (noReconocidos.size > 0) {
    console.log('\n─── IDs/Rutas NO RECONOCIDOS en KB ───')
    for (const id of noReconocidos) {
      console.log(`  · ${id}`)
    }
  }

  // ── Sugerencias ──
  if (sugerencias.length > 0) {
    console.log('\n─── SUGERENCIAS ───')
    for (const s of sugerencias) {
      console.log(`  ${s}`)
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log(`💡 Ejecuta: npx tsx scripts/analizar-uso-papers.ts --json > reports/uso-papers.json`)
  console.log()
}

main().catch(console.error)
