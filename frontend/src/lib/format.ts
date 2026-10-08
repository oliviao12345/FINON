import type { Status } from './types'

export const CATEGORIES = ['Bank', 'Building society', 'Insurance', 'Investments', 'Pension', 'Property', 'Savings', 'Other'] as const

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

export function fileKind(name: string) {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'pdf') return 'PDF document'
  if (ext === 'doc' || ext === 'docx') return 'Word document'
  if (ext === 'jpg' || ext === 'jpeg') return 'JPG image'
  if (ext === 'png') return 'PNG image'
  return 'File'
}

export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
export const FILE_ACCEPT = ALLOWED_EXTENSIONS.map(e => `.${e}`).join(',')
export function mimeLabel(mime: string | null | undefined) {
  if (!mime) return null
  if (mime === 'application/pdf') return 'PDF document'
  if (mime === 'image/png') return 'PNG image'
  if (mime === 'image/jpeg') return 'JPG image'
  if (mime === 'application/msword' || mime.includes('wordprocessingml')) return 'Word document'
  return null
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const FILE_TOO_LARGE_MESSAGE = 'Please choose a file under 5 MB.'
export const FILE_TYPE_MESSAGE = 'Please choose a PDF, Word document (.doc or .docx), JPG or PNG file.'

export function isAllowedFile(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 && ALLOWED_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase())
}

export const CUSTOM_NAME_PATTERN = /^[\p{L}\p{N} &'’.,()/+-]{2,80}$/u

export function cleanCustomName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ')
}
