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
})
