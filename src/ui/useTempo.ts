import { useCallback, useEffect, useRef, useState } from 'react'
import { dateOf, dropStale, minuteOf, type DayState } from '../core/day'
import type { PlanTask } from '../core/plan'
import { parseIcs } from '../core/ics'
import type { FixedEvent } from '../core/scheduler'
import { openTempoDb, type TempoDb } from '../storage/db'

const EMPTY: DayState = { tasks: [], sessions: [], timer: null }

async function persist(db: TempoDb, prev: DayState, next: DayState) {
  const ops: Promise<void>[] = next.tasks.map((t, order) => db.put('tasks', { ...t, order }))
  for (const t of prev.tasks) if (!next.tasks.some((n) => n.id === t.id)) ops.push(db.remove('tasks', t.id))
  for (const s of next.sessions) if (!prev.sessions.includes(s)) ops.push(db.put('sessions', s))
  if (prev.timer !== next.timer) ops.push(db.saveTimer(next.timer)) // a stale second tab must not overwrite a timer it never touched
  await Promise.all(ops)
}

export function useTempo() {
  const [state, setState] = useState<DayState>(EMPTY)
  const [events, setEvents] = useState<FixedEvent[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const db = useRef<TempoDb | null>(null)
  const current = useRef(state)
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    openTempoDb().then(async (opened) => {
      const [tasks, stored, sessions, timer] = await Promise.all([opened.getAll('tasks'), opened.getAll('events'), opened.getAll('sessions'), opened.loadTimer()])
      if (cancelled) { opened.close(); return }
      db.current = opened
      const today = dateOf(Date.now())
      const ordered = tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(({ order: _order, ...t }) => t)
      const loaded = dropStale({ tasks: ordered, sessions, timer }, today)
      current.current = loaded
      if (loaded.timer !== timer) await persist(opened, { tasks: ordered, sessions, timer }, loaded)
      setState(current.current)
      setEvents(stored.filter((e) => e.date === today))
    }).catch((e: unknown) => setError(`Storage unavailable, changes will not be saved (${e instanceof Error ? e.message : String(e)})`))
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true; db.current?.close() }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  /** Apply a pure transition, show it immediately, and write it to IndexedDB in order. */
  const apply = useCallback((fn: (s: DayState) => DayState) => {
    const prev = current.current
    const next = fn(prev)
    if (next === prev) return
    current.current = next
    setState(next)
    const opened = db.current
    if (opened) queue.current = queue.current.then(() => persist(opened, prev, next)).catch((e: unknown) => setError(`Could not save: ${e instanceof Error ? e.message : String(e)}`))
  }, [])

  const addTask = useCallback((t: Omit<PlanTask, 'id'>) => apply((s) => ({ ...s, tasks: [...s.tasks, { ...t, id: crypto.randomUUID() }] })), [apply])
  const removeTask = useCallback((id: string) => apply((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id), timer: s.timer?.taskId === id ? null : s.timer })), [apply])

  const importIcs = useCallback(async (file: File) => {
    const today = dateOf(Date.now())
    const result = parseIcs(await file.text(), new Date(), 0, 24 * 60)
    if (result.events.length === 0) {
      // Never wipe saved events because of a bad or wrong-day file (errors also mean nothing was imported).
      setImportErrors([...result.errors, ...result.warnings, 'No events for today were imported; kept your existing events.'])
      return
    }
    setImportErrors(result.warnings)
    setEvents(result.events)
    const opened = db.current
    if (!opened) return
    queue.current = queue.current.then(async () => {
      for (const old of await opened.getAll('events')) await opened.remove('events', old.id)
      for (const e of result.events) await opened.put('events', { ...e, date: today })
    }).catch((e: unknown) => setError(`Could not save events: ${e instanceof Error ? e.message : String(e)}`))
  }, [])

  return { state, events, importErrors, error, ready, nowMs, nowMinute: minuteOf(nowMs), apply, addTask, removeTask, importIcs }
}
