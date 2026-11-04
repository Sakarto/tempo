import { describe, expect, test } from 'vitest'
import { extendCurrent } from './reflow'
import type { FixedEvent, Task } from './scheduler'

const t = (id: string, duration: number): Task => ({ id, title: id, duration })
const DAY = { start: 540, end: 1020 }
const run = (extra: number, events: FixedEvent[] = [], rest = [t('b', 30), t('c', 60)]) =>
  extendCurrent({ current: t('a', 30), start: 540, extra, rest, events, day: DAY })

describe('extendCurrent', () => {
  test('+15 moves every later task 15 min later', () => {
    const r = run(15)
    expect(r.placed.map((p) => [p.id, p.start, p.end])).toEqual([
      ['a', 540, 585],
      ['b', 585, 615],
      ['c', 615, 675],
    ])
  })

  test('a later task that would hit a fixed event jumps to the next gap', () => {
    const r = run(30, [{ id: 'e', title: 'e', start: 600, end: 660 }])
    // a ends 600; b fits at 660 after the event
    expect(r.placed.map((p) => [p.id, p.start])).toEqual([['a', 540], ['b', 660], ['c', 690]])
    expect(r.events[0].start).toBe(600)
  })

  test('tasks that no longer fit become overflow, durations unchanged', () => {
    const r = run(15, [], [t('b', 30), t('c', 420)])
    expect(r.overflow).toEqual([t('c', 420)])
    expect(r.placed.map((p) => p.id)).toEqual(['a', 'b'])
  })

  test('rejects a non-positive or fractional extension', () => {
    expect(() => run(0)).toThrow(RangeError)
    expect(() => run(7.5)).toThrow(RangeError)
  })

  test('re-packs after the new end: slack before a later task is not preserved', () => {
    // a runs 09:00-09:30 (+15 -> 09:45); b used to start at 11:40 but is re-packed right after a
    const r = extendCurrent({ current: t('a', 30), start: 540, extra: 15, rest: [t('b', 30)], events: [], day: DAY })
    expect(r.placed.map((p) => [p.id, p.start])).toEqual([['a', 540], ['b', 585]])
  })

  test('an extension that runs into a fixed event keeps the event and the full duration', () => {
    const ev: FixedEvent[] = [{ id: 'e', title: 'e', start: 560, end: 620 }]
    const r = extendCurrent({ current: t('a', 30), start: 540, extra: 30, rest: [t('b', 30)], events: ev, day: DAY })
    expect(r.placed[0]).toMatchObject({ id: 'a', start: 540, end: 600 })
    expect(r.placed[1]).toMatchObject({ id: 'b', start: 620 })
    expect(r.events).toEqual(ev)
  })
})
