import { describe, expect, test } from 'vitest'
import { schedule, type FixedEvent, type Task } from './scheduler'

const t = (id: string, duration: number): Task => ({ id, title: id, duration })
const DAY = { start: 9 * 60, end: 17 * 60 }

describe('schedule', () => {
  test('places tasks in order in free gaps around a fixed event', () => {
    const events: FixedEvent[] = [{ id: 'lunch', title: 'Lunch', start: 12 * 60, end: 13 * 60 }]
    const r = schedule([t('a', 30), t('b', 60), t('c', 90)], events, DAY)
    expect(r.placed.map((p) => [p.id, p.start, p.end])).toEqual([
      ['a', 540, 570],
      ['b', 570, 630],
      ['c', 630, 720],
    ])
    expect(r.overflow).toEqual([])
  })

  test('a task that does not fit the gap before an event jumps after it', () => {
    const events: FixedEvent[] = [{ id: 'e', title: 'e', start: 600, end: 660 }]
    const r = schedule([t('a', 90)], events, DAY)
    expect(r.placed[0]).toMatchObject({ id: 'a', start: 660, end: 750 })
  })

  test('task longer than every gap goes to overflow with duration unchanged', () => {
    const r = schedule([t('big', 9 * 60), t('small', 15)], [], DAY)
    expect(r.overflow).toEqual([t('big', 540)])
    expect(r.placed.map((p) => p.id)).toEqual(['small'])
  })

  test('an oversized task overflows while a later smaller task still uses the free gap', () => {
    const events: FixedEvent[] = [{ id: 'e', title: 'e', start: 600, end: 960 }]
    const r = schedule([t('a', 90), t('b', 30)], events, DAY)
    // free gaps are 09:00-10:00 and 16:00-17:00 (60 min each): a (90) fits neither, b (30) fits the first
    expect(r.overflow.map((x) => x.id)).toEqual(['a'])
    expect(r.placed.map((p) => [p.id, p.start])).toEqual([['b', 540]])
  })

  test('fixed events are returned unchanged, even overlapping/unsorted ones', () => {
    const events: FixedEvent[] = [
      { id: 'y', title: 'y', start: 700, end: 760 },
      { id: 'x', title: 'x', start: 540, end: 600 },
      { id: 'z', title: 'z', start: 580, end: 620 },
    ]
    const r = schedule([t('a', 30)], events, DAY)
    expect(r.events).toEqual(events)
    expect(r.placed[0]).toMatchObject({ start: 620, end: 650 })
  })

  test('respects an earliest start (now) so nothing is placed in the past', () => {
    const r = schedule([t('a', 30)], [], { start: 540, end: 1020 }, 600)
    expect(r.placed[0].start).toBe(600)
  })

  test('events are clamped to the day window; zero-length tasks are rejected', () => {
    const r = schedule([t('a', 30)], [{ id: 'e', title: 'e', start: 0, end: 600 }], DAY)
    expect(r.placed[0].start).toBe(600)
    expect(() => schedule([t('z', 0)], [], DAY)).toThrow()
  })

  test('rejects non-integer or inverted times instead of silently overflowing', () => {
    expect(() => schedule([t('a', 30)], [], DAY, NaN)).toThrow(RangeError)
    expect(() => schedule([t('a', 30)], [], DAY, 600.5)).toThrow(RangeError)
    expect(() => schedule([t('a', 30)], [], { start: 600, end: 500 })).toThrow(RangeError)
    expect(() => schedule([t('a', 30)], [{ id: 'e', title: 'e', start: 1.5, end: 20 }], DAY)).toThrow(RangeError)
  })
})
