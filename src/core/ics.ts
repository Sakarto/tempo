import type { FixedEvent } from './scheduler'

export interface IcsResult { events: FixedEvent[]; errors: string[] }

const DT = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/

/** Local [date, minutes since midnight] for an iCal date-time. Floating and TZID times are taken as written; Z is converted to local. */
function parseDateTime(value: string): { date: string; minute: number; dayStart: number } | null {
  const m = DT.exec(value)
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number)
  const when = m[7] ? new Date(Date.UTC(y, mo - 1, d, h, mi, s)) : new Date(y, mo - 1, d, h, mi, s)
  if (Number.isNaN(when.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`
  return { date, minute: when.getHours() * 60 + when.getMinutes(), dayStart: new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime() }
}

const unescapeText = (s: string) => s.replace(/\\([,;nN\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? ' ' : c))

/** Events of the .ics that fall on `date` (YYYY-MM-DD), clamped to that day. All-day events are skipped. */
export function parseIcs(text: string, date: string): IcsResult {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const events: FixedEvent[] = []
  const errors: string[] = []
  let cur: Record<string, string> | null = null
  let count = 0
  const dayStart = new Date(`${date}T00:00:00`).getTime()
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; count++; continue }
    if (line === 'END:VEVENT' && cur) {
      const fields = cur
      cur = null
      const id = fields.UID ?? `event-${count}`
      if (fields['DTSTART;VALUE'] === 'DATE' || /^\d{8}$/.test(fields.DTSTART ?? '')) continue
      const s = parseDateTime(fields.DTSTART ?? '')
      const e = parseDateTime(fields.DTEND ?? '')
      if (!s || !e) { errors.push(`Event ${id}: unreadable DTSTART/DTEND`); continue }
      const start = Math.round((s.dayStart - dayStart) / 86_400_000) * 1440 + s.minute
      const end = Math.round((e.dayStart - dayStart) / 86_400_000) * 1440 + e.minute
      const clampedStart = Math.max(start, 0)
      const clampedEnd = Math.min(end, 1440)
      if (clampedEnd <= clampedStart) continue
      events.push({ id, title: unescapeText(fields.SUMMARY ?? '(no title)'), start: clampedStart, end: clampedEnd })
      continue
    }
    if (!cur) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const [name, ...params] = line.slice(0, colon).split(';')
    const key = name.toUpperCase()
    if (key === 'DTSTART' || key === 'DTEND') {
      cur[key] = line.slice(colon + 1)
      if (params.some((p) => p.toUpperCase() === 'VALUE=DATE')) cur[`${key};VALUE`] = 'DATE'
    } else if (key === 'UID' || key === 'SUMMARY') cur[key] = line.slice(colon + 1)
  }
  if (count === 0) return { events: [], errors: ['No VEVENT found'] }
  return { events, errors }
}
