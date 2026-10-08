import type { Status } from './types'

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function todayIso() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const STATUS_LABEL: Record<Status, string> = {
  MISSING: 'Missing',
  UPLOADED: 'Uploaded',
  OUTDATED: 'Outdated',
}

export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
export const FILE_ACCEPT = ALLOWED_EXTENSIONS.map(e => `.${e}`).join(',')
export const FILE_TYPE_MESSAGE = 'Please choose a PDF, Word document (.doc or .docx), JPG or PNG file.'

export function isAllowedFile(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 && ALLOWED_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase())
}
