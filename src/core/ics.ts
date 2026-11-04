// .ics import. Recurrence / TZID / all-or-nothing design ported from the parallel run (PR #7), then restructured after
// a fresh review: every recurrence instance is built in its own time zone and converted, so DST, UTC series,
// midnight-crossing series and overrides (RECURRENCE-ID) come out right.
import type { FixedEvent } from './scheduler'

/** errors = the file is bad, import nothing. warnings = some events were skipped on purpose, the rest import. */
export type IcsResult = { events: FixedEvent[]; errors: string[]; warnings: string[] }
type Prop = { prop: string; value: string }
type Raw = Record<string, Prop[]>
type Wall = { kind: 'date' | 'z' | 'tz' | 'floating'; y: number; mo: number; d: number; h: number; mi: number; s: number; tz?: string }
type Skip = { day: number; instant?: number }

// shortcut: recurrence supports DAILY/WEEKLY (INTERVAL, BYDAY, WKST, UNTIL, COUNT, EXDATE, RECURRENCE-ID overrides) only.
// Rules with other parts (BYMONTHDAY, BYSETPOS, ...) and FREQ=MONTHLY/YEARLY are skipped with a warning.
// RDATE/EXRULE and RANGE=THISANDFUTURE overrides are ignored with a warning. A timed event with a date-only DTEND is a file error (all-or-nothing).
// Windows zone names ("Eastern Standard Time") are unknown zones and skipped with a warning; upgrade by mapping to IANA.
const unescape = (s: string) => s.replace(/\\[nN]/g, ' ').replace(/\\([,;\\])/g, '$1')
const MAX_BYTES = 2_000_000
const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const DAY_MS = 86_400_000
const ALLOWED_RULE_PARTS = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'UNTIL', 'COUNT', 'WKST'])
const dayNumber = (y: number, mo: number, d: number) => Date.UTC(y, mo - 1, d) / DAY_MS
const dowOf = (n: number) => new Date(n * DAY_MS).getUTCDay()
const tzOf = (prop: string) => /TZID="?([^;:"]+)"?/i.exec(prop)?.[1]

/** Offset (ms) of `tz` from UTC at instant `t`. Throws RangeError for unknown zones. */
function zoneOffset(tz: string, t: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]),
  )
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000
}

/** Wall-clock fields of an iCal value (validated), or null when unreadable. */
function parseWall({ prop, value }: Prop): Wall | null {
  const v = value.trim()
  const dm = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(v)
  const g = dm ?? m
  if (!g) return null
  const [y, mo, d, h, mi, s] = [g[1], g[2], g[3], m?.[4] ?? '0', m?.[5] ?? '0', m?.[6] ?? '0'].map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate() || h > 23 || mi > 59 || s > 59) return null
  if (dm) return { kind: 'date', y, mo, d, h: 0, mi: 0, s: 0 }
  if (m![7]) return { kind: 'z', y, mo, d, h, mi, s }
  const tz = tzOf(prop)
  return tz ? { kind: 'tz', y, mo, d, h, mi, s, tz } : { kind: 'floating', y, mo, d, h, mi, s }
}

/** The instant a wall time denotes. Throws RangeError for an unknown TZID. */
function toInstant(w: Wall): number {
  if (w.kind === 'z') return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s)
  if (w.kind !== 'tz') return new Date(w.y, w.mo - 1, w.d, w.h, w.mi, w.s).getTime()
  const wall = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s)
  let t = wall - zoneOffset(w.tz!, wall)
  t = wall - zoneOffset(w.tz!, t)
  // Nonexistent local time (spring-forward gap): use the offset from before the transition, like floating times do.
  if (wall - t !== zoneOffset(w.tz!, t)) t = wall - zoneOffset(w.tz!, wall - DAY_MS)
  return t
}

function parseDuration(v: string): number | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim())
  if (!m) return null
  const [w, d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0))
  return (((w * 7 + d) * 24 + h) * 60 + mi) * 60_000 + s * 1000
}

/** Exclusions as instants (compared with each instance's instant), or whole days for date-only values. */
const skipKeys = (values: string, prop: string): Skip[] =>
  values.split(',').flatMap((v) => {
    const w = parseWall({ prop, value: v })
    if (!w) return []
    if (w.kind === 'date') return [{ day: dayNumber(w.y, w.mo, w.d) }]
    try { return [{ day: dayNumber(w.y, w.mo, w.d), instant: toInstant(w) }] } catch { return [] } // unknown zone: cannot match
  })

