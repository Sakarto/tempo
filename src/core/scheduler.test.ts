import { describe, expect, it } from 'vitest'
import { schedule, type Task } from './scheduler'

const t = (id: string, estimate: number, priority = 1): Task => ({ id, title: id, category: 'x', estimate, priority })
const day = { dayStart: 540, dayEnd: 1320 } // 09:00-22:00

describe('schedule', () => {
  it('packs tasks back to back from the day start', () => {
    const r = schedule({ ...day, events: [], tasks: [t('a', 60), t('b', 30)] })
    expect(r.blocks).toEqual([
      { taskId: 'a', start: 540, end: 600 },
      { taskId: 'b', start: 600, end: 630 },
    ])
    expect(r.overflow).toEqual([])
  })

  it('never overlaps a fixed event and never moves it', () => {
    const events = [{ id: 'e', title: 'class', start: 600, end: 660 }]
    const r = schedule({ ...day, events, tasks: [t('a', 60), t('b', 60), t('c', 90)] })
    for (const b of r.blocks) expect(b.end <= 600 || b.start >= 660).toBe(true)
    expect(r.blocks.map((b) => [b.taskId, b.start])).toEqual([['a', 540], ['b', 660], ['c', 720]])
  })

  it('puts a task that fits no gap in overflow with its duration unchanged', () => {
    const events = [{ id: 'e', title: 'x', start: 600, end: 1320 }]
    const big = t('big', 90)
    const r = schedule({ ...day, events, tasks: [big, t('s', 30)] })
    expect(r.overflow).toEqual([big])
    expect(r.blocks).toEqual([{ taskId: 's', start: 540, end: 570 }])
  })

  it('orders by priority (1 first), stable for ties', () => {
    const r = schedule({ ...day, events: [], tasks: [t('low', 30, 3), t('hi', 30, 1), t('hi2', 30, 1)] })
    expect(r.blocks.map((b) => b.taskId)).toEqual(['hi', 'hi2', 'low'])
  })

  it('handles overlapping/unsorted events and events outside the day', () => {
    const events = [
      { id: '1', title: '', start: 620, end: 700 },
      { id: '2', title: '', start: 600, end: 650 },
      { id: '3', title: '', start: 0, end: 100 },
    ]
    const r = schedule({ ...day, events, tasks: [t('a', 60), t('b', 30)] })
    expect(r.blocks[0]).toEqual({ taskId: 'a', start: 540 , end: 600 })
    expect(r.blocks[1].start).toBe(700)
  })

  it('does not schedule before `from` (re-flow after now)', () => {
    const r = schedule({ ...day, from: 615, events: [], tasks: [t('a', 30)] })
    expect(r.blocks[0].start).toBe(615)
  })

  it('never places a task with a non-positive or NaN estimate', () => {
    const bad = [t('neg', -10), t('zero', 0), t('nan', NaN)]
    const r = schedule({ ...day, events: [], tasks: [...bad, t('ok', 30)] })
    expect(r.blocks).toEqual([{ taskId: 'ok', start: 540, end: 570 }])
    expect(r.overflow).toEqual(bad)
  })

  it('ignores a NaN `from`', () => {
    const r = schedule({ ...day, from: NaN, events: [], tasks: [t('a', 30)] })
    expect(r.blocks[0].start).toBe(540)
  })
})
