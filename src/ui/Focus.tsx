import { useEffect, useRef, useState } from 'react'
import type { PlanTask } from '../core/plan'
import { elapsedMs, type TimerState } from '../core/timer'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  head: PlanTask | undefined
  timer: TimerState | null
  nowMs: number
  onToggle: () => void
  onExtend: (minutes: number) => void
  onDone: () => string | undefined
  onStuck: () => void
}

export function Focus({ head, timer, nowMs, onToggle, onExtend, onDone, onStuck }: Props) {
  const [after, setAfter] = useState<{ reward?: string } | null>(null)
  const [breakUntil, setBreakUntil] = useState<number | null>(null)
  const checkInRef = useRef<HTMLButtonElement>(null)

  const spent = head && timer?.taskId === head.id ? elapsedMs(timer, nowMs) : 0
  const remaining = head ? head.duration * 60_000 - spent : 0
  const started = Boolean(head && timer?.taskId === head.id)
  const checkIn = started && remaining <= 0

  useEffect(() => { if (checkIn) checkInRef.current?.focus() }, [checkIn])

  const finishWith = (fn: () => string | undefined | void) => setAfter({ reward: fn() ?? undefined })
  const startBreak = (min: number) => { setBreakUntil(Date.now() + min * 60_000); setAfter(null) }
  const breakLeft = breakUntil === null ? 0 : breakUntil - nowMs
  const onBreak = breakUntil !== null && breakLeft > 0

  return (
    <section aria-labelledby="focus-h">
      <h2 id="focus-h">Focus</h2>

      {after && (
        <div className="panel" role="region" aria-label="Break">
          {after.reward && <p className="reward">Reward time: <strong>{after.reward}</strong></p>}
          <p>Take a break?</p>
          <div className="row">
            <button onClick={() => startBreak(5)}>Break 5 min</button>
            <button onClick={() => startBreak(10)}>Break 10 min</button>
            <button className="secondary" onClick={() => setAfter(null)}>Skip break</button>
          </div>
        </div>
      )}

      {onBreak && (
        <div className="panel" role="timer" aria-label="Break countdown">
          <p>On break: <strong>{mmss(breakLeft)}</strong></p>
          <button className="secondary" onClick={() => setBreakUntil(null)}>End break</button>
        </div>
      )}

      {!head ? <p className="muted">No task to focus on. Add one in the plan.</p> : (
        <div>
          <p className="current">{head.title} <span className="muted">({head.category})</span></p>
          <p className="big" aria-label="Time left in block">{mmss(remaining)}</p>
          <p className="muted">Time on task: <strong>{mmss(spent)}</strong> · block {head.duration} min{head.extended ? ` (+${head.extended})` : ''}</p>
          {!checkIn && (
            <button onClick={onToggle}>{!started ? 'Start' : timer?.running ? 'Pause' : 'Resume'}</button>
          )}
          {checkIn && (
            <div className="panel" role="alertdialog" aria-labelledby="ci-h">
              <h3 id="ci-h">Block finished: how did it go?</h3>
              <div className="row">
                <button ref={checkInRef} onClick={() => finishWith(onDone)}>Done</button>
                <button onClick={() => onExtend(15)}>+15 min</button>
                <button onClick={() => onExtend(30)}>+30 min</button>
                <button className="secondary" onClick={() => { onStuck(); finishWith(() => undefined) }}>Stuck / switch</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
