import { describe, expect, it } from 'vitest'
import { parseIcs } from './ics'

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`
const ev = (lines: string) => `BEGIN:VEVENT\r\n${lines}\r\nEND:VEVENT\r\n`
const today = new Date(2026, 10, 4) // local 2026-11-04

describe('parseIcs', () => {
  it('reads floating local times for today and ignores other days', () => {
    const ics = wrap(
      ev('SUMMARY:Class\r\nDTSTART:20261104T100000\r\nDTEND:20261104T113000') +
      ev('SUMMARY:Gym\r\nDTSTART:20261104T170000\r\nDTEND:20261104T180000') +
      ev('SUMMARY:Tomorrow\r\nDTSTART:20261105T100000\r\nDTEND:20261105T110000'),
    )
    const r = parseIcs(ics, today, 540, 1320)
    expect(r.events.map((e) => [e.title, e.start, e.end])).toEqual([['Class', 600, 690], ['Gym', 1020, 1080]])
    expect(r.errors).toEqual([])
  })

  it('handles folded lines and escaped text', () => {
    const ics = wrap(ev('SUMMARY:Lab\\, part\r\n  two\r\nDTSTART:20261104T140000\r\nDTEND:20261104T150000'))
    const r = parseIcs(ics, today, 540, 1320)
    expect(r.events[0]).toMatchObject({ title: 'Lab, part two', start: 840, end: 900 })
  })

  it('converts UTC times to local time', () => {
    const d = new Date(Date.UTC(2026, 10, 4, 15, 0))
    const local = d.getHours() * 60 + d.getMinutes()
    const ics = wrap(ev('SUMMARY:U\r\nDTSTART:20261104T150000Z\r\nDTEND:20261104T160000Z'))
    const r = parseIcs(ics, new Date(d.getFullYear(), d.getMonth(), d.getDate()), 0, 1440)
    expect(r.events[0]).toMatchObject({ start: local, end: local + 60 })
  })

  it('skips all-day events, clips to the day window, defaults missing DTEND to 60 min', () => {
    const ics = wrap(
      ev('SUMMARY:Holiday\r\nDTSTART;VALUE=DATE:20261104\r\nDTEND;VALUE=DATE:20261105') +
      ev('SUMMARY:Late\r\nDTSTART:20261104T210000\r\nDTEND:20261104T233000') +
      ev('SUMMARY:Early\r\nDTSTART:20261104T070000\r\nDTEND:20261104T080000') +
      ev('SUMMARY:NoEnd\r\nDTSTART:20261104T120000'),
    )
    const r = parseIcs(ics, today, 540, 1320)
    expect(r.events.map((e) => [e.title, e.start, e.end])).toEqual([['NoEnd', 720, 780], ['Late', 1260, 1320]])
  })

  it('reports a file that is not a calendar and malformed events', () => {
    expect(parseIcs('hello world', today, 540, 1320).errors[0]).toMatch(/not an iCalendar/i)
    const r = parseIcs(wrap(ev('SUMMARY:Bad\r\nDTSTART:garbage')), today, 540, 1320)
    expect(r.events).toEqual([])
    expect(r.errors).toHaveLength(1)
  })

  it('converts TZID times to local time and flags unknown zones', () => {
    const ny = Date.UTC(2026, 10, 4, 15, 0) // 10:00 EST (UTC-5) on 2026-11-04
    const local = new Date(ny)
    const day = new Date(local.getFullYear(), local.getMonth(), local.getDate())
    const ok = wrap(ev('SUMMARY:A\r\nDTSTART;TZID=America/New_York:20261104T100000\r\nDTEND;TZID=America/New_York:20261104T110000'))
    const r = parseIcs(ok, day, 0, 1440)
    expect(r.events[0].start).toBe(local.getHours() * 60 + local.getMinutes())
    const bad = parseIcs(wrap(ev('SUMMARY:B\r\nDTSTART;TZID=Mars/Base:20261104T100000')), today, 0, 1440)
    expect(bad.events).toEqual([])
    expect(bad.warnings[0]).toMatch(/unknown time zone/)
  })

  it('expands DAILY/WEEKLY recurrence with INTERVAL, BYDAY, UNTIL, COUNT, EXDATE; flags unsupported', () => {
    const rr = (rule: string, extra = '') => wrap(ev(`SUMMARY:R\r\nDTSTART:20261101T100000\r\nDTEND:20261101T103000\r\nRRULE:${rule}${extra}`))
    const n = (ics: string) => parseIcs(ics, today, 540, 1320).events.length // 2026-11-04 is a Wednesday
    expect(n(rr('FREQ=DAILY'))).toBe(1)
    expect(n(rr('FREQ=DAILY;INTERVAL=2'))).toBe(0) // Nov 1, 3, 5
    expect(n(rr('FREQ=DAILY;INTERVAL=3'))).toBe(1) // Nov 1, 4
    expect(n(rr('FREQ=WEEKLY;BYDAY=WE'))).toBe(1)
    expect(n(rr('FREQ=WEEKLY;BYDAY=MO,TU'))).toBe(0)
    expect(n(rr('FREQ=DAILY;UNTIL=20261103T000000Z'))).toBe(0)
    expect(n(rr('FREQ=DAILY;COUNT=3'))).toBe(0)
    expect(n(rr('FREQ=DAILY;COUNT=4'))).toBe(1)
    expect(n(rr('FREQ=DAILY', '\r\nEXDATE:20261104T100000'))).toBe(0)
    const m = parseIcs(rr('FREQ=MONTHLY'), today, 540, 1320)
    expect(m.events).toEqual([])
    expect(m.warnings[0]).toMatch(/repeats/)
    expect(m.errors).toEqual([])
    expect(parseIcs(rr('FREQ=DAILY'), today, 540, 1320).events[0]).toMatchObject({ start: 600, end: 630 })
  })

  it('honours DURATION, skips CANCELLED, and handles events spanning midnight', () => {
    const d = parseIcs(wrap(ev('SUMMARY:D\r\nDTSTART:20261104T100000\r\nDURATION:PT30M')), today, 540, 1320)
    expect(d.events[0]).toMatchObject({ start: 600, end: 630 })
    const c = parseIcs(wrap(ev('SUMMARY:C\r\nSTATUS:CANCELLED\r\nDTSTART:20261104T100000\r\nDTEND:20261104T110000')), today, 540, 1320)
    expect(c.events).toEqual([])
    const o = parseIcs(wrap(ev('SUMMARY:O\r\nDTSTART:20261103T230000\r\nDTEND:20261104T100000')), today, 540, 1320)
    expect(o.events[0]).toMatchObject({ start: 540, end: 600 })
  })

  it('reports truncated or unterminated files instead of importing nothing silently', () => {
    expect(parseIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:X\r\nDTSTART:20261104T100000', today, 540, 1320).errors.join(' ')).toMatch(/END:VEVENT/)
    expect(parseIcs('BEGIN:VCALENDAR\r\nfoo\r\n', today, 540, 1320).errors.join(' ')).toMatch(/truncated/)
  })

  it('uses wall-clock minutes (DST-safe) via local getters', () => {
    const spring = new Date(2026, 2, 8)
    const r = parseIcs(wrap(ev('SUMMARY:S\r\nDTSTART:20260308T100000\r\nDTEND:20260308T110000')), spring, 0, 1440)
    expect(r.events[0]).toMatchObject({ start: 600, end: 660 })
  })

  it('applies UNTIL given as a UTC instant to the instance time', () => {
    const rr = (until: string) => wrap(ev(`SUMMARY:U\r\nDTSTART:20261101T100000\r\nDTEND:20261101T110000\r\nRRULE:FREQ=DAILY;UNTIL=${until}`))
    const inst = new Date(2026, 10, 4, 10, 0).getTime()
    const z = (t: number) => new Date(t).toISOString().replace(/[-:]|\.\d+/g, '')
    expect(parseIcs(rr(z(inst - 60_000)), today, 540, 1320).events).toHaveLength(0)
    expect(parseIcs(rr(z(inst + 60_000)), today, 540, 1320).events).toHaveLength(1)
  })

  it('ignores VALARM properties inside an event', () => {
    const e = ev('SUMMARY:V\r\nDTSTART:20261104T100000\r\nBEGIN:VALARM\r\nDURATION:PT5M\r\nEND:VALARM')
    expect(parseIcs(wrap(e), today, 540, 1320).events[0]).toMatchObject({ start: 600, end: 660 })
  })

  it('imports nothing from a file with structural errors', () => {
    const r = parseIcs('BEGIN:VCALENDAR\r\n' + ev('SUMMARY:Good\r\nDTSTART:20261104T100000\r\nDTEND:20261104T110000') + ev('SUMMARY:Bad\r\nDTSTART:garbage'), today, 540, 1320)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.events).toEqual([])
  })

  it('converts a recurring TZID event from another zone instead of skipping it (instance built in its own zone)', () => {
    const other = new Date().getTimezoneOffset() === 0 ? 'Asia/Kolkata' : 'UTC'
    const r = parseIcs(wrap(ev(`SUMMARY:Z\r\nDTSTART;TZID=${other}:20261101T100000\r\nDTEND;TZID=${other}:20261101T110000\r\nRRULE:FREQ=DAILY`)), today, 0, 1440)
    const inst = other === 'UTC' ? Date.UTC(2026, 10, 4, 10) : Date.UTC(2026, 10, 4, 4, 30)
    const d = new Date(inst)
    expect(r.events).toHaveLength(1)
    expect(r.events[0].start).toBe(d.getHours() * 60 + d.getMinutes())
    expect(r.warnings).toEqual([])
  })
})

describe('parseIcs hardening (from this branch\'s own reviews)', () => {
  const day = new Date(2026, 10, 4)
  const win = (t: string) => parseIcs(t, day, 0, 1440)
  it('unique ids: UID-based, duplicates and collisions get distinct ids', () => {
    const one = 'UID:a\r\nDTSTART:20261104T100000\r\nDTEND:20261104T110000'
    const r = win(wrap(ev(one) + ev(one) + ev(one) + ev('UID:a#2\r\nDTSTART:20261104T120000\r\nDTEND:20261104T130000')))
    expect(r.events).toHaveLength(4)
    expect(new Set(r.events.map((e) => e.id)).size).toBe(4)
    expect(r.events[0].id).toBe('a')
  })
  it('an unclosed VALARM does not swallow the next event', () => {
    const open = 'BEGIN:VEVENT\r\nUID:y\r\nDTSTART:20261104T100000\r\nDTEND:20261104T110000\r\nBEGIN:VALARM\r\nEND:VEVENT\r\n'
    const r = win(wrap(open + ev('UID:w\r\nDTSTART:20261104T120000\r\nDTEND:20261104T130000')))
    expect(r.events.map((e) => e.id)).toEqual(['y', 'w'])
  })
  it('impossible dates are errors, and so is an invalid requested day', () => {
    expect(win(wrap(ev('DTSTART:20261303T090000\r\nDTEND:20261303T100000'))).errors).toHaveLength(1)
    expect(win(wrap(ev('DTSTART:20260231T090000\r\nDTEND:20260231T100000'))).errors).toHaveLength(1)
    expect(parseIcs(wrap(''), new Date(NaN), 0, 1440).errors).toEqual(['Invalid date.'])
  })
  it('P1W durations and DURATION on a DST day use real elapsed time', () => {
    expect(win(wrap(ev('DTSTART:20261104T090000\r\nDURATION:P1W'))).errors).toEqual([])
    const spring = new Date(2026, 2, 8)
    const r = parseIcs(wrap(ev('DTSTART:20260308T080000\r\nDURATION:PT1H')), spring, 0, 1440)
    expect(r.events[0]).toMatchObject({ start: 480, end: 540 })
  })
})

describe('parseIcs second-review fixes', () => {
  const day = new Date(2026, 10, 4)
  const win = (t: string, d = day) => parseIcs(t, d, 0, 1440)
  it('RECURRENCE-ID overrides replace that instance; cancelled overrides remove it', () => {
    const base = ev('UID:s\r\nSUMMARY:Base\r\nDTSTART:20261101T090000\r\nDTEND:20261101T100000\r\nRRULE:FREQ=DAILY')
    const moved = ev('UID:s\r\nSUMMARY:Moved\r\nRECURRENCE-ID:20261104T090000\r\nDTSTART:20261104T150000\r\nDTEND:20261104T160000')
    const r = win(wrap(base + moved))
    expect(r.events.map((e) => [e.title, e.start])).toEqual([['Moved', 15 * 60]])
    const gone = ev('UID:s\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nRECURRENCE-ID:20261104T090000\r\nDTSTART:20261104T090000\r\nDTEND:20261104T100000')
    expect(win(wrap(base + gone)).events).toEqual([])
    expect(win(wrap(base + gone), new Date(2026, 10, 5)).events).toHaveLength(1)
  })
  it('a zero-length event is ignored, not a file-level error; PT0S too', () => {
    const r = win(wrap(ev('DTSTART:20261104T100000\r\nDTEND:20261104T100000') + ev('UID:n\r\nDTSTART:20261104T110000\r\nDTEND:20261104T120000')))
    expect(r.errors).toEqual([])
    expect(r.events.map((e) => e.id)).toEqual(['n'])
    expect(win(wrap(ev('DTSTART:20261104T100000\r\nDURATION:PT0S'))).events).toEqual([])
    expect(win(wrap(ev('DTSTART:20261104T100000\r\nDTEND:20261104T090000'))).errors).toHaveLength(1)
  })
  it('a recurring event crossing midnight shows its spill-over on the next day', () => {
    const night = wrap(ev('UID:n\r\nSUMMARY:Night\r\nDTSTART:20261103T230000\r\nDTEND:20261104T010000\r\nRRULE:FREQ=DAILY'))
    expect(win(night).events.map((e) => [e.start, e.end])).toEqual([[0, 60], [1380, 1440]])
  })
  it('a recurring TZID series keeps wall-clock time in its own zone across DST', () => {
    const lon = wrap(ev('SUMMARY:L\r\nDTSTART;TZID=Europe/London:20260105T090000\r\nDTEND;TZID=Europe/London:20260105T100000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO'))
    const expected = new Date(Date.UTC(2026, 6, 6, 8)) // 09:00 BST = 08:00 UTC
    const r = parseIcs(lon, new Date(expected.getFullYear(), expected.getMonth(), expected.getDate()), 0, 1440)
    expect(r.events[0].start).toBe(expected.getHours() * 60 + expected.getMinutes())
  })
  it('a UTC series keeps its UTC time across DST', () => {
    const z = wrap(ev('SUMMARY:Z\r\nDTSTART:20260105T140000Z\r\nDTEND:20260105T150000Z\r\nRRULE:FREQ=WEEKLY;BYDAY=MO'))
    const expected = new Date(Date.UTC(2026, 6, 6, 14))
    const r = parseIcs(z, new Date(expected.getFullYear(), expected.getMonth(), expected.getDate()), 0, 1440)
    expect(r.events[0].start).toBe(expected.getHours() * 60 + expected.getMinutes())
  })
  it('CR-only line endings, old series, quoted TZID and WKST are handled', () => {
    const cr = wrap(ev('SUMMARY:C\r\nDTSTART:20261104T100000\r\nDTEND:20261104T110000')).replace(/\r\n/g, '\r')
    expect(win(cr).events).toHaveLength(1)
    const old = wrap(ev('SUMMARY:O\r\nDTSTART:20140101T090000\r\nDTEND:20140101T100000\r\nRRULE:FREQ=WEEKLY;BYDAY=WE'))
    expect(win(old).events).toHaveLength(1) // 2026-11-04 is a Wednesday
    const q = wrap(ev('SUMMARY:Q\r\nDTSTART;TZID="UTC":20261104T100000\r\nDTEND;TZID="UTC":20261104T110000'))
    expect(win(q).warnings).toEqual([])
    const wk = wrap(ev('SUMMARY:W\r\nDTSTART:20261028T090000\r\nDTEND:20261028T100000\r\nRRULE:FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=SU,WE'))
    expect(win(wk, new Date(2026, 10, 8)).events).toHaveLength(1)
  })
  it('unsupported rule parts are skipped with a warning instead of showing wrongly', () => {
    const r = win(wrap(ev('SUMMARY:B\r\nDTSTART:20261001T090000\r\nDTEND:20261001T100000\r\nRRULE:FREQ=DAILY;BYMONTHDAY=1')))
    expect(r.events).toEqual([])
    expect(r.warnings[0]).toMatch(/can't read/)
  })
})

describe('parseIcs third pass', () => {
  const win = (t: string, d: Date) => parseIcs(t, d, 0, 1440)
  const localMin = (ms: number) => new Date(ms).getHours() * 60 + new Date(ms).getMinutes()
  const dayOf = (ms: number) => new Date(new Date(ms).getFullYear(), new Date(ms).getMonth(), new Date(ms).getDate())

  it('an exclusion or override written in another zone removes the correct instance', () => {
    // Series: daily 23:00Z. RECURRENCE-ID 2026-09-04 11:00 Auckland (NZST+12) = 2026-09-03 23:00Z.
    const text = wrap(
      ev('UID:s\r\nSUMMARY:Base\r\nDTSTART:20260901T230000Z\r\nDTEND:20260902T000000Z\r\nRRULE:FREQ=DAILY') +
        ev('UID:s\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nRECURRENCE-ID;TZID=Pacific/Auckland:20260904T110000\r\nDTSTART:20260904T000000Z\r\nDTEND:20260904T010000Z'),
    )
    const removed = Date.UTC(2026, 8, 3, 23)
    const kept = Date.UTC(2026, 8, 4, 23)
    expect(win(text, dayOf(removed)).events.filter((e) => e.title === 'Base' && e.start === localMin(removed))).toEqual([])
    expect(win(text, dayOf(kept)).events.some((e) => e.title === 'Base' && e.start === localMin(kept))).toBe(true)
  })

  it('a TZID series spanning a DST night ends at the right wall-clock time on a fall-back night', () => {
    // New York nights run 22:00 -> 06:00 wall time in New York: 9 elapsed hours on Oct 31->Nov 1 (clocks fall back), 8 on Nov 1->2.
    // Busy time is counted in the machine's wall-clock minutes. On a machine whose own clocks also fall back in this
    // window (New York, Los Angeles) a day has no 25th hour, so the total is 16h; elsewhere it is the real 17h.
    // A fixed 8h-or-9h duration reused for every instance would give 15h (New York) or 18h (e.g. Kolkata).
    const ny = wrap(ev('SUMMARY:Sleep\r\nDTSTART;TZID=America/New_York:20261031T220000\r\nDTEND;TZID=America/New_York:20261101T060000\r\nRRULE:FREQ=DAILY;COUNT=2'))
    let busy = 0
    for (let d = 29; d <= 33; d++) { // local days Oct 29 .. Nov 2 in the machine's zone
      for (const e of win(ny, new Date(2026, 9, d)).events) busy += e.end - e.start
    }
    const machineFallsBack = new Date(2026, 9, 31, 12).getTimezoneOffset() !== new Date(2026, 10, 2, 12).getTimezoneOffset()
    expect(busy).toBe((machineFallsBack ? 16 : 17) * 60)
  })

  it('a nonexistent TZID time in the spring gap lands at the same instant as the equivalent post-transition time', () => {
    const gap = wrap(ev('SUMMARY:G\r\nDTSTART;TZID=America/New_York:20260308T023000\r\nDTEND;TZID=America/New_York:20260308T043000'))
    const real = wrap(ev('SUMMARY:G\r\nDTSTART;TZID=America/New_York:20260308T033000\r\nDTEND;TZID=America/New_York:20260308T043000'))
    let a = 0
    let b = 0
    for (let d = 7; d <= 9; d++) {
      for (const e of win(gap, new Date(2026, 2, d)).events) a += e.end - e.start
      for (const e of win(real, new Date(2026, 2, d)).events) b += e.end - e.start
    }
    expect(a).toBe(b) // 02:30 (nonexistent) is read as 03:30 EDT, so the block is 1h, not 2h
    expect(b).toBe(60)
  })

  it('warns on THISANDFUTURE overrides, RDATE and EXRULE; skips invalid rule values', () => {
    const base = 'UID:s\r\nSUMMARY:B\r\nDTSTART:20261101T100000\r\nDTEND:20261101T110000\r\nRRULE:FREQ=DAILY'
    const day = new Date(2026, 10, 4)
    const tf = win(wrap(ev(base) + ev('UID:s\r\nRECURRENCE-ID;RANGE=THISANDFUTURE:20261103T100000\r\nDTSTART:20261103T140000\r\nDTEND:20261103T150000')), day)
    expect(tf.warnings.join(' ')).toMatch(/future/)
    expect(win(wrap(ev('SUMMARY:R\r\nDTSTART:20261104T100000\r\nDTEND:20261104T110000\r\nRDATE:20261105T100000')), day).warnings.join(' ')).toMatch(/RDATE/)
    for (const bad of ['INTERVAL=0', 'INTERVAL=abc', 'COUNT=abc', 'COUNT=0', 'UNTIL=garbage', 'WKST=XX']) {
      const r = win(wrap(ev(`SUMMARY:X\r\nDTSTART:20261101T100000\r\nDTEND:20261101T110000\r\nRRULE:FREQ=DAILY;${bad}`)), day)
      expect([bad, r.events.length, r.warnings.length]).toEqual([bad, 0, 1])
    }
  })

  it('handles thousands of long-running weekly series quickly', () => {
    const one = (i: number) => ev(`UID:e${i}\r\nSUMMARY:E${i}\r\nDTSTART:19700107T090000\r\nDTEND:19700107T100000\r\nRRULE:FREQ=WEEKLY;BYDAY=WE,FR`)
    const text = wrap(Array.from({ length: 2000 }, (_, i) => one(i)).join(''))
    const t0 = Date.now()
    const r = win(text, new Date(2026, 10, 4)) // a Wednesday
    expect(r.events).toHaveLength(2000)
    expect(Date.now() - t0).toBeLessThan(4000)
  })
})
