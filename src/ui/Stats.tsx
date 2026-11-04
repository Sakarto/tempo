import { useMemo } from 'react'
import { dateOf } from '../core/day'
import { categoryStats, focusMinutesByDay, streakDays, type DatedSession } from '../core/stats'

interface Props { sessions: DatedSession[]; nowMs: number }

export function Stats({ sessions, nowMs }: Props) {
  const cats = useMemo(() => categoryStats(sessions), [sessions])
  const days = useMemo(() => focusMinutesByDay(sessions).slice(-14), [sessions])
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const streak = streakDays(sessions, dateOf(nowMs))

  if (sessions.length === 0) {
    return <section aria-labelledby="stats-h"><h2 id="stats-h">Stats</h2><p className="muted">Finish a task and your stats show up here.</p></section>
  }

  return (
    <section aria-labelledby="stats-h">
      <h2 id="stats-h">Stats</h2>
      <p className="streak"><strong>{streak}</strong> day streak</p>

      <h3>Estimate vs actual</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Category</th><th>Sessions</th><th>Avg estimate</th><th>Avg actual</th><th>Your ratio</th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.category}>
                <td>{c.category}</td><td>{c.sessions}</td><td>{c.avgEstimate} min</td><td>{c.avgActual} min</td>
                <td>{c.ratio === null ? <span className="muted">needs {3 - c.usable} more</span> : `×${Math.round(c.ratio * 100) / 100}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Focus minutes per day</h3>
      <ul className="bars" aria-label="Focus minutes per day">
        {days.map((d) => (
          <li key={d.date}>
            <span className="bar-date">{d.date.slice(5)}</span>
            <span className="bar" style={{ width: `${(d.minutes / max) * 100}%` }} aria-hidden="true" />
            <span className="bar-val">{d.minutes} min</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
