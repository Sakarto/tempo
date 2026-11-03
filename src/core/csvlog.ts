export interface LoggedSession {
  date: string; task: string; category: string
  estimate: number; actual: number; extended: number
  distracted: boolean; energy: number | null; note: string
}
export interface TimeLogResult { sessions: LoggedSession[]; errors: { line: number; message: string }[] }

export const TIME_LOG_HEADER = ['date', 'task', 'category', 'estimate_min', 'actual_min', 'extended_min', 'distracted', 'energy_1to5', 'note']

// A quoted field whose next line looks like a new record ("2026-01-01,") is treated as an unterminated quote.
const ROW_START = /\d{4}-\d{2}-\d{2},/y
const MAX_QUOTED = 5000 // a quoted field longer than this is treated as an unterminated quote (bounds rescans)

/**
 * RFC 4180-style records with the line each starts on. Quoted fields may contain commas, quotes and newlines.
 * A quote only opens a field at its start and only closes when followed by , or end of line; otherwise it is literal.
 * An unterminated quote yields a marker record, then parsing resumes on the line after it so later rows still import.
 */
function records(text: string): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let quoteStart = 0
  let line = 1
  let startLine = 1
  let recordStart = 0
  const endRecord = () => {
    cells.push(cell)
    if (cells.length > 1 || cells[0].trim() !== '') out.push({ line: startLine, cells })
    cells = []; cell = ''
  }
  let i = 0
  const run = () => {
    for (; i < text.length; i++) {
      const c = text[i]
      if (quoted) {
        const next = text[i + 1]
        if (c === '"' && next === '"') { cell += '"'; i++ }
        else if (c === '"' && (next === undefined || next === ',' || next === '\n' || next === '\r')) quoted = false
        else {
          if (c === '\n') {
            ROW_START.lastIndex = i + 1
            if (ROW_START.test(text)) { i = restart(); continue }
            line++
          }
          cell += c
          if (i - quoteStart > MAX_QUOTED) i = restart()
        }
      } else if (c === '"' && cell === '') { quoted = true; quoteStart = i }
      else if (c === ',') { cells.push(cell); cell = '' }
      else if (c === '\r') continue
      else if (c === '\n') { endRecord(); line++; startLine = line; recordStart = i + 1 }
      else cell += c
    }
  }
  run()
  while (quoted) { i = restart() + 1; run() }
  endRecord()
  return out

  /** Report the open quote and resume at the line after the record start; returns the index to continue from. */
  function restart(): number {
    out.push({ line: startLine, cells: ['\0unterminated'] })
    const nl = text.indexOf('\n', recordStart)
    quoted = false; cells = []; cell = ''
    if (nl < 0) { recordStart = text.length; return text.length }
    line = startLine + 1; startLine = line; recordStart = nl + 1
    return nl // loop's i++ moves to nl+1
  }
}

const nonNegInt = (s: string) => (/^\d+$/.test(s.trim()) && Number.isSafeInteger(Number(s)) ? Number(s) : null)

function validDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

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
    if (cells[0] === '\0unterminated') { fail('Unterminated quote; row skipped'); continue }
    if (cells.length !== TIME_LOG_HEADER.length) { fail(`Expected ${TIME_LOG_HEADER.length} columns, got ${cells.length}`); continue }
    const [date, task, category, est, act, ext, dist, en, note] = cells
    const estimate = nonNegInt(est)
    const actual = nonNegInt(act)
    const extended = ext.trim() === '' ? 0 : nonNegInt(ext)
    const d = dist.trim().toLowerCase()
    const energy = en.trim() === '' ? null : nonNegInt(en)
    if (!validDate(date.trim())) fail('Bad date (use YYYY-MM-DD)')
    else if (!task.trim()) fail('Missing task')
    else if (estimate === null || actual === null || extended === null) fail('estimate_min, actual_min and extended_min must be whole numbers >= 0')
    else if (!['yes', 'y', 'true', '1', 'no', 'n', 'false', '0', ''].includes(d)) fail('distracted must be yes/no')
    else if (energy !== null && (energy < 1 || energy > 5)) fail('energy_1to5 must be 1-5')
    else sessions.push({ date: date.trim(), task: task.trim(), category: category.trim(), estimate, actual, extended, distracted: ['yes', 'y', 'true', '1'].includes(d), energy, note })
  }
  return { sessions, errors }
}