type Rule = Record<string, string>
const parseRule = (rule: string): Rule => Object.fromEntries(rule.split(';').map((kv) => kv.split('=') as [string, string]))

/** Validated rule as a predicate "instance on series-date N?" (days since epoch in the series' calendar), or null if unsupported. */
function compileRule(r: Rule, startDay: number): ((N: number) => boolean) | null {
  if (r.FREQ !== 'DAILY' && r.FREQ !== 'WEEKLY') return null
  if (Object.keys(r).some((k) => !ALLOWED_RULE_PARTS.has(k))) return null
  if (r.INTERVAL !== undefined && !(/^\d+$/.test(r.INTERVAL) && Number(r.INTERVAL) >= 1)) return null
  if (r.COUNT !== undefined && !(/^\d+$/.test(r.COUNT) && Number(r.COUNT) >= 1)) return null
  if (r.WKST !== undefined && !DOW.includes(r.WKST)) return null
  const byday = r.BYDAY?.split(',')
  if (byday?.some((x) => !DOW.includes(x))) return null
  const interval = Number(r.INTERVAL ?? 1)
  const days = new Set(byday ? byday.map((x) => DOW.indexOf(x)) : [dowOf(startDay)])
  const wkst = DOW.indexOf(r.WKST ?? 'MO')
  const startDow = dowOf(startDay)
  if (r.FREQ === 'DAILY') return (N) => N >= startDay && (N - startDay) % interval === 0 && (!byday || days.has(dowOf(N)))
  const offset = (startDow - wkst + 7) % 7
  return (N) => N >= startDay && Math.floor((N - startDay + offset) / 7) % interval === 0 && days.has(dowOf(N))
}

