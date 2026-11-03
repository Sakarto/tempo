export interface SessionLog { category: string; estimate: number; actual: number }

const MIN_SESSIONS = 3
const BLOCK = 15

/** Median of actual/estimate for the category, or null with fewer than 3 usable sessions. */
export function categoryMultiplier(log: SessionLog[], category: string): number | null {
  const ratios = log
    .filter((l) => l.category === category && l.estimate > 0 && l.actual > 0)
    .map((l) => l.actual / l.estimate)
    .sort((a, b) => a - b)
  if (ratios.length < MIN_SESSIONS) return null
  const mid = ratios.length >> 1
  return ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2
}

/** estimate × multiplier, snapped to the nearest 15-min block (min 15); null until there is enough history. */
export function suggestEstimate(log: SessionLog[], category: string, estimate: number): number | null {
  const m = categoryMultiplier(log, category)
  if (m === null) return null
  return Math.max(BLOCK, Math.round((estimate * m) / BLOCK) * BLOCK)
}
