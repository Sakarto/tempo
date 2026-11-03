import type { TimerState } from '../core/timer'
import type { FixedEvent } from '../core/scheduler'

export interface StoredTask { id: string; title: string; category: string; duration: number; reward?: string }
export interface StoredSession {
  id: string; date: string; task: string; category: string
  estimate: number; actual: number; extended: number
  distracted: boolean; energy: number | null; note: string
}
interface Stores { tasks: StoredTask; events: FixedEvent; sessions: StoredSession }
type StoreName = keyof Stores

const STORES: StoreName[] = ['tasks', 'events', 'sessions']
const TIMER_KEY = 'timer'

const wrap = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

/** Resolves when the transaction has committed (not merely when the request succeeded), so data is durable. */
const committed = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

export interface TempoDb {
  getAll<S extends StoreName>(store: S): Promise<Stores[S][]>
  put<S extends StoreName>(store: S, value: Stores[S]): Promise<void>
  remove(store: StoreName, id: string): Promise<void>
  saveTimer(t: TimerState | null): Promise<void>
  loadTimer(): Promise<TimerState | null>
  close(): void
}

export function openTempoDb(name = 'tempo'): Promise<TempoDb> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, 1)
    open.onupgradeneeded = () => {
      // Idempotent so a future version bump (or a partially created database) can never hit a ConstraintError.
      const names = open.result.objectStoreNames
      for (const s of STORES) if (!names.contains(s)) open.result.createObjectStore(s, { keyPath: 'id' })
      if (!names.contains('meta')) open.result.createObjectStore('meta')
    }
    open.onerror = () => reject(open.error)
    open.onblocked = () => reject(new Error('Tempo database is open in another tab; close it and retry'))
    open.onsuccess = () => {
      const db = open.result
      db.onversionchange = () => db.close() // let a newer tab/build upgrade the schema instead of hanging
      const run = async <T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
        const tx = db.transaction(store, mode)
        const done = committed(tx)
        const [result] = await Promise.all([wrap(fn(tx.objectStore(store))), done])
        return result
      }
      resolve({
        getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
        put: async (store, value) => { await run(store, 'readwrite', (s) => s.put(value)) },
        remove: async (store, id) => { await run(store, 'readwrite', (s) => s.delete(id)) },
        saveTimer: async (t) => {
          if (t) await run('meta', 'readwrite', (s) => s.put(t, TIMER_KEY))
          else await run('meta', 'readwrite', (s) => s.delete(TIMER_KEY))
        },
        loadTimer: async () => (await run<TimerState | undefined>('meta', 'readonly', (s) => s.get(TIMER_KEY))) ?? null,
        close: () => db.close(),
      })
    }
  })
}
