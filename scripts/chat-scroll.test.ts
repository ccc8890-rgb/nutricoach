import assert from 'node:assert/strict'
import { scrollChatToBottom } from '../lib/cliente/chat-scroll'

const llamadas: ScrollToOptions[] = []
const viewport = {
  scrollHeight: 840,
  scrollTo(options: ScrollToOptions) {
    llamadas.push(options)
  },
}

scrollChatToBottom(viewport, 'smooth')

assert.deepEqual(
  llamadas,
  [{ top: 840, behavior: 'smooth' }],
  'el chat debe desplazar únicamente su viewport interno hasta el último mensaje',
)

console.log('chat-scroll: OK')
