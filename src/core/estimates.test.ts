import { describe, expect, test } from 'vitest'
import { categoryMultiplier, suggestEstimate, type SessionLog } from './estimates'

const s = (category: string, estimate: number, actual: number): SessionLog => ({ category, estimate, actual })

describe('estimates', () => {
  test('no suggestion with fewer than 3 sessions', () => {
    const log = [s('study', 60, 90), s('study', 60, 90)]
    expect(categoryMultiplier(log, 'study')).toBeNull()
    expect(suggestEstimate(log, 'study', 60)).toBeNull()
  })

  test('ratios 1.5, 2, 1 give multiplier 1.5 and 60 suggests 90', () => {
    const log = [s('study', 60, 90), s('study', 30, 60), s('study', 60, 60)]
    expect(categoryMultiplier(log, 'study')).toBe(1.5)
    expect(suggestEstimate(log, 'study', 60)).toBe(90)
  })

  test('median of an even count averages the middle two', () => {
    const log = [s('a', 10, 10), s('a', 10, 20), s('a', 10, 30), s('a', 10, 40)]
    expect(categoryMultiplier(log, 'a')).toBe(2.5)
  })

  test('categories are independent', () => {
    const log = [s('x', 60, 120), s('x', 60, 120), s('x', 60, 120), s('y', 60, 60), s('y', 60, 60)]
    expect(suggestEstimate(log, 'x', 30)).toBe(60)
    expect(suggestEstimate(log, 'y', 30)).toBeNull()
  })

  test('suggestion snaps to 15-minute blocks, minimum 15', () => {
    const fast = [s('f', 60, 6), s('f', 60, 6), s('f', 60, 6)]
    expect(suggestEstimate(fast, 'f', 15)).toBe(15)
    const odd = [s('o', 60, 70), s('o', 60, 70), s('o', 60, 70)]
    expect(suggestEstimate(odd, 'o', 60)).toBe(75)
  })

  test('sessions with non-positive estimate or actual are ignored', () => {
    const log = [s('z', 0, 30), s('z', 60, 0), s('z', 60, 60), s('z', 60, 60)]
    expect(categoryMultiplier(log, 'z')).toBeNull()
  })

  test('non-finite values never produce a suggestion that is not a 15-minute block', () => {
    const inf = [s('a', 1, Infinity), s('a', 1, Infinity), s('a', 1, Infinity)]
    expect(categoryMultiplier(inf, 'a')).toBeNull()
    const ok = [s('a', 60, 60), s('a', 60, 60), s('a', 60, 60)]
    expect(suggestEstimate(ok, 'a', NaN)).toBeNull()
    expect(suggestEstimate(ok, 'a', Infinity)).toBeNull()
    expect(suggestEstimate(ok, 'a', 0)).toBeNull()
    expect(suggestEstimate(ok, 'a', -5)).toBeNull()
  })

  test('category names match ignoring case and surrounding whitespace', () => {
    const log = [s('Writing', 60, 90), s('writing ', 60, 90), s(' WRITING', 60, 90)]
    expect(suggestEstimate(log, 'writing', 60)).toBe(90)
    expect(suggestEstimate(log, 'Writing  ', 60)).toBe(90)
  })
})
