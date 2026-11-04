import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { parseIcs } from './core/ics'
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
  const [notice, setNotice] = useState('')
  const [fatal, setFatal] = useState('')

  useEffect(() => {
    loadState().then((s) => { setTasks(s.tasks); setEvents(s.events); setLoaded(true) })
      .catch((e: unknown) => setFatal(`Could not load your plan (${String(e)}). Nothing will be saved until this is fixed.`))
  }, [])
  useEffect(() => {
    if (loaded) saveState({ tasks, events }).catch((e: unknown) => setError(`Could not save your plan (${String(e)}). Changes may be lost on reload.`))
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
    if (start < DAY_START || end > DAY_END) return setError(`Events must be within ${fmt(DAY_START)}–${fmt(DAY_END)}.`)
    setError('')
    setEvents([...events, { id: crypto.randomUUID(), title: String(f.get('title')).trim() || 'Event', start, end }])
    e.currentTarget.reset()
  }

  async function importIcs(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNotice('')
    const r = parseIcs(await file.text(), new Date(), DAY_START, DAY_END)
    setError([...r.errors, ...r.warnings].join(' '))
    if (r.errors.length > 0) return // bad file: change nothing
    const dupe = (a: FixedEvent, b: FixedEvent) => a.title === b.title && a.start === b.start && a.end === b.end
    const fresh = r.events.filter((n) => !events.some((x) => dupe(x, n)))
    setNotice(fresh.length === 0 && r.events.length === 0 ? 'No events for today in this file.'
      : `Imported ${fresh.length} event${fresh.length === 1 ? '' : 's'} for today${r.events.length > fresh.length ? ` (${r.events.length - fresh.length} already there)` : ''}.`)
    setEvents((prev) => [...prev, ...fresh.filter((n) => !prev.some((x) => dupe(x, n)))])
  }

  const timeline = [
    ...events.map((ev) => ({ key: ev.id, start: ev.start, end: ev.end, title: ev.title, fixed: true, del: () => setEvents(events.filter((x) => x.id !== ev.id)) })),
    ...plan.blocks.map((b) => ({ key: b.taskId, start: b.start, end: b.end, title: `${byId.get(b.taskId)!.title} · ${byId.get(b.taskId)!.category}`, fixed: false, del: () => setTasks(tasks.filter((x) => x.id !== b.taskId)) })),
  ].sort((a, b) => a.start - b.start)

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 16, minWidth: 0, overflowWrap: 'anywhere' }}>
      <h1>Tempo</h1>
      {fatal && <p role="alert" style={{ color: 'crimson' }}>{fatal}</p>}
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      <form onSubmit={addTask} aria-label="Add task" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <input name="title" placeholder="Task" aria-label="Task title" maxLength={80} style={{ flex: '1 1 120px', minWidth: 0 }} />
        <input name="category" placeholder="Category" aria-label="Category" maxLength={40} style={{ flex: '1 1 100px', minWidth: 0 }} />
        <select name="estimate" aria-label="Estimate" defaultValue={30}>{ESTIMATES.map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        <select name="priority" aria-label="Priority" defaultValue={2}>
          <option value={1}>High</option><option value={2}>Normal</option><option value={3}>Low</option>
        </select>
        <button type="submit">Add task</button>
      </form>
      <form onSubmit={addEvent} aria-label="Add event" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input name="title" placeholder="Fixed event" aria-label="Event title" maxLength={80} style={{ flex: '1 1 120px', minWidth: 0 }} />
        <input name="start" type="time" required defaultValue="10:00" aria-label="Event start" />
        <input name="end" type="time" required defaultValue="11:00" aria-label="Event end" />
        <button type="submit">Add event</button>
      </form>
      <label>Import calendar (.ics) <input type="file" accept=".ics,text/calendar" onChange={importIcs} aria-label="Import .ics" /></label>
      {notice && <p role="status">{notice}</p>}
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
            <li key={t.id}>{t.title} · {t.category} · {t.estimate} min{' '}
              <button onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))} aria-label={`Remove ${t.title}`}>×</button></li>
          ))}</ul>
        </section>
      )}
    </main>
  )
}
