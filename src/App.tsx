import { extend, finish, stuck, toggleTimer } from './core/day'
import { Focus } from './ui/Focus'
import { Plan } from './ui/Plan'
import { useTempo } from './ui/useTempo'

export default function App() {
  const t = useTempo()
  const { state } = t

  const onDone = () => {
    let reward: string | undefined
    t.apply((s) => { const r = finish(s, Date.now()); reward = r.reward; return r.state })
    return reward
  }

  return (
    <main>
      <h1>Tempo</h1>
      {t.error && <p className="warn" role="alert">{t.error}</p>}
      {!t.ready ? <p className="muted">Loading…</p> : (
        <div className="layout">
          <Focus
            head={state.tasks[0]} timer={state.timer} nowMs={t.nowMs}
            onToggle={() => t.apply((s) => toggleTimer(s, Date.now()))}
            onExtend={(m) => t.apply((s) => extend(s, m))}
            onDone={onDone}
            onStuck={() => t.apply(stuck)}
          />
          <Plan
            tasks={state.tasks} events={t.events} nowMinute={t.nowMinute} importErrors={t.importErrors}
            onAdd={t.addTask} onRemove={t.removeTask} onImport={(f) => void t.importIcs(f)}
          />
        </div>
      )}
    </main>
  )
}
