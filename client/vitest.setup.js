import 'fake-indexeddb/auto'

// Minimal DOM globals can be added here if needed

// Mock sql.js to avoid loading SQL.wasm in Node test environment
import { vi } from 'vitest'

vi.mock('sql.js', () => {
  class FakeStatement {
    step() { return false }
    getAsObject() { return {} }
    free() {}
  }
  class FakeDB {
    constructor() {}
    prepare() { return new FakeStatement() }
    close() {}
  }
  return {
    __esModule: true,
    default: async () => ({ Database: FakeDB })
  }
})


