/**
 * Única forma de escribir una duración o pausa en la app: minutos justos con ' («10'», «2'»)
 * y el resto en segundos con '' («45''», «90''»). Así no se confunde con un ritmo («4:15/km»).
 */
export function duracionCorta(seg: number): string {
  const total = Math.round(seg)
  return total >= 60 && total % 60 === 0 ? `${total / 60}'` : `${total}''`
}
