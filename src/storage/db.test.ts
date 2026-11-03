import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { start } from '../core/timer'
import { elapsedMs } from '../core/timer'
import { openTempoDb, type TempoDb } from './db'

let n = 0
let name = ''
beforeEach(() => { name = `tempo-test-${n++}` })

describe('tempo db', () => {
  test('tasks, events and sessions are identical after closing and reopening', async () => {
    const a = await openTempoDb(name)
    const task = { id: 't1', title: 'Read', category: 'study', duration: 60 }
    const event = { id: 'e1', title: 'Class', start: 540, end: 600 }
    const session = { id: 's1', date: '2026-11-03', task: 'Read', category: 'study', estimate: 60, actual: 75, extended: 15, distracted: false, energy: 3, note: '' }
    await a.put('tasks', task)
    await a.put('events', event)
    await a.put('sessions', session)
    a.close()
    const b = await openTempoDb(name)
    expect(await b.getAll('tasks')).toEqual([task])
    expect(await b.getAll('events')).toEqual([event])
    expect(await b.getAll('sessions')).toEqual([session])
    b.close()
  })

  test('put overwrites by id and remove deletes', async () => {
    const db = await openTempoDb(name)
    await db.put('tasks', { id: 't1', title: 'A', category: 'c', duration: 30 })
    await db.put('tasks', { id: 't1', title: 'B', category: 'c', duration: 30 })
    expect((await db.getAll('tasks')).map((t) => t.title)).toEqual(['B'])
    await db.remove('tasks', 't1')
    expect(await db.getAll('tasks')).toEqual([])
    db.close()
  })

  test('active timer restores after a simulated reload with the right elapsed time', async () => {
    const a: TempoDb = await openTempoDb(name)
    const t = start('t1', 1_000)
    await a.saveTimer(t)
    a.close()
    const b = await openTempoDb(name)
    const restored = await b.loadTimer()
    expect(restored).toEqual(t)
    expect(elapsedMs(restored!, 91_000)).toBe(90_000)
    await b.saveTimer(null)
    expect(await b.loadTimer()).toBeNull()
    b.close()
  })

  test('a fresh database is empty', async () => {
    const db = await openTempoDb(name)
    expect(await db.getAll('tasks')).toEqual([])
    expect(await db.loadTimer()).toBeNull()
    db.close()
  })

  test('a newer schema version can open while an old connection is open, and existing data survives', async () => {
    const old = await openTempoDb(name)
    await old.put('tasks', { id: 't1', title: 'A', category: 'c', duration: 30 })
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 2)
      req.onupgradeneeded = () => req.result.createObjectStore('extra')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('blocked'))
    })
    expect(Array.from(upgraded.objectStoreNames)).toContain('extra')
    expect(Array.from(upgraded.objectStoreNames)).toContain('tasks')
    upgraded.close()
  })

  test('a failed write rejects cleanly (vitest fails the run on any unhandled rejection)', async () => {
    const db = await openTempoDb(name)
    await expect(db.put('tasks', { title: 'no id' } as never)).rejects.toBeDefined()
    await new Promise((r) => setTimeout(r, 50))
    db.close()
  })
})
