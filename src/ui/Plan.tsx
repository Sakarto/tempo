import { useState, type FormEvent } from 'react'
import type { Session } from '../core/day'
import { suggestEstimate } from '../core/estimates'
import type { Plan as DayPlan, PlanTask } from '../core/plan'

const BLOCKS = [15, 30, 60, 90]

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

interface Props {
  plan: DayPlan
  sessions: Session[]
  importErrors: string[]
  onAdd: (t: Omit<PlanTask, 'id'>) => void
  onRemove: (id: string) => void
  onImport: (file: File) => void
}

export function Plan({ plan, sessions, importErrors, onAdd, onRemove, onImport }: Props) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [duration, setDuration] = useState(30)
  const [reward, setReward] = useState('')
  // An accepted suggestion is already adjusted: remember it (so we don't adjust again) and the user's own estimate (so learning stays honest).
  const [accepted, setAccepted] = useState<{ value: number; raw: number } | null>(null)

  const suggestion = category.trim() ? suggestEstimate(sessions, category, duration) : null
  const showSuggestion = suggestion !== null && suggestion !== duration && duration !== accepted?.value
  const options = [...new Set([...BLOCKS, duration])].sort((a, b) => a - b) // the selected value must always be an option

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      title: title.trim(), category: category.trim() || 'general', duration,
      ...(accepted && accepted.value === duration ? { rawEstimate: accepted.raw } : {}),
      ...(reward.trim() ? { reward: reward.trim() } : {}),
    })
    setTitle(''); setReward(''); setAccepted(null)
  }

  const rows = [
    ...plan.placed.map((p) => ({ key: p.id, start: p.start, end: p.end, title: p.title, fixed: false, id: p.id })),
    ...plan.events.map((e) => ({ key: `ev-${e.id}`, start: e.start, end: e.end, title: e.title, fixed: true, id: e.id })),
  ].sort((a, b) => a.start - b.start)

  return (
    <section aria-labelledby="plan-h">
      <h2 id="plan-h">Plan today</h2>
      <form onSubmit={submit} className="add-form">
        <label>Task<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" required /></label>
        <label>Category<input value={category} onChange={(e) => { setCategory(e.target.value); setAccepted(null) }} placeholder="study" /></label>
        <label>Estimate
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {options.map((b) => <option key={b} value={b}>{b} min</option>)}
          </select>
        </label>
        {showSuggestion && (
          <p className="suggest" role="status">
            Your <strong>{category.trim()}</strong> tasks usually take {suggestion > duration ? 'longer' : 'less time'} than planned: suggest <strong>{suggestion} min</strong>.
            <button type="button" className="link" onClick={() => { setAccepted({ value: suggestion, raw: duration }); setDuration(suggestion) }}>Use {suggestion} min</button>
          </p>
        )}
        <label>Reward (optional)<input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="10 min YouTube" /></label>
        <button type="submit">Add task</button>
      </form>

      <label className="file">Import calendar (.ics)
        <input type="file" accept=".ics,text/calendar" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
      </label>
      {importErrors.length > 0 && <ul className="warn" role="status">{importErrors.map((m) => <li key={m}>{m}</li>)}</ul>}

      <h3>Timeline</h3>
      {rows.length === 0 ? <p className="muted">Nothing planned yet. Add a task above.</p> : (
        <ol className="timeline">
          {rows.map((r) => (
            <li key={r.key} className={r.fixed ? 'fixed' : 'task'}>
              <span className="time">{hhmm(r.start)}–{hhmm(r.end)}</span>
              <span className="title">{r.title}{r.fixed && <em> (fixed)</em>}</span>
              {!r.fixed && <button className="link" onClick={() => onRemove(r.id)} aria-label={`Remove ${r.title}`}>Remove</button>}
            </li>
          ))}
        </ol>
      )}

      {plan.overflow.length > 0 && (
        <div className="overflow" role="region" aria-label="Overflow">
          <h3>Overflow: doesn't fit today</h3>
          <ul>
            {plan.overflow.map((o) => (
              <li key={o.id}>{o.title} ({o.duration} min)
                <button className="link" onClick={() => onRemove(o.id)} aria-label={`Remove ${o.title}`}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
