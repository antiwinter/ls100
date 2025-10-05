import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { log } from '../utils/logger'
import prettyBytes from 'pretty-bytes'

const stores = new Map()

export const buildKey = ({ topic, shardId }) => {
  return ['ls100', topic, shardId].filter(Boolean).join('-')
}

// getStore(scope, createSlice, options)
// options.partialize: (state) => persistedState
export const getStore = (scope, createSlice, options = {}) => {
  const key = buildKey(scope)
  if (stores.has(key)) return stores.get(key)

  const { partialize = (state) => state } = options

  const store = create(
    persist(
      immer((set, get) => (createSlice ? createSlice(set, get) : {})),
      {
        name: key,
        partialize
      }
    )
  )

  stores.set(key, store)
  return store
}

export default { getStore, buildKey }

// Get approximate size in bytes
let total = 0
let agg = []
for (let k in localStorage) {
  let v = localStorage.getItem(k)
  if (v) {
    total += JSON.stringify(v).length + k.length
    agg.push({ k, v })
  }
}

log.info('localStorage size:', prettyBytes(total),
  agg
    .sort((a, b) => b.v.length - a.v.length)
    .map(a => `${a.k}: ${prettyBytes(a.v.length)}`))
