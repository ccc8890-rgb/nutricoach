type ChatViewport = {
  scrollHeight: number
  scrollTo: (options: ScrollToOptions) => void
}

export function scrollChatToBottom(viewport: ChatViewport | null, behavior: ScrollBehavior = 'smooth') {
  if (!viewport) return
  viewport.scrollTo({ top: viewport.scrollHeight, behavior })
}
