export interface SessionLog { category: string; estimate: number; actual: number }

const MIN_SESSIONS = 3
const BLOCK = 15

/** Imported logs spell categories inconsistently ("Writing", "writing "); treat those as one. */
const norm = (c: string) => c.trim().toLowerCase()

/** Median of actual/estimate for the category, or null with fewer than 3 usable sessions. */
export function categoryMultiplier(log: SessionLog[], category: string): number | null {
  const ratios = log
    .filter((l) => norm(l.category) === norm(category) && Number.isFinite(l.estimate) && Number.isFinite(l.actual) && l.estimate > 0 && l.actual > 0)
    .map((l) => l.actual / l.estimate)
    .sort((a, b) => a - b)
  if (ratios.length < MIN_SESSIONS) return null
  const mid = ratios.length >> 1
  return ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2
}

/** estimate × multiplier, snapped to the nearest 15-min block (min 15); null until there is enough history. */
export function suggestEstimate(log: SessionLog[], category: string, estimate: number): number | null {
  if (!Number.isFinite(estimate) || estimate <= 0) return null
  const m = categoryMultiplier(log, category)
  if (m === null) return null
  const snapped = Math.max(BLOCK, Math.round((estimate * m) / BLOCK) * BLOCK)
  return Number.isFinite(snapped) ? snapped : null
}
