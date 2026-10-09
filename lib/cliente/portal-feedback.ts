export type PortalFeedback = {
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
  importance?: 'important'
}

export function emitPortalFeedback(
  send: (feedback: Omit<PortalFeedback, 'importance'>) => void,
  feedback: PortalFeedback,
) {
  if (feedback.type === 'success' && feedback.importance !== 'important') return false

  const visibleFeedback: Omit<PortalFeedback, 'importance'> = {
    type: feedback.type,
    title: feedback.title,
    ...(feedback.message !== undefined ? { message: feedback.message } : {}),
    ...(feedback.duration !== undefined ? { duration: feedback.duration } : {}),
  }
  send(visibleFeedback)
  return true
}
