import { extend, finish, stuck, toggleTimer } from './core/day'
import { DEFAULT_DAY, planDay } from './core/plan'
import { useState } from 'react'
import { Focus } from './ui/Focus'
import { Plan } from './ui/Plan'
import { Stats } from './ui/Stats'
import { useTempo } from './ui/useTempo'

export default function App() {
  const t = useTempo()
  const [tab, setTab] = useState<'today' | 'stats'>('today')
  const { state } = t
  const plan = planDay(state.tasks, t.events, DEFAULT_DAY, t.nowMinute)
  const head = state.tasks[0]
  const canStart = !head || head.startMinute !== undefined || plan.placed[0]?.id === head.id

  const onDone = () => {
    let reward: string | undefined
    t.apply((s) => { const r = finish(s, Date.now()); reward = r.reward; return r.state })
    return reward
  }

  return (
    <main>
      <h1>Tempo</h1>
      <nav className="tabs" aria-label="Views">
        <button className={tab === 'today' ? '' : 'secondary'} aria-current={tab === 'today' ? 'page' : undefined} onClick={() => setTab('today')}>Today</button>
        <button className={tab === 'stats' ? '' : 'secondary'} aria-current={tab === 'stats' ? 'page' : undefined} onClick={() => setTab('stats')}>Stats</button>
      </nav>
      {t.error && <p className="warn" role="alert">{t.error}</p>}
      {!t.ready ? <p className="muted">Loading…</p> : tab === 'stats' ? <Stats sessions={state.sessions} nowMs={t.nowMs} /> : (
        <div className="layout">
          <Focus
            head={state.tasks[0]} timer={state.timer} nowMs={t.nowMs} canStart={canStart}
            onToggle={() => t.apply((s) => toggleTimer(s, Date.now()))}
            onExtend={(m) => t.apply((s) => extend(s, m, Date.now()))}
            onDone={onDone}
            onStuck={() => t.apply(stuck)}
          />
          <Plan
            plan={plan} sessions={state.sessions} importErrors={t.importErrors}
            onAdd={t.addTask} onRemove={t.removeTask} onImport={(f) => void t.importIcs(f)}
          />
        </div>
      )}
    </main>
  )
}
