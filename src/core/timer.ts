/** Stopwatch state that survives reloads: only wall-clock timestamps and banked time are stored, never a tick counter. */
export interface TimerState { taskId: string; running: boolean; startedAt: number; bankedMs: number }

export const start = (taskId: string, now: number): TimerState => ({ taskId, running: true, startedAt: now, bankedMs: 0 })

export const elapsedMs = (t: TimerState, now: number): number =>
  t.bankedMs + (t.running ? Math.max(0, now - t.startedAt) : 0)

export const pause = (t: TimerState, now: number): TimerState =>
  t.running ? { ...t, running: false, bankedMs: elapsedMs(t, now) } : t

export const resume = (t: TimerState, now: number): TimerState =>
  t.running ? t : { ...t, running: true, startedAt: now }
