import type { FixedEvent } from './scheduler'

export type IcsResult = { events: FixedEvent[]; errors: string[] }

// shortcut: RRULE recurrences are not expanded and TZID is treated as local time; upgrade when real calendars need it.
const unescape = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1')

function parseStamp(prop: string, value: string): Date | 'date' | null {
  if (/VALUE=DATE(?!-)/.test(prop) && !/T/.test(value)) return 'date'
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(value.trim())
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map((x) => Number(x ?? 0))
  return m[7] ? new Date(Date.UTC(y, mo - 1, d, h, mi, s)) : new Date(y, mo - 1, d, h, mi, s)
}

/** Events overlapping `day` (a local date), as minutes since midnight clipped to [dayStart, dayEnd]. */
export function parseIcs(text: string, day: Date, dayStart: number, dayEnd: number): IcsResult {
  if (!/BEGIN:VCALENDAR/i.test(text)) return { events: [], errors: ['This file is not an iCalendar (.ics) file.'] }
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const events: FixedEvent[] = []
  const errors: string[] = []
  const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  let cur: Record<string, { prop: string; value: string }> | null = null
  let n = 0
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; n++; continue }
    if (/^END:VEVENT/i.test(line) && cur) {
      const c = cur
      cur = null
      const title = unescape(c.SUMMARY?.value ?? '').trim() || 'Event'
      const s = c.DTSTART && parseStamp(c.DTSTART.prop, c.DTSTART.value)
      if (s === 'date') continue // all-day events don't block time
      if (!s) { errors.push(`Event ${n} ("${title}") has an unreadable start time and was skipped.`); continue }
      const e = c.DTEND ? parseStamp(c.DTEND.prop, c.DTEND.value) : new Date(s.getTime() + 3600_000)
      if (e === 'date' || !e || e <= s) { errors.push(`Event ${n} ("${title}") has an unreadable end time and was skipped.`); continue }
      const start = Math.max(dayStart, Math.round((s.getTime() - midnight) / 60000))
      const end = Math.min(dayEnd, Math.round((e.getTime() - midnight) / 60000))
      if (end > start) events.push({ id: crypto.randomUUID(), title, start, end })
      continue
    }
    if (!cur) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    const prop = line.slice(0, i)
    cur[prop.split(';')[0].toUpperCase()] = { prop, value: line.slice(i + 1) }
  }
  return { events: events.sort((a, b) => a.start - b.start), errors }
}
