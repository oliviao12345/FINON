const KEY = 'finon.session'

let memory: string | null = null

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * A random id the browser keeps and sends with every request. It is the private key to this visitor's own
 * data on the backend (not a login), so it is never shown or put in a link.
 */
export function sessionId() {
  if (memory) return memory
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) {
      memory = saved.toLowerCase()
      return memory
    }
  } catch {
    // storage unavailable: fall through and keep the id for this page only
  }
  memory = newId()
  try {
    window.localStorage.setItem(KEY, memory)
  } catch {
    // ignore
  }
  return memory
}
