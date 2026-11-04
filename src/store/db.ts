import { openDB } from 'idb'
import type { FixedEvent, Task } from '../core/scheduler'

export type PlanState = { tasks: Task[]; events: FixedEvent[] }
export const emptyState: PlanState = { tasks: [], events: [] }

const db = () => openDB('tempo', 1, { upgrade: (d) => void d.createObjectStore('kv') })

export async function loadState(): Promise<PlanState> {
  const v = (await (await db()).get('kv', 'plan')) as Partial<PlanState> | undefined
  return { tasks: v?.tasks ?? [], events: v?.events ?? [] }
}

export async function saveState(s: PlanState): Promise<void> {
  await (await db()).put('kv', s, 'plan')
}
