import { schedule, type DayWindow, type FixedEvent, type PlacedTask, type Task } from './scheduler'

export const DEFAULT_DAY: DayWindow = { start: 9 * 60, end: 22 * 60 }

export interface PlanTask extends Task {
  category: string
  reward?: string
  /** The user's own estimate when they accepted an adjusted suggestion; logged so learning compares actual to it, not to the adjusted value. */
  rawEstimate?: number
  /** Minutes added at check-ins; the original estimate is duration - extended. */
  extended?: number
  /** Minute of day the running task first started; pins it in place while the rest re-flows. */
  startMinute?: number
  /** Local date (YYYY-MM-DD) of startMinute. */
  startDate?: string
}

export interface Plan { placed: PlacedTask<PlanTask>[]; overflow: PlanTask[]; events: FixedEvent[] }

/** Today's plan: a started first task stays pinned where it began; everything else flows into the gaps after it (and after now). */
export function planDay(tasks: PlanTask[], events: FixedEvent[], day: DayWindow, now: number): Plan {
  const [head, ...rest] = tasks
  if (head?.startMinute !== undefined) {
    const end = head.startMinute + head.duration
    const tail = schedule(rest, events, day, Math.max(end, now, day.start))
    return { ...tail, placed: [{ ...head, start: head.startMinute, end }, ...tail.placed] }
  }
  return schedule(tasks, events, day, Math.max(now, day.start))
}
