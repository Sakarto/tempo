import type { FixedEvent } from './scheduler'

/** errors = the file is bad, import nothing. warnings = some events were skipped on purpose, the rest import. */
export type IcsResult = { events: FixedEvent[]; errors: string[]; warnings: string[] }
type Prop = { prop: string; value: string }
type Raw = Record<string, Prop[]>

// shortcut: recurrence supports DAILY/WEEKLY (INTERVAL, BYDAY, UNTIL, COUNT, EXDATE) only; no RECURRENCE-ID overrides,
// no overnight recurring spill-over, DST drift of recurring instances ignored. Upgrade when real calendars need it.
const unescape = (s: string) => s.replace(/\\[nN]/g, ' ').replace(/\\([,;\\])/g, '$1')
const MAX_BYTES = 2_000_000
const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const midnightOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Offset (ms) of `tz` from UTC at instant `t`. Throws RangeError for unknown zones. */
function zoneOffset(tz: string, t: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]),
  )
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000
}

/** Stamp -> instant (as a Date), 'date' for all-day values, null when unreadable. Throws RangeError on unknown TZID. */
function parseStamp({ prop, value }: Prop): Date | 'date' | null {
  const v = value.trim()
  if (/^\d{8}$/.test(v)) return 'date'
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(v)
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map((x) => Number(x ?? 0))
  if (m[7]) return new Date(Date.UTC(y, mo - 1, d, h, mi, s))
  const tz = /TZID=([^;:]+)/i.exec(prop)?.[1]
  if (!tz) return new Date(y, mo - 1, d, h, mi, s) // floating = local
  const wall = Date.UTC(y, mo - 1, d, h, mi, s)
  let t = wall - zoneOffset(tz, wall)
  t = wall - zoneOffset(tz, t)
  return new Date(t)
}

function parseDuration(v: string): number | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim())
  if (!m) return null
  const [w, d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0))
  return (((w * 7 + d) * 24 + h) * 60 + mi) * 60_000 + s * 1000
}

/** Does the recurrence rule produce an instance on local date `day`? null = unsupported rule. */
function occursOn(rule: string, start: Date, day: Date, exdates: Set<number>): boolean | null {
  const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes())
  const r = Object.fromEntries(rule.split(';').map((kv) => kv.split('=') as [string, string]))
  if (r.FREQ !== 'DAILY' && r.FREQ !== 'WEEKLY') return null
  const interval = Math.max(1, Number(r.INTERVAL ?? 1) || 1)
  const days = Math.round((day.getTime() - midnightOf(start).getTime()) / 86_400_000)
  if (days < 0 || days > 3660) return days < 0 ? false : null
  const until = r.UNTIL ? parseStamp({ prop: '', value: r.UNTIL.length === 8 ? r.UNTIL : r.UNTIL }) : null
  const byday = r.BYDAY?.split(',').map((x) => x.slice(-2))
  const hit = (n: number) => {
    const d = new Date(midnightOf(start).getTime() + n * 86_400_000 + 12 * 3600_000)
    if (r.FREQ === 'DAILY') return n % interval === 0 && (!byday || byday.includes(DOW[d.getDay()]))
    const week = Math.floor((n + ((midnightOf(start).getDay() + 6) % 7)) / 7)
    return week % interval === 0 && (byday ?? [DOW[start.getDay()]]).includes(DOW[d.getDay()])
  }
  const untilDay = until instanceof Date ? Infinity : r.UNTIL && /^\d{8}$/.test(r.UNTIL) ? midnightOf(new Date(+r.UNTIL.slice(0, 4), +r.UNTIL.slice(4, 6) - 1, +r.UNTIL.slice(6, 8))).getTime() : Infinity
  if (until instanceof Date && candidate.getTime() > until.getTime()) return false
  if (day.getTime() > untilDay || exdates.has(day.getTime()) || !hit(days)) return false
  if (r.COUNT) {
    let seen = 0
    for (let n = 0; n <= days; n++) if (hit(n)) seen++
    return seen <= Number(r.COUNT)
  }
  return true
}

