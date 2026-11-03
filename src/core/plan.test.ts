import { describe, expect, test } from 'vitest'
import { planDay, type PlanTask } from './plan'

const t = (id: string, duration: number, extra: Partial<PlanTask> = {}): PlanTask => ({ id, title: id, duration, category: 'c', ...extra })
const DAY = { start: 540, end: 1320 }

describe('planDay', () => {
  test('lays tasks from the later of now and day start, keeping task fields', () => {
    const r = planDay([t('a', 30, { reward: 'tea' })], [], DAY, 600)
    expect(r.placed[0]).toMatchObject({ id: 'a', start: 600, end: 630, reward: 'tea' })
    expect(planDay([t('a', 30)], [], DAY, 100).placed[0].start).toBe(540)
  })

  test('a started first task stays pinned and extending it moves later tasks', () => {
    const base = [t('a', 30, { startMinute: 600 }), t('b', 30)]
    expect(planDay(base, [], DAY, 620).placed.map((p) => [p.id, p.start])).toEqual([['a', 600], ['b', 630]])
    const extended = [t('a', 45, { startMinute: 600, extended: 15 }), t('b', 30)]
    expect(planDay(extended, [], DAY, 630).placed.map((p) => [p.id, p.start])).toEqual([['a', 600], ['b', 645]])
  })

  test('overrunning past the planned end never places later tasks in the past', () => {
    const r = planDay([t('a', 30, { startMinute: 600 }), t('b', 30)], [], DAY, 700)
    expect(r.placed[1].start).toBe(700)
  })

  test('extension that pushes into a fixed event jumps the next task past it; overflow when the day is full', () => {
    const ev = [{ id: 'e', title: 'e', start: 650, end: 700 }]
    const r = planDay([t('a', 45, { startMinute: 600 }), t('b', 30), t('c', 700)], ev, DAY, 645)
    expect(r.placed.map((p) => [p.id, p.start])).toEqual([['a', 600], ['b', 700]])
    expect(r.overflow.map((o) => o.id)).toEqual(['c'])
  })

  test('empty list gives an empty plan', () => {
    expect(planDay([], [], DAY, 600)).toEqual({ placed: [], overflow: [], events: [] })
  })
})
