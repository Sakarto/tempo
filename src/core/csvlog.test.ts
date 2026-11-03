import { describe, expect, test } from 'vitest'
import { parseTimeLog } from './csvlog'

const H = 'date,task,category,estimate_min,actual_min,extended_min,distracted,energy_1to5,note'

describe('parseTimeLog', () => {
  test('parses rows in the specified columns, including quoted commas', () => {
    const r = parseTimeLog(`${H}\n2026-11-02,"Read ch 3, 4",study,60,90,15,yes,3,"said ""hi"""\n2026-11-02,Gym,health,60,55,0,no,4,`)
    expect(r.errors).toEqual([])
    expect(r.sessions).toEqual([
      { date: '2026-11-02', task: 'Read ch 3, 4', category: 'study', estimate: 60, actual: 90, extended: 15, distracted: true, energy: 3, note: 'said "hi"' },
      { date: '2026-11-02', task: 'Gym', category: 'health', estimate: 60, actual: 55, extended: 0, distracted: false, energy: 4, note: '' },
    ])
  })

  test('bad rows are reported with line numbers and good rows still import', () => {
    const r = parseTimeLog(`${H}\nnot-a-date,x,c,60,60,0,no,3,\n2026-11-02,ok,c,60,45,0,no,3,\n2026-11-02,short`)
    expect(r.sessions.map((s) => s.task)).toEqual(['ok'])
    expect(r.errors.map((e) => e.line)).toEqual([2, 4])
  })

  test('handles CRLF, blank lines and a BOM', () => {
    const r = parseTimeLog(`﻿${H}\r\n\r\n2026-11-02,a,c,30,30,0,0,5,\r\n`)
    expect(r.sessions).toHaveLength(1)
    expect(r.errors).toEqual([])
  })

  test('a wrong header is a single error, not an exception', () => {
    const r = parseTimeLog('a,b\n1,2')
    expect(r.sessions).toEqual([])
    expect(r.errors).toHaveLength(1)
  })

  test('rejects negative or non-numeric minutes and out-of-range energy', () => {
    const r = parseTimeLog(`${H}\n2026-11-02,a,c,-5,30,0,no,3,\n2026-11-02,b,c,30,x,0,no,3,\n2026-11-02,c,c,30,30,0,no,9,`)
    expect(r.sessions).toEqual([])
    expect(r.errors).toHaveLength(3)
  })
})
