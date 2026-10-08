export function normalise(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** One definition of "the same name": ignores case, accents, spacing and punctuation, and treats & as "and". */
export function nameKey(name: string) {
  return normalise(name).replace(/ /g, '')
}

function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (i === a.length && i === b.length) return true
  if (a.length === b.length) {
    const swapped = a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)
    return swapped || a.slice(i + 1) === b.slice(i + 1)
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

function tokenScore(token: string, field: string) {
  const words = field.split(' ')
  let best = 0
  for (const word of words) {
    if (word === token) best = Math.max(best, 6)
    else if (word.startsWith(token)) best = Math.max(best, 5)
    else if (word.includes(token)) best = Math.max(best, 3)
    else if (token.length >= 4 && (withinOneEdit(token, word) || withinOneEdit(token, word.slice(0, token.length)))) {
      best = Math.max(best, 2)
    }
  }
  if (token.length >= 2) {
    const initials = words.filter(w => w !== 'and').map(w => w[0]).join('')
    if (initials.startsWith(token)) best = Math.max(best, 4)
  }
  return best
}

/** 0 means no match. Every word typed must match something; higher is a better match. */
export function matchScore(query: string, fields: string[]) {
  const tokens = normalise(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return 1
  const normalised = fields.map(normalise)
  let total = 0
  for (const token of tokens) {
    const best = Math.max(...normalised.map(f => tokenScore(token, f)))
    if (best === 0) return 0
    total += best
  }
  if (normalised[0].startsWith(tokens.join(' '))) total += 4
  return total
}
