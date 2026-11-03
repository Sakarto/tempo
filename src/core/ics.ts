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
  const probe = m[7] ? new Date(Date.UTC(y, mo - 1, d)) : new Date(y, mo - 1, d)
  if ((m[7] ? probe.getUTCMonth() : probe.getMonth()) !== mo - 1 || mo < 1 || h > 23 || mi > 59 || s > 59) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`
  return { date, minute: when.getHours() * 60 + when.getMinutes(), dayStart: new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime() }
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i

const unescapeText = (s: string) => s.replace(/\\([,;nN\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? ' ' : c))

/** Events of the .ics that fall on `date` (YYYY-MM-DD), clamped to that day. All-day events are skipped. */
export function parseIcs(text: string, date: string): IcsResult {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const events: FixedEvent[] = []
  const errors: string[] = []
  let cur: Record<string, string> | null = null
  let depth = 0 // nested components (VALARM, ...) inside a VEVENT; their properties are ignored
  let count = 0
  const seen = new Set<string>()
  const parsed = DATE.exec(date)
  const check = parsed && new Date(Number(parsed[1]), Number(parsed[2]) - 1, Number(parsed[3]))
  if (!check || check.getMonth() !== Number(parsed[2]) - 1) return { events: [], errors: [`Invalid date: ${date}`] }
  const dayStart = check.getTime()
  for (const raw of lines) {
    const line = raw.trim()
    const upper = line.toUpperCase()
    if (upper === 'BEGIN:VEVENT') { cur = {}; depth = 0; count++; continue }
    if (cur && upper.startsWith('BEGIN:')) { depth++; continue }
    if (cur && depth > 0) { if (upper.startsWith('END:')) depth--; continue }
    if (upper === 'END:VEVENT' && cur) {
      const fields = cur
      cur = null
      let id = fields.UID ?? `event-${count}`
      if (fields.RRULE !== undefined) { errors.push(`Recurring event ${id} not expanded; add its occurrence manually`); continue }
      if ((fields.STATUS ?? '').toUpperCase() === 'CANCELLED') continue
      if (fields['DTSTART;VALUE'] === 'DATE' || /^\d{8}$/.test(fields.DTSTART ?? '')) continue
      const s = parseDateTime(fields.DTSTART ?? '')
      let e = parseDateTime(fields.DTEND ?? '')
      const dur = DURATION.exec(fields.DURATION ?? '')
      if (s && !e && dur) {
        const total = Number(dur[1] ?? 0) * 1440 + Number(dur[2] ?? 0) * 60 + Number(dur[3] ?? 0)
        const endDate = new Date(s.dayStart + (s.minute + total) * 60_000)
        e = { date: '', minute: endDate.getHours() * 60 + endDate.getMinutes(), dayStart: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime() }
      }
      if (!s || !e) { errors.push(`Event ${id}: unreadable DTSTART/DTEND`); continue }
      const start = Math.round((s.dayStart - dayStart) / 86_400_000) * 1440 + s.minute
      const end = Math.round((e.dayStart - dayStart) / 86_400_000) * 1440 + e.minute
      const clampedStart = Math.max(start, 0)
      const clampedEnd = Math.min(end, 1440)
      if (clampedEnd <= clampedStart) continue
      if (seen.has(id)) id = `${id}@${clampedStart}`
      seen.add(id)
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
    } else if (key === 'RRULE') cur.RRULE = line.slice(colon + 1)
    else if (key === 'UID' || key === 'SUMMARY' || key === 'STATUS' || key === 'DURATION') cur[key] = line.slice(colon + 1)
  }
  if (count === 0) return { events: [], errors: ['No VEVENT found'] }
  return { events, errors }
}
