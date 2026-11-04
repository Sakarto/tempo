import { schedule, type DayWindow, type FixedEvent, type PlacedTask, type Schedule, type Task } from './scheduler'

export interface ExtendInput {
  current: Task
  /** Minute the current task started; it stays pinned there while it runs. */
  start: number
  /** Minutes added at check-in (e.g. 15 or 30). */
  extra: number
  /** Remaining tasks in priority order. */
  rest: Task[]
  events: FixedEvent[]
  day: DayWindow
}

/**
 * Extend the running task, then re-flow the rest of the day after it. Fixed events and durations never change.
 * "Later tasks shift by N" means: they are re-packed after the new end, so the shift equals N when the old layout
 * was contiguous. The pinned task may overlap a fixed event or pass day.end; it is never shrunk (see SPEC.md).
 */
export function extendCurrent({ current, start, extra, rest, events, day }: ExtendInput): Schedule {
  if (!Number.isInteger(extra) || extra <= 0) throw new RangeError('extra must be a positive integer')
  const duration = current.duration + extra
  const end = start + duration
  const head: PlacedTask = { ...current, duration, start, end }
  const tail = schedule(rest, events, day, end)
  return { ...tail, placed: [head, ...tail.placed] }
}
