import { useEffect, useRef, useState } from 'react'
import type { PlanTask } from '../core/plan'
import { spentMs } from '../core/day'
import { shortcutFor } from './keys'
import type { TimerState } from '../core/timer'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  head: PlanTask | undefined
  timer: TimerState | null
  nowMs: number
  /** False when the first task doesn't fit in today's remaining time. */
  canStart: boolean
  onToggle: () => void
  onExtend: (minutes: number) => void
  onDone: () => string | undefined
  onStuck: () => void
}

export function Focus({ head, timer, nowMs, canStart, onToggle, onExtend, onDone, onStuck }: Props) {
  const [after, setAfter] = useState<{ reward?: string } | null>(null)
  const [breakUntil, setBreakUntil] = useState<number | null>(null)
  const checkInRef = useRef<HTMLButtonElement>(null)
  const breakRef = useRef<HTMLDivElement>(null)

  const spent = spentMs(head, timer, nowMs)
  const remaining = head ? head.duration * 60_000 - spent : 0
  const started = Boolean(head && timer?.taskId === head.id)
  const checkIn = started && remaining <= 0

  useEffect(() => { if (checkIn) checkInRef.current?.focus() }, [checkIn])
  useEffect(() => { if (after) breakRef.current?.focus() }, [after])

  const finishWith = (fn: () => string | undefined | void) => setAfter({ reward: fn() ?? undefined })

  // Keyboard-only flow: Space start/pause, D done, E +15 min (see shortcutFor for when each applies).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null
      if (e.key === 'Escape' && t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) { t.blur(); return } // leave a field so shortcuts work again
      const action = shortcutFor(
        { key: e.key, code: e.code, tag: t?.tagName ?? 'BODY', editable: Boolean(t?.isContentEditable), repeat: e.repeat, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey },
        { hasHead: Boolean(head), started, canStart, checkIn },
      )
      if (!action) return
      e.preventDefault()
      if (action === 'toggle') onToggle()
      else if (action === 'done') finishWith(onDone)
      else onExtend(15)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const startBreak = (min: number) => { setBreakUntil(Date.now() + min * 60_000); setAfter(null) }
  const breakLeft = breakUntil === null ? 0 : breakUntil - nowMs
  const onBreak = breakUntil !== null && breakLeft > 0

  return (
    <section aria-labelledby="focus-h">
      <h2 id="focus-h">Focus</h2>

      {after && (
        <div className="panel" role="region" aria-label="Break" ref={breakRef} tabIndex={-1}>
          {after.reward && <p className="reward" role="status">Reward time: <strong>{after.reward}</strong></p>}
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

      <p className="muted hint"><kbd>Space</kbd> start/pause · <kbd>D</kbd> done · <kbd>E</kbd> +15 min</p>
      {!head ? <p className="muted">No task to focus on. Add one in the plan.</p> : (
        <div>
          <p className="current">{head.title} <span className="muted">({head.category})</span></p>
          <p className="big" aria-label="Time left in block">{mmss(remaining)}</p>
          <p className="muted">Time on task: <strong>{mmss(spent)}</strong> · block {head.duration} min{head.extended ? ` (+${head.extended})` : ''}</p>
          {!checkIn && (started || canStart) && (
            <button onClick={onToggle}>{!started ? 'Start' : timer?.running ? 'Pause' : 'Resume'}</button>
          )}
          {!checkIn && !started && !canStart && <p className="warn" role="status">This doesn't fit in what's left of today. Remove or shorten something.</p>}
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
