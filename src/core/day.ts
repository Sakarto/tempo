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

const withHead = (s: DayState, head: PlanTask): DayState => ({ ...s, tasks: [head, ...s.tasks.slice(1)] })

/** Start the first task, or pause/resume it if already started. */
export function toggleTimer(s: DayState, nowMs: number): DayState {
  const head = s.tasks[0]
  if (!head) return s
  if (!s.timer) return { ...withHead(s, { ...head, startMinute: minuteOf(nowMs) }), timer: start(head.id, nowMs) }
  return { ...s, timer: s.timer.running ? pause(s.timer, nowMs) : resume(s.timer, nowMs) }
}

/** Check-in "+N": the running task gets N more minutes; the plan re-flows from that. */
export function extend(s: DayState, minutes: number): DayState {
  const head = s.tasks[0]
  if (!head || !Number.isInteger(minutes) || minutes <= 0) return s
  return withHead(s, { ...head, duration: head.duration + minutes, extended: (head.extended ?? 0) + minutes })
}

/** Check-in "Done": log the session, drop the task, clear the timer. Returns the task's reward for the reminder. */
export function finish(s: DayState, nowMs: number): { state: DayState; reward?: string } {
  const head = s.tasks[0]
  if (!head) return { state: s }
  const extended = head.extended ?? 0
  const actualMs = s.timer && s.timer.taskId === head.id ? elapsedMs(s.timer, nowMs) : 0
  const session: Session = {
    id: crypto.randomUUID(), date: dateOf(nowMs), task: head.title, category: head.category,
    estimate: head.duration - extended, actual: Math.round(actualMs / 60_000), extended,
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
