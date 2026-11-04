import type { PlanTask } from './plan'
import { elapsedMs, pause, resume, start, type TimerState } from './timer'

export interface Session {
  id: string; date: string; task: string; category: string
  estimate: number; actual: number; extended: number
  distracted: boolean; energy: number | null; note: string
}
export interface DayState { tasks: PlanTask[]; sessions: Session[]; timer: TimerState | null }

export const minuteOf = (ms: number): number => {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

export const dateOf = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Time on the current block, capped at the block length: idle time while a check-in waits is not work. */
export function spentMs(head: PlanTask | undefined, timer: TimerState | null, nowMs: number): number {
  if (!head || !timer || timer.taskId !== head.id) return 0
  return Math.min(elapsedMs(timer, nowMs), head.duration * 60_000)
}

/** Drop a timer/pin left over from a previous day (a started task is pinned to a minute of *that* day). */
export function dropStale(s: DayState, today: string): DayState {
  const head = s.tasks[0]
  if (!head || head.startDate === undefined || head.startDate === today) return s
  return { ...s, tasks: [{ ...head, startMinute: undefined, startDate: undefined }, ...s.tasks.slice(1)], timer: null }
}

const withHead = (s: DayState, head: PlanTask): DayState => ({ ...s, tasks: [head, ...s.tasks.slice(1)] })

/** Start the first task, or pause/resume it if already started. */
export function toggleTimer(s: DayState, nowMs: number): DayState {
  const head = s.tasks[0]
  if (!head) return s
  if (!s.timer) return { ...withHead(s, { ...head, startMinute: minuteOf(nowMs), startDate: dateOf(nowMs) }), timer: start(head.id, nowMs) }
  return { ...s, timer: s.timer.running ? pause(s.timer, nowMs) : resume(s.timer, nowMs) }
}

/** Check-in "+N": the running task gets N more minutes; the plan re-flows from that. */
export function extend(s: DayState, minutes: number, nowMs: number): DayState {
  const head = s.tasks[0]
  if (!head || !Number.isInteger(minutes) || minutes <= 0) return s
  // Bank only the time up to the old block end, so a late click still gets the full extra minutes.
  const timer = s.timer && s.timer.taskId === head.id
    ? { ...s.timer, bankedMs: spentMs(head, s.timer, nowMs), startedAt: nowMs }
    : s.timer
  return { ...withHead(s, { ...head, duration: head.duration + minutes, extended: (head.extended ?? 0) + minutes }), timer }
}

/** Check-in "Done": log the session, drop the task, clear the timer. Returns the task's reward for the reminder. */
export function finish(s: DayState, nowMs: number): { state: DayState; reward?: string } {
  const head = s.tasks[0]
  if (!head) return { state: s }
  const extended = head.extended ?? 0
  const actualMs = spentMs(head, s.timer, nowMs)
  const session: Session = {
    id: crypto.randomUUID(), date: dateOf(nowMs), task: head.title, category: head.category,
    estimate: head.rawEstimate ?? head.duration - extended,
    actual: actualMs > 0 ? Math.max(1, Math.round(actualMs / 60_000)) : 0, // a started session counts at least a minute
    extended,
    distracted: false, energy: null, note: '',
  }
  return { state: { tasks: s.tasks.slice(1), sessions: [...s.sessions, session], timer: null }, reward: head.reward }
}

/** Check-in "Stuck / switch": send the task to the back of the queue and clear the timer (nothing is logged). */
export function stuck(s: DayState): DayState {
  const head = s.tasks[0]
  if (!head) return s
  return { ...s, tasks: [...s.tasks.slice(1), { ...head, startMinute: undefined }], timer: null }
}
