import { categoryMultiplier, type SessionLog } from './estimates'

export interface DatedSession extends SessionLog { date: string }
export interface CategoryStat { category: string; sessions: number; /** sessions usable for learning (positive finite estimate and actual) */ usable: number; avgEstimate: number; avgActual: number; ratio: number | null }

const norm = (c: string) => c.trim().toLowerCase()
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000
const round1 = (n: number) => Math.round(n * 10) / 10

/** Estimate-vs-actual per category (names merged ignoring case/whitespace), most-used first. ratio = median(actual/estimate) once n >= 3. */
export function categoryStats(log: DatedSession[]): CategoryStat[] {
  const groups = new Map<string, DatedSession[]>()
  for (const l of log) {
    const k = norm(l.category)
    const g = groups.get(k)
    if (g) g.push(l)
    else groups.set(k, [l])
  }
  return [...groups.entries()]
    .map(([category, items]) => ({
      category,
      sessions: items.length,
      usable: items.filter((l) => Number.isFinite(l.estimate) && Number.isFinite(l.actual) && l.estimate > 0 && l.actual > 0).length,
      avgEstimate: round1(items.reduce((a, l) => a + l.estimate, 0) / items.length),
      avgActual: round1(items.reduce((a, l) => a + l.actual, 0) / items.length),
      ratio: categoryMultiplier(items, category),
    }))
    .sort((a, b) => b.sessions - a.sessions || a.category.localeCompare(b.category))
}

/** Focus minutes (sum of actual) per date, oldest first. */
export function focusMinutesByDay(log: DatedSession[]): { date: string; minutes: number }[] {
  const byDay = new Map<string, number>()
  for (const l of log) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.actual)
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, minutes]) => ({ date, minutes }))
}

/** Consecutive days with at least one focused session, ending today (or yesterday if nothing is logged yet today). */
export function streakDays(log: DatedSession[], today: string): number {
  const days = new Set(log.filter((l) => l.actual > 0).map((l) => dayNumber(l.date)))
  let n = dayNumber(today)
  if (!days.has(n)) n -= 1
  let streak = 0
  while (days.has(n)) { streak++; n-- }
  return streak
}
