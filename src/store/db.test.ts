import { expect, it } from 'vitest'
import { loadState, saveState } from './db'

it('returns empty state first, then what was saved', async () => {
  expect(await loadState()).toEqual({ tasks: [], events: [] })
  const s = { tasks: [{ id: '1', title: 'a', category: 'c', estimate: 30, priority: 1 }], events: [] }
  await saveState(s)
  expect(await loadState()).toEqual(s)
})
