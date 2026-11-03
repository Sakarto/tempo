/** All times are integer minutes since local midnight. */
export interface Task { id: string; title: string; duration: number }
export interface FixedEvent { id: string; title: string; start: number; end: number }
export type PlacedTask<T extends Task = Task> = T & { start: number; end: number }
export interface DayWindow { start: number; end: number }
export interface Schedule<T extends Task = Task> { placed: PlacedTask<T>[]; overflow: T[]; events: FixedEvent[] }

/** Free [start,end) gaps in the window at or after `from`, with fixed events (possibly overlapping) removed. */
function freeGaps(events: FixedEvent[], day: DayWindow, from: number): [number, number][] {
  const busy = events
    .map((e): [number, number] => [Math.max(e.start, day.start), Math.min(e.end, day.end)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])
  const gaps: [number, number][] = []
  let cursor = Math.max(day.start, from)
  for (const [s, e] of busy) {
    if (s > cursor) gaps.push([cursor, s])
    cursor = Math.max(cursor, e)
  }
  if (cursor < day.end) gaps.push([cursor, day.end])
  return gaps
}

/**
 * Lay tasks (already in priority order) into the free gaps. Tasks never shrink and fixed events never move.
 * Placed tasks stay in priority order in time; a task that fits no remaining gap goes to overflow and
 * later (smaller) tasks may still use the space.
 */
export function schedule<T extends Task>(tasks: T[], events: FixedEvent[], day: DayWindow, from = day.start): Schedule<T> {
  const ints = [day.start, day.end, from, ...events.flatMap((e) => [e.start, e.end])]
  if (!ints.every(Number.isInteger) || day.end < day.start) throw new RangeError('Times must be integer minutes and day.end >= day.start')
  for (const t of tasks) {
    if (!Number.isInteger(t.duration) || t.duration <= 0) throw new RangeError(`Invalid duration for task ${t.id}`)
  }
  const gaps = freeGaps(events, day, from)
  const placed: PlacedTask<T>[] = []
  const overflow: T[] = []
  let cursor = -Infinity
  for (const task of tasks) {
    let slot: number | undefined
    for (const [gs, ge] of gaps) {
      const start = Math.max(gs, cursor)
      if (ge - start >= task.duration) { slot = start; break }
    }
    if (slot === undefined) { overflow.push(task); continue }
    placed.push({ ...task, start: slot, end: slot + task.duration })
    cursor = slot + task.duration
  }
  return { placed, overflow, events }
}