/** Events overlapping `day` (a local date), as wall-clock minutes since midnight clipped to [dayStart, dayEnd]. */
export function parseIcs(text: string, day: Date, dayStart: number, dayEnd: number): IcsResult {
  if (Number.isNaN(day.getTime())) return { events: [], errors: ['Invalid date.'], warnings: [] }
  if (text.length > MAX_BYTES) return { events: [], errors: ['That file is too large (limit 2 MB).'], warnings: [] }
  if (!/BEGIN:VCALENDAR/i.test(text)) return { events: [], errors: ['This file is not an iCalendar (.ics) file.'], warnings: [] }
  const errors: string[] = []
  const warnings: string[] = []
  if (!/END:VCALENDAR/i.test(text)) errors.push('The file looks truncated (no END:VCALENDAR).')
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n').map((l) => l.trimEnd())
  const events: FixedEvent[] = []
  const todayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const todayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
  const todayN = dayNumber(day.getFullYear(), day.getMonth() + 1, day.getDate())
  const seen = new Set<string>()
  const uniqueId = (uid: string | undefined) => {
    const base = uid?.trim() || 'event'
    let id = base
    for (let k = 1; seen.has(id); ) id = `${base}#${++k}`
    seen.add(id)
    return id
  }
  const minuteOf = (t: number) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes() }

  // Pass 1: split into raw events.
  const raws: { n: number; c: Raw }[] = []
  let cur: Raw | null = null
  let n = 0
  let inAlarm = false
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) {
      if (cur) errors.push(`Event ${n} is missing END:VEVENT and was skipped.`)
      cur = {}; n++; inAlarm = false; continue
    }
    if (/^END:VEVENT/i.test(line)) { if (cur) raws.push({ n, c: cur }); cur = null; inAlarm = false; continue }
    if (/^BEGIN:VALARM/i.test(line)) { inAlarm = true; continue }
    if (/^END:VALARM/i.test(line)) { inAlarm = false; continue }
    if (!cur || inAlarm) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    const prop = line.slice(0, i)
    ;(cur[prop.split(';')[0].toUpperCase()] ??= []).push({ prop, value: line.slice(i + 1) })
  }
  if (cur) errors.push(`Event ${n} is missing END:VEVENT and was skipped.`)

  // Overrides (RECURRENCE-ID) replace that instance of their series, including cancelled ones.
  const overridden = new Map<string, Skip[]>()
  for (const { c } of raws) {
    const rid = c['RECURRENCE-ID']?.[0]
    const uid = c.UID?.[0]?.value.trim()
    if (rid && /RANGE=THISANDFUTURE/i.test(rid.prop)) warnings.push(`Event "${unescape(c.SUMMARY?.[0]?.value ?? 'Event')}" changes this and all future repeats; Tempo applies it to one day only, so later days may be wrong.`)
    if (rid && uid) overridden.set(uid, [...(overridden.get(uid) ?? []), ...skipKeys(rid.value, rid.prop)])
  }

  const emit = (a: number, b: number, title: string, uid: string | undefined) => {
    if (!(a < todayEnd && b > todayStart)) return
    const start = Math.max(dayStart, a <= todayStart ? dayStart : minuteOf(a))
    const end = Math.min(dayEnd, b >= todayEnd ? dayEnd : minuteOf(b))
    if (end > start) events.push({ id: uniqueId(uid), title, start, end })
  }

  for (const { n: idx, c } of raws) {
    const first = (k: string) => c[k]?.[0]
    const title = unescape(first('SUMMARY')?.value ?? '').trim() || 'Event'
    const label = `Event ${idx} ("${title}")`
    if (first('STATUS')?.value.trim().toUpperCase() === 'CANCELLED') continue
    const uid = first('UID')?.value
    try {
      const sp = first('DTSTART')
      const w = sp && parseWall(sp)
      if (w && w.kind === 'date') continue // all-day events don't block time
      if (!w) { errors.push(`${label} has an unreadable start time and was skipped.`); continue }
      const s = toInstant(w)
      const ep = first('DTEND')
      const durProp = first('DURATION')
      const dur = durProp ? parseDuration(durProp.value) : 3_600_000
      const ew = ep ? parseWall(ep) : null
      const e = ep ? (ew && ew.kind !== 'date' ? toInstant(ew) : NaN) : dur === null ? NaN : s + dur
      if (Number.isNaN(e) || e < s) { errors.push(`${label} has an unreadable end time and was skipped.`); continue }
      if (e === s) continue // zero-length events block no time
      if (c.RDATE || c.EXRULE) warnings.push(`${label} uses RDATE/EXRULE, which Tempo ignores; some days may be wrong.`)
      const rule = first('RRULE')?.value
      if (!rule) { emit(s, e, title, uid); continue }

      const r = parseRule(rule)
      const startDay = dayNumber(w.y, w.mo, w.d)
      const hit = compileRule(r, startDay)
      const until = r.UNTIL ? parseWall({ prop: '', value: r.UNTIL }) : null
      if (!hit || (r.UNTIL && !until)) {
        warnings.push(`${label} repeats in a way Tempo can't read yet, so it was skipped.`)
        continue
      }
      const skips = [...(overridden.get(uid?.trim() ?? '') ?? []), ...(c.EXDATE ?? []).flatMap((p) => skipKeys(p.value, p.prop))]
      const durMs = e - s
      // TZID/floating ends are rebuilt per instance (DST nights differ in length); Z ends and DURATION use elapsed time.
      const endDays = ew && ew.kind !== 'z' && !durProp ? dayNumber(ew.y, ew.mo, ew.d) - startDay : null
      const span = Math.ceil(durMs / DAY_MS) + 1 // series-dates are in the series' zone, so look a little either side of today
      let count = 0
      // Without COUNT nothing depends on earlier instances, so only scan near today (the rule predicate is absolute).
      for (let N = r.COUNT ? startDay : Math.max(startDay, todayN - span); N <= todayN + 1; N++) {
        if (!hit(N)) continue
        count++
        if (r.COUNT && count > Number(r.COUNT)) break
        if (N < todayN - span) continue
        const inst: Wall = { ...w, ...(() => { const d = new Date(N * DAY_MS); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() } })() }
        const a = toInstant(inst)
        if (skips.some((k) => (k.instant !== undefined ? k.instant === a : k.day === N))) continue
        if (until) {
          if (until.kind === 'date' ? N > dayNumber(until.y, until.mo, until.d) : until.kind === 'z' ? a > toInstant(until) : Date.UTC(inst.y, inst.mo - 1, inst.d, inst.h, inst.mi, inst.s) > Date.UTC(until.y, until.mo - 1, until.d, until.h, until.mi, until.s)) break
        }
        let b = a + durMs
        if (endDays !== null && ew) {
          const ed = new Date((N + endDays) * DAY_MS)
          b = toInstant({ ...ew, y: ed.getUTCFullYear(), mo: ed.getUTCMonth() + 1, d: ed.getUTCDate() })
        }
        emit(a, b, title, uid)
      }
    } catch (err) {
      if (err instanceof RangeError) warnings.push(`${label} uses an unknown time zone and was skipped.`)
      else errors.push(`${label} could not be read and was skipped.`)
    }
  }
  return { events: errors.length ? [] : events.sort((x, y) => x.start - y.start), errors, warnings }
}
