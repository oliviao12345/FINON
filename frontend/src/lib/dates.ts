export const MAX_AGE_MONTHS = 3

export function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Calendar-month subtraction that clamps to the end of a shorter month, like java.time.LocalDate.minusMonths. */
export function subtractMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() - months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return target
}

export function cutoffFor(todayIso: string) {
  return toIso(subtractMonths(parseIso(todayIso), MAX_AGE_MONTHS))
}

export type DateValidity = 'current' | 'outdated' | 'future'

export function validityOf(dateIso: string, todayIso: string): DateValidity {
  if (dateIso > todayIso) return 'future'
  return dateIso < cutoffFor(todayIso) ? 'outdated' : 'current'
}

export function addMonthsClamped(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return target
}

/** The last day on which a statement with this date still counts as current. */
export function currentUntil(dateIso: string) {
  let day = addMonthsClamped(parseIso(dateIso), MAX_AGE_MONTHS)
  for (let i = 0; i < 4; i++) {
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    if (cutoffFor(toIso(next)) <= dateIso) day = next
    else break
  }
  return toIso(day)
}

export function ageLabel(dateIso: string, todayIso: string) {
  const days = Math.round((parseIso(todayIso).getTime() - parseIso(dateIso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30.44)} months ago`
}
