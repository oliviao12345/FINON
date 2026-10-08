import { describe, expect, it } from 'vitest'
import { ageLabel, currentUntil, cutoffFor, subtractMonths, parseIso, toIso, validityOf } from './dates'

describe('statement date rules', () => {
  const today = '2026-10-08'

  it('uses three calendar months, not 90 days', () => {
    expect(cutoffFor(today)).toBe('2026-07-08')
  })

  it('treats a statement exactly on the cutoff as current and the day before as outdated', () => {
    expect(validityOf('2026-07-08', today)).toBe('current')
    expect(validityOf('2026-07-07', today)).toBe('outdated')
  })

  it('treats dates after today as future', () => {
    expect(validityOf('2026-10-09', today)).toBe('future')
    expect(validityOf(today, today)).toBe('current')
  })

  it('clamps month ends exactly like Java does', () => {
    expect(toIso(subtractMonths(parseIso('2026-05-31'), 3))).toBe('2026-02-28')
    expect(toIso(subtractMonths(parseIso('2028-05-31'), 3))).toBe('2028-02-29')
    expect(toIso(subtractMonths(parseIso('2026-01-31'), 3))).toBe('2025-10-31')
    expect(validityOf('2026-02-28', '2026-05-31')).toBe('current')
    expect(validityOf('2026-02-27', '2026-05-31')).toBe('outdated')
  })

  it('works out the last day a statement still counts, consistently with the cutoff rule', () => {
    expect(currentUntil('2026-07-08')).toBe('2026-10-08')
    expect(currentUntil('2026-02-28')).toBe('2026-05-31')
    for (const d of ['2026-01-31', '2026-05-31', '2026-11-30', '2028-02-29', '2026-08-15']) {
      const last = currentUntil(d)
      expect(validityOf(d, last)).toBe('current')
      const after = toIso(new Date(parseIso(last).getFullYear(), parseIso(last).getMonth(), parseIso(last).getDate() + 1))
      expect(validityOf(d, after)).toBe('outdated')
    }
  })

  it('describes how old a statement is in plain words', () => {
    expect(ageLabel('2026-10-08', '2026-10-08')).toBe('today')
    expect(ageLabel('2026-10-07', '2026-10-08')).toBe('yesterday')
    expect(ageLabel('2026-10-01', '2026-10-08')).toBe('7 days ago')
    expect(ageLabel('2026-09-17', '2026-10-08')).toBe('3 weeks ago')
    expect(ageLabel('2026-05-08', '2026-10-08')).toBe('5 months ago')
  })
})
