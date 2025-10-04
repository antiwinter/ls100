import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import createDexieStorage from './dexieStorage'

const stores = new Map()

export const buildKey = ({ topic, shardId }) => {
  return ['ls100', topic, shardId].filter(Boolean).join('-')
}

// getStore(scope, createSlice, options)
// options.partialize: (state) => persistedState
export const getStore = (scope, createSlice, options = {}) => {
  const key = buildKey(scope)
  if (stores.has(key)) return stores.get(key)

  const storage = createDexieStorage()
  const { topic, shardId } = scope
  const { partialize = (state) => state } = options

  const store = create(
    persist(
      immer((set, get) => (createSlice ? createSlice(set, get) : {})),
      {
        name: key,
        storage: {
          getItem: (name) => storage.getItem(name),
          setItem: (name, value) => storage.setItem(name, value, { topic, shardId }),
          removeItem: (name) => storage.removeItem(name)
        },
        partialize
      }
    )
  )

  stores.set(key, store)
  return store
}

export default { getStore, buildKey }


