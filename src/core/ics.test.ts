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

  it('handles TZID params, folded lines and escaped text', () => {
    const ics = wrap(ev('SUMMARY:Lab\\, part\r\n  two\r\nDTSTART;TZID=America/New_York:20261104T140000\r\nDTEND;TZID=America/New_York:20261104T150000'))
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
})
