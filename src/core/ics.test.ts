import { describe, expect, test } from 'vitest'
import { parseIcs } from './ics'

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`
const ev = (extra: string) => `BEGIN:VEVENT\r\n${extra}END:VEVENT\r\n`

describe('parseIcs', () => {
  test('two events on one day give two fixed events with correct minutes', () => {
    const text = wrap(
      ev('UID:1\r\nSUMMARY:Class\r\nDTSTART:20261103T090000\r\nDTEND:20261103T103000\r\n') +
        ev('UID:2\r\nSUMMARY:Gym\r\nDTSTART;TZID=America/Chicago:20261103T170000\r\nDTEND;TZID=America/Chicago:20261103T180000\r\n') +
        ev('UID:3\r\nSUMMARY:Other day\r\nDTSTART:20261104T090000\r\nDTEND:20261104T100000\r\n'),
    )
    const r = parseIcs(text, '2026-11-03')
    expect(r.errors).toEqual([])
    expect(r.events).toEqual([
      { id: '1', title: 'Class', start: 540, end: 630 },
      { id: '2', title: 'Gym', start: 1020, end: 1080 },
    ])
  })

  test('unfolds long lines and unescapes text', () => {
    const text = wrap(ev('UID:1\r\nSUMMARY:Club\\, board\r\n  meeting\r\nDTSTART:20261103T100000\r\nDTEND:20261103T110000\r\n'))
    expect(parseIcs(text, '2026-11-03').events[0].title).toBe('Club, board meeting')
  })

  test('all-day events are skipped; malformed events are reported, not thrown', () => {
    const text = wrap(
      ev('UID:a\r\nSUMMARY:Holiday\r\nDTSTART;VALUE=DATE:20261103\r\nDTEND;VALUE=DATE:20261104\r\n') +
        ev('UID:b\r\nSUMMARY:Broken\r\nDTSTART:garbage\r\n') +
        ev('UID:c\r\nSUMMARY:Ok\r\nDTSTART:20261103T080000\r\nDTEND:20261103T090000\r\n'),
    )
    const r = parseIcs(text, '2026-11-03')
    expect(r.events.map((e) => e.id)).toEqual(['c'])
    expect(r.errors).toHaveLength(1)
  })

  test('an event crossing midnight is clamped to the day', () => {
    const text = wrap(ev('UID:1\r\nSUMMARY:Late\r\nDTSTART:20261103T230000\r\nDTEND:20261104T010000\r\n'))
    expect(parseIcs(text, '2026-11-03').events[0]).toMatchObject({ start: 1380, end: 1440 })
  })

  test('input that is not a calendar returns an error', () => {
    expect(parseIcs('hello', '2026-11-03')).toEqual({ events: [], errors: ['No VEVENT found'] })
  })
})

describe('parseIcs real-world exports', () => {
  const d = '2026-11-03'
  const e = (x: string) => wrap(ev(`UID:u\r\nSUMMARY:S\r\n${x}`))
  test('nested VALARM properties do not overwrite the event', () => {
    const r = parseIcs(e('DTSTART:20261103T090000\r\nDTEND:20261103T100000\r\nBEGIN:VALARM\r\nSUMMARY:alarm\r\nDTSTART:20261103T080000\r\nEND:VALARM\r\n'), d)
    expect(r.events).toEqual([{ id: 'u', title: 'S', start: 540, end: 600 }])
  })
  test('cancelled events are skipped', () => {
    expect(parseIcs(e('STATUS:CANCELLED\r\nDTSTART:20261103T090000\r\nDTEND:20261103T100000\r\n'), d).events).toEqual([])
  })
  test('recurring events are reported, not silently dropped', () => {
    const r = parseIcs(e('RRULE:FREQ=WEEKLY\r\nDTSTART:20261027T090000\r\nDTEND:20261027T100000\r\n'), d)
    expect(r.events).toEqual([])
    expect(r.errors[0]).toMatch(/Recurring/)
  })
  test('DURATION replaces DTEND', () => {
    expect(parseIcs(e('DTSTART:20261103T090000\r\nDURATION:PT1H30M\r\n'), d).events[0]).toMatchObject({ start: 540, end: 630 })
  })
  test('invalid requested or event dates give errors; case-insensitive BEGIN; duplicate uids get unique ids', () => {
    expect(parseIcs(e('DTSTART:20261103T090000\r\nDTEND:20261103T100000\r\n'), '2026-02-31').errors).toHaveLength(1)
    expect(parseIcs(e('DTSTART:20261303T090000\r\nDTEND:20261303T100000\r\n'), d).errors).toHaveLength(1)
    const lower = parseIcs('begin:vcalendar\nbegin:vevent\nuid:q\nsummary:L\ndtstart:20261103T090000\ndtend:20261103T100000\nend:vevent\n', d)
    expect(lower.events).toHaveLength(1)
    const dup = parseIcs(wrap(ev('UID:a\r\nDTSTART:20261103T090000\r\nDTEND:20261103T100000\r\n') + ev('UID:a\r\nDTSTART:20261103T110000\r\nDTEND:20261103T120000\r\n')), d)
    expect(new Set(dup.events.map((x) => x.id)).size).toBe(2)
  })
})
