export type ClienteApi = {
  id: string; nombre: string; apellidos?: string; email?: string; activo?: boolean
  plan_activo?: { id: string; nombre: string } | null
}
export type ClienteLista = { id: string; etiqueta: string }

const completo = (c: ClienteApi) => [c.nombre, c.apellidos].filter(Boolean).join(' ').trim() || c.email || 'Sin nombre'

// Solo clientes con dieta activa; los de nombre repetido se distinguen por el plan y, si aun así coinciden, por el correo.
export function etiquetarClientes(clientes: ClienteApi[]): ClienteLista[] {
  const conPlan = clientes.filter(c => c.plan_activo)
  const contar = (f: (c: ClienteApi) => string) => conPlan.reduce((m, c) => m.set(f(c), (m.get(f(c)) ?? 0) + 1), new Map<string, number>())
  const porNombre = contar(completo)
  const etiquetas = conPlan.map(c => (porNombre.get(completo(c))! > 1 ? `${completo(c)} · ${c.plan_activo!.nombre}` : completo(c)))
  const porEtiqueta = etiquetas.reduce((m, e) => m.set(e, (m.get(e) ?? 0) + 1), new Map<string, number>())
  return conPlan.map((c, i) => ({ id: c.id, etiqueta: porEtiqueta.get(etiquetas[i])! > 1 ? `${etiquetas[i]} · ${c.email}` : etiquetas[i] }))
}

// Lo último elegido si sigue existiendo; si no, el coach (apellido Casanova o su correo); si no, el primero.
export function clientePorDefecto(lista: ClienteLista[], guardado: string | null, crudos: ClienteApi[] = []): string {
  if (guardado && lista.some(c => c.id === guardado)) return guardado
  const coach = crudos.find(c => /casanova|ccc8890/i.test(`${c.apellidos ?? ''} ${c.email ?? ''}`) && lista.some(l => l.id === c.id))
  return coach?.id ?? lista[0]?.id ?? ''
}