/** Events overlapping `day` (a local date), as wall-clock minutes since midnight clipped to [dayStart, dayEnd]. */
export function parseIcs(text: string, day: Date, dayStart: number, dayEnd: number): IcsResult {
  if (text.length > MAX_BYTES) return { events: [], errors: ['That file is too large (limit 2 MB).'], warnings: [] }
  if (!/BEGIN:VCALENDAR/i.test(text)) return { events: [], errors: ['This file is not an iCalendar (.ics) file.'], warnings: [] }
  const errors: string[] = []
  const warnings: string[] = []
  if (!/END:VCALENDAR/i.test(text)) errors.push('The file looks truncated (no END:VCALENDAR).')
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const events: FixedEvent[] = []
  const today = midnightOf(day)
  let cur: Raw | null = null
  let n = 0
  let inAlarm = false

  const finish = (c: Raw) => {
    const first = (k: string) => c[k]?.[0]
    const title = unescape(first('SUMMARY')?.value ?? '').trim() || 'Event'
    const label = `Event ${n} ("${title}")`
    if (first('STATUS')?.value.trim().toUpperCase() === 'CANCELLED') return
    try {
      const sp = first('DTSTART')
      const s = sp && parseStamp(sp)
      if (s === 'date') return // all-day events don't block time
      if (!s) return void errors.push(`${label} has an unreadable start time and was skipped.`)
      const ep = first('DTEND')
      const dur = first('DURATION') && parseDuration(first('DURATION')!.value)
      const e = ep ? parseStamp(ep) : new Date(s.getTime() + (dur || 3600_000))
      if (e === 'date' || !e || e <= s) return void errors.push(`${label} has an unreadable end time and was skipped.`)
      let a = s, b = e
      const rule = first('RRULE')?.value
      if (rule) {
        const ex = new Set<number>()
        for (const p of c.EXDATE ?? []) for (const v of p.value.split(',')) {
          const x = parseStamp({ prop: p.prop, value: v })
          if (x instanceof Date) ex.add(midnightOf(x).getTime())
          else if (x === 'date') ex.add(new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)).getTime())
        }
        const tz = /TZID=([^;:]+)/i.exec(sp!.prop)?.[1]
        if (tz && zoneOffset(tz, s.getTime()) !== -s.getTimezoneOffset() * 60_000)
          return void warnings.push(`${label} repeats in a different time zone than yours and was skipped.`)
        const hit = occursOn(rule, s, today, ex)
        if (hit === null) return void warnings.push(`${label} repeats in a way Tempo can't read yet, so it was skipped.`)
        if (!hit) return
        a = new Date(today.getFullYear(), today.getMonth(), today.getDate(), s.getHours(), s.getMinutes())
        b = new Date(a.getTime() + (e.getTime() - s.getTime()))
      }
      // wall-clock minutes on `today`; other days clip to the window
      const min = (d: Date, whenOtherDay: number, before: boolean) => {
        const dm = midnightOf(d).getTime()
        if (dm === today.getTime()) return d.getHours() * 60 + d.getMinutes()
        return (dm < today.getTime()) === before ? whenOtherDay : -1
      }
      const sm = min(a, dayStart, true)
      const em = min(b, dayEnd, false)
      if (sm < 0 || em < 0) return // starts after today or ended before today
      const start = Math.max(dayStart, sm)
      const end = Math.min(dayEnd, em)
      if (end > start) events.push({ id: crypto.randomUUID(), title, start, end })
    } catch (err) {
      if (err instanceof RangeError) warnings.push(`${label} uses an unknown time zone and was skipped.`)
      else errors.push(`${label} could not be read and was skipped.`)
    }
  }

  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) {
      if (cur) errors.push(`Event ${n} is missing END:VEVENT and was skipped.`)
      cur = {}; n++; continue
    }
    if (/^END:VEVENT/i.test(line)) { if (cur) finish(cur); cur = null; continue }
    if (/^BEGIN:VALARM/i.test(line)) { inAlarm = true; continue }
    if (/^END:VALARM/i.test(line)) { inAlarm = false; continue }
    if (!cur || inAlarm) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    const prop = line.slice(0, i)
    const key = prop.split(';')[0].toUpperCase()
    ;(cur[key] ??= []).push({ prop, value: line.slice(i + 1) })
  }
  if (cur) errors.push(`Event ${n} is missing END:VEVENT and was skipped.`)
  return { events: errors.length ? [] : events.sort((x, y) => x.start - y.start), errors, warnings }
}
