import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { schedule, type FixedEvent, type Task } from './core/scheduler'
import { emptyState, loadState, saveState } from './store/db'

const DAY_START = 9 * 60
const DAY_END = 22 * 60
const ESTIMATES = [15, 30, 60, 90]

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const parseTime = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(emptyState.tasks)
  const [events, setEvents] = useState<FixedEvent[]>(emptyState.events)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadState().then((s) => { setTasks(s.tasks); setEvents(s.events); setLoaded(true) })
  }, [])
  useEffect(() => {
    if (loaded) void saveState({ tasks, events })
  }, [loaded, tasks, events])

  const plan = useMemo(() => schedule({ tasks, events, dayStart: DAY_START, dayEnd: DAY_END }), [tasks, events])
  const byId = new Map(tasks.map((t) => [t.id, t]))

  function addTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const title = String(f.get('title')).trim()
    if (!title) return setError('Give the task a title.')
    setError('')
    setTasks([...tasks, {
      id: crypto.randomUUID(), title, category: String(f.get('category')).trim() || 'general',
      estimate: Number(f.get('estimate')), priority: Number(f.get('priority')),
    }])
    e.currentTarget.reset()
  }

  function addEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const start = parseTime(String(f.get('start')))
    const end = parseTime(String(f.get('end')))
    if (!(end > start)) return setError('Event must end after it starts.')
    setError('')
    setEvents([...events, { id: crypto.randomUUID(), title: String(f.get('title')).trim() || 'Event', start, end }])
    e.currentTarget.reset()
  }

  const timeline = [
    ...events.map((ev) => ({ key: ev.id, start: ev.start, end: ev.end, title: ev.title, fixed: true, del: () => setEvents(events.filter((x) => x.id !== ev.id)) })),
    ...plan.blocks.map((b) => ({ key: b.taskId, start: b.start, end: b.end, title: byId.get(b.taskId)!.title, fixed: false, del: () => setTasks(tasks.filter((x) => x.id !== b.taskId)) })),
  ].sort((a, b) => a.start - b.start)

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1>Tempo</h1>
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      <form onSubmit={addTask} aria-label="Add task" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <input name="title" placeholder="Task" aria-label="Task title" />
        <input name="category" placeholder="Category" aria-label="Category" />
        <select name="estimate" aria-label="Estimate" defaultValue={30}>{ESTIMATES.map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        <select name="priority" aria-label="Priority" defaultValue={2}>
          <option value={1}>High</option><option value={2}>Normal</option><option value={3}>Low</option>
        </select>
        <button type="submit">Add task</button>
      </form>
      <form onSubmit={addEvent} aria-label="Add event" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input name="title" placeholder="Fixed event" aria-label="Event title" />
        <input name="start" type="time" required defaultValue="10:00" aria-label="Event start" />
        <input name="end" type="time" required defaultValue="11:00" aria-label="Event end" />
        <button type="submit">Add event</button>
      </form>
      <h2>Today ({fmt(DAY_START)}–{fmt(DAY_END)})</h2>
      <ol aria-label="Timeline">
        {timeline.map((b) => (
          <li key={b.key}>
            {fmt(b.start)}–{fmt(b.end)} {b.title}{b.fixed ? ' (fixed)' : ''}{' '}
            <button onClick={b.del} aria-label={`Remove ${b.title}`}>×</button>
          </li>
        ))}
      </ol>
      {plan.overflow.length > 0 && (
        <section aria-label="Overflow">
          <h2>Overflow (doesn't fit today)</h2>
          <ul>{plan.overflow.map((t) => (
            <li key={t.id}>{t.title} · {t.estimate} min{' '}
              <button onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))} aria-label={`Remove ${t.title}`}>×</button></li>
          ))}</ul>
        </section>
      )}
    </main>
  )
}
