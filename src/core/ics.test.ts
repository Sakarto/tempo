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
