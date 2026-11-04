import { IDBFactory } from 'fake-indexeddb'
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(async () => {
  cleanup()
  indexedDB = new IDBFactory() // fresh database per test
})
