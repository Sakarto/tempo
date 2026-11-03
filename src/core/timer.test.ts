import { expect, test } from 'vitest'
import { elapsedMs, pause, resume, start } from './timer'

test('running timer counts from startedAt plus banked time', () => {
  const t = start('a', 1000)
  expect(elapsedMs(t, 61_000)).toBe(60_000)
})

test('pause banks elapsed time and stops counting; resume continues', () => {
  const p = pause(start('a', 0), 30_000)
  expect(p.running).toBe(false)
  expect(elapsedMs(p, 90_000)).toBe(30_000)
  const r = resume(p, 100_000)
  expect(elapsedMs(r, 110_000)).toBe(40_000)
})

test('clock going backwards never yields negative elapsed', () => {
  expect(elapsedMs(start('a', 5000), 1000)).toBe(0)
})

test('pausing a paused timer or resuming a running one is a no-op', () => {
  const p = pause(start('a', 0), 10)
  expect(pause(p, 999)).toEqual(p)
  const r = start('a', 0)
  expect(resume(r, 999)).toEqual(r)
})
