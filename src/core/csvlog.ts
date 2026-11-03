export interface LoggedSession {
  date: string; task: string; category: string
  estimate: number; actual: number; extended: number
  distracted: boolean; energy: number | null; note: string
}
export interface TimeLogResult { sessions: LoggedSession[]; errors: { line: number; message: string }[] }

export const TIME_LOG_HEADER = ['date', 'task', 'category', 'estimate_min', 'actual_min', 'extended_min', 'distracted', 'energy_1to5', 'note']

/** RFC 4180-style records with the line each starts on. Quoted fields may contain commas, quotes and newlines. */
function records(text: string): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let startLine = 1
  const endRecord = () => {
    cells.push(cell)
    if (cells.length > 1 || cells[0].trim() !== '') out.push({ line: startLine, cells })
    cells = []; cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else { if (c === '\n') line++; cell += c }
    } else if (c === '"') quoted = true
    else if (c === ',') { cells.push(cell); cell = '' }
    else if (c === '\r') continue
    else if (c === '\n') { endRecord(); line++; startLine = line }
    else cell += c
  }
  endRecord()
  return out
}

const nonNegInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : null)

export function parseTimeLog(text: string): TimeLogResult {
  const recs = records(text.replace(/^﻿/, ''))
  const errors: TimeLogResult['errors'] = []
  const sessions: LoggedSession[] = []
  const header = recs[0]?.cells.map((c) => c.trim())
  if (!header || header.join(',') !== TIME_LOG_HEADER.join(',')) {
    return { sessions, errors: [{ line: recs[0]?.line ?? 1, message: `Header must be: ${TIME_LOG_HEADER.join(',')}` }] }
  }
  for (const { line, cells } of recs.slice(1)) {
    const fail = (message: string) => errors.push({ line, message })
    if (cells.length !== TIME_LOG_HEADER.length) { fail(`Expected ${TIME_LOG_HEADER.length} columns, got ${cells.length}`); continue }
    const [date, task, category, est, act, ext, dist, en, note] = cells
    const estimate = nonNegInt(est)
    const actual = nonNegInt(act)
    const extended = ext.trim() === '' ? 0 : nonNegInt(ext)
    const d = dist.trim().toLowerCase()
    const energy = en.trim() === '' ? null : nonNegInt(en)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim()) || Number.isNaN(new Date(date.trim()).getTime())) fail('Bad date (use YYYY-MM-DD)')
    else if (!task.trim()) fail('Missing task')
    else if (estimate === null || actual === null || extended === null) fail('estimate_min, actual_min and extended_min must be whole numbers >= 0')
    else if (!['yes', 'y', 'true', '1', 'no', 'n', 'false', '0', ''].includes(d)) fail('distracted must be yes/no')
    else if (energy !== null && (energy < 1 || energy > 5)) fail('energy_1to5 must be 1-5')
    else sessions.push({ date: date.trim(), task: task.trim(), category: category.trim(), estimate, actual, extended, distracted: ['yes', 'y', 'true', '1'].includes(d), energy, note })
  }
  return { sessions, errors }
}
