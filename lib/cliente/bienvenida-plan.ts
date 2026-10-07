export function claveBienvenidaPlan(clienteId: string): string {
  return `nutricoach:bienvenida-plan:${clienteId}`
}

export function debeMostrarBienvenidaPlan({
  clienteId,
  tienePlan,
  yaVista,
}: {
  clienteId: string
  tienePlan: boolean
  yaVista: boolean
}): boolean {
  return Boolean(clienteId && tienePlan && !yaVista)
}
