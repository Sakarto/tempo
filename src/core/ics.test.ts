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

  it('skips a recurring TZID event whose zone differs from local, with a warning', () => {
    const other = new Date().getTimezoneOffset() === 0 ? 'Asia/Kolkata' : 'UTC'
    const r = parseIcs(wrap(ev(`SUMMARY:Z\r\nDTSTART;TZID=${other}:20261101T100000\r\nDTEND;TZID=${other}:20261101T110000\r\nRRULE:FREQ=DAILY`)), today, 0, 1440)
    expect(r.events).toEqual([])
    expect(r.warnings[0]).toMatch(/different time zone/)
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
