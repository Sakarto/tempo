/** Times are minutes since local midnight. */
export type Task = { id: string; title: string; category: string; estimate: number; priority: number; reward?: string }
export type FixedEvent = { id: string; title: string; start: number; end: number }
export type Block = { taskId: string; start: number; end: number }
export type Plan = { blocks: Block[]; overflow: Task[] }

type Input = { tasks: Task[]; events: FixedEvent[]; dayStart: number; dayEnd: number; from?: number }

/** Free gaps in [from, dayEnd] after removing (possibly overlapping, unsorted) events. */
function gaps(events: FixedEvent[], from: number, dayEnd: number): [number, number][] {
  const out: [number, number][] = []
  let cursor = from
  for (const e of [...events].sort((a, b) => a.start - b.start)) {
    if (e.end <= cursor) continue
    if (e.start > cursor) out.push([cursor, Math.min(e.start, dayEnd)])
    cursor = Math.max(cursor, e.end)
    if (cursor >= dayEnd) return out.filter(([a, b]) => b > a)
  }
  if (cursor < dayEnd) out.push([cursor, dayEnd])
  return out.filter(([a, b]) => b > a)
}

/** First-fit by priority (1 = highest, ties keep input order). Durations are never shrunk. */
export function schedule({ tasks, events, dayStart, dayEnd, from }: Input): Plan {
  const free = gaps(events, Number.isFinite(from) ? Math.max(dayStart, from!) : dayStart, dayEnd)
  const ordered = tasks.map((t, i) => ({ t, i })).sort((a, b) => a.t.priority - b.t.priority || a.i - b.i)
  const blocks: Block[] = []
  const overflow: Task[] = []
  for (const { t } of ordered) {
    if (!(t.estimate > 0)) { overflow.push(t); continue } // invalid estimate is never placed
    const g = free.find(([a, b]) => b - a >= t.estimate)
    if (!g) { overflow.push(t); continue }
    blocks.push({ taskId: t.id, start: g[0], end: g[0] + t.estimate })
    g[0] += t.estimate
  }
  return { blocks: blocks.sort((a, b) => a.start - b.start), overflow }
}
