import '@testing-library/jest-dom/vitest'

Element.prototype.scrollIntoView = () => {}
URL.createObjectURL = () => 'blob:preview'
URL.revokeObjectURL = () => {}

const store = new Map<string, string>()
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
})
