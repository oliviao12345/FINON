import { describe, expect, it } from 'vitest'
import { matchScore } from './search'

const finds = (query: string, name: string, category = 'Bank') => matchScore(query, [name, category]) > 0

describe('smart provider search', () => {
  it('ignores case, spacing and punctuation', () => {
    expect(finds('LLOYDS', 'Lloyds Bank')).toBe(true)
    expect(finds('  lloyds   bank ', 'Lloyds Bank')).toBe(true)
    expect(finds('m&s', 'M&S Bank')).toBe(true)
    expect(finds('j.p. morgan', 'J.P. Morgan Private Bank')).toBe(true)
    expect(finds('st james', "St. James's Place", 'Investments')).toBe(true)
  })

  it('matches the start of words, the middle of words, and split-up words', () => {
    expect(finds('barcl', 'Barclays')).toBe(true)
    expect(finds('west', 'NatWest')).toBe(true)
    expect(finds('nat west', 'NatWest')).toBe(true)
    expect(finds('lansdown hargreaves', 'Hargreaves Lansdown', 'Investments')).toBe(true)
  })

  it('matches initials', () => {
    expect(finds('hl', 'Hargreaves Lansdown', 'Investments')).toBe(true)
    expect(finds('ab', 'AJ Bell', 'Investments')).toBe(true)
    expect(finds('lg', 'Legal & General', 'Pension')).toBe(true)
  })

  it('forgives a single typo in longer words', () => {
    expect(finds('vangard', 'Vanguard', 'Investments')).toBe(true)
    expect(finds('barclais', 'Barclays')).toBe(true)
    expect(finds('fidelty', 'Fidelity', 'Investments')).toBe(true)
    expect(finds('mnzo', 'Monzo')).toBe(true)
    expect(finds('mzo', 'Monzo')).toBe(false)
  })

  it('searches the category and any extra fields too', () => {
    expect(finds('pension', 'Nest', 'Pension')).toBe(true)
    expect(matchScore('statement_jan', ['Barclays', 'Bank', 'statement_jan.pdf'])).toBeGreaterThan(0)
  })

  it('returns nothing when any typed word matches nothing', () => {
    expect(finds('xyzzy', 'Barclays')).toBe(false)
    expect(finds('barclays xyzzy', 'Barclays')).toBe(false)
  })

  it('ranks a name that starts with the query above a loose match', () => {
    const exact = matchScore('mon', ['Monzo', 'Bank'])
    const loose = matchScore('mon', ['Close Brothers Money', 'Bank'])
    expect(exact).toBeGreaterThan(loose)
  })
})
