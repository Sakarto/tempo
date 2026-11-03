import { describe, expect, test } from 'vitest'
import { dateOf, extend, finish, minuteOf, stuck, toggleTimer, type DayState } from './day'
import type { PlanTask } from './plan'
import { elapsedMs } from './timer'

const t = (id: string, duration: number, extra: Partial<PlanTask> = {}): PlanTask => ({ id, title: id, duration, category: 'study', ...extra })
const empty = (tasks: PlanTask[]): DayState => ({ tasks, sessions: [], timer: null })
const at = (h: number, m: number) => new Date(2026, 10, 3, h, m, 0).getTime()

describe('day transitions', () => {
  test('toggleTimer starts the first task, then pauses and resumes it', () => {
    const s1 = toggleTimer(empty([t('a', 30), t('b', 30)]), at(10, 0))
    expect(s1.tasks[0].startMinute).toBe(600)
    expect(s1.timer?.running).toBe(true)
    const s2 = toggleTimer(s1, at(10, 10))
    expect(s2.timer?.running).toBe(false)
    expect(elapsedMs(s2.timer!, at(10, 50))).toBe(10 * 60_000)
    const s3 = toggleTimer(s2, at(11, 0))
    expect(elapsedMs(s3.timer!, at(11, 5))).toBe(15 * 60_000)
  })

  test('toggleTimer with no tasks does nothing', () => {
    const s = empty([])
    expect(toggleTimer(s, 0)).toBe(s)
  })

  test('extend adds minutes to the first task and tracks the extension; bad values ignored', () => {
    const s = extend(extend(empty([t('a', 30)]), 15), 30)
    expect(s.tasks[0]).toMatchObject({ duration: 75, extended: 45 })
    expect(extend(s, 0)).toBe(s)
    expect(extend(s, 7.5)).toBe(s)
  })

  test('finish logs a session with estimate, actual and extension, removes the task and returns its reward', () => {
    let s = toggleTimer(empty([t('a', 30, { reward: '10 min YouTube' }), t('b', 30)]), at(10, 0))
    s = extend(s, 15)
    const r = finish(s, at(10, 50))
    expect(r.reward).toBe('10 min YouTube')
    expect(r.state.tasks.map((x) => x.id)).toEqual(['b'])
    expect(r.state.timer).toBeNull()
    expect(r.state.sessions).toHaveLength(1)
    expect(r.state.sessions[0]).toMatchObject({ task: 'a', category: 'study', estimate: 30, extended: 15, actual: 50, date: '2026-11-03' })
  })

  test('finish before starting logs actual 0; finish with no tasks is a no-op', () => {
    expect(finish(empty([t('a', 15)]), at(9, 0)).state.sessions[0].actual).toBe(0)
    const s = empty([])
    expect(finish(s, 0).state).toBe(s)
  })

  test('stuck moves the task to the back, unpins it and clears the timer', () => {
    const s = stuck(toggleTimer(empty([t('a', 30), t('b', 30)]), at(10, 0)))
    expect(s.tasks.map((x) => x.id)).toEqual(['b', 'a'])
    expect(s.tasks[1].startMinute).toBeUndefined()
    expect(s.timer).toBeNull()
    expect(stuck(empty([])).tasks).toEqual([])
  })

  test('minuteOf and dateOf use local time', () => {
    expect(minuteOf(at(13, 7))).toBe(787)
    expect(dateOf(at(0, 5))).toBe('2026-11-03')
  })
})
