import { describe, expect, test } from 'vitest'
import { categoryStats, focusMinutesByDay, streakDays } from './stats'

const s = (date: string, category: string, estimate: number, actual: number) => ({ date, category, estimate, actual })

describe('categoryStats', () => {
  test('averages and the median ratio per category, ratio only from 3 sessions', () => {
    const log = [s('2026-11-01', 'study', 60, 90), s('2026-11-02', 'study', 30, 60), s('2026-11-03', 'study', 60, 60), s('2026-11-03', 'gym', 60, 55)]
    const r = categoryStats(log)
    expect(r.find((c) => c.category === 'study')).toEqual({ category: 'study', sessions: 3, avgEstimate: 50, avgActual: 70, ratio: 1.5 })
    expect(r.find((c) => c.category === 'gym')).toEqual({ category: 'gym', sessions: 1, avgEstimate: 60, avgActual: 55, ratio: null })
  })

  test('category names are merged ignoring case/whitespace and sorted by session count', () => {
    const log = [s('2026-11-01', 'Study', 30, 30), s('2026-11-01', 'study ', 30, 30), s('2026-11-01', 'gym', 30, 30)]
    expect(categoryStats(log).map((c) => [c.category, c.sessions])).toEqual([['study', 2], ['gym', 1]])
  })

  test('empty log and zero-length sessions are handled', () => {
    expect(categoryStats([])).toEqual([])
    expect(categoryStats([s('2026-11-01', 'x', 30, 0)])[0]).toMatchObject({ sessions: 1, avgActual: 0, ratio: null })
  })
})

describe('focusMinutesByDay', () => {
  test('sums actual minutes per date, oldest first', () => {
    const log = [s('2026-11-02', 'a', 30, 20), s('2026-11-01', 'a', 30, 25), s('2026-11-02', 'b', 30, 40)]
    expect(focusMinutesByDay(log)).toEqual([{ date: '2026-11-01', minutes: 25 }, { date: '2026-11-02', minutes: 60 }])
  })
})

describe('streakDays', () => {
  const days = (...d: string[]) => d.map((date) => s(date, 'a', 30, 30))
  test('counts consecutive days ending today', () => {
    expect(streakDays(days('2026-11-01', '2026-11-02', '2026-11-03'), '2026-11-03')).toBe(3)
  })
  test('a day without sessions yet today does not break the streak (counts from yesterday)', () => {
    expect(streakDays(days('2026-11-01', '2026-11-02'), '2026-11-03')).toBe(2)
  })
  test('a gap ends the streak; older runs do not count', () => {
    expect(streakDays(days('2026-10-28', '2026-10-29', '2026-11-02', '2026-11-03'), '2026-11-03')).toBe(2)
    expect(streakDays(days('2026-11-01'), '2026-11-03')).toBe(0)
  })
  test('sessions with zero actual minutes do not count; duplicates on a day count once; month and year boundaries work', () => {
    expect(streakDays([s('2026-11-03', 'a', 30, 0)], '2026-11-03')).toBe(0)
    expect(streakDays(days('2026-12-31', '2026-12-31', '2027-01-01'), '2027-01-01')).toBe(2)
    expect(streakDays(days('2028-02-28', '2028-02-29', '2028-03-01'), '2028-03-01')).toBe(3)
  })
  test('no sessions gives 0', () => {
    expect(streakDays([], '2026-11-03')).toBe(0)
  })
})
