import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const stores = new Map()

export const useSessionStore = (shardId) => {
  if (!shardId) {
    throw new Error('shardId is required for useSessionStore')
  }

  if (stores.has(shardId)) {
    return stores.get(shardId)
  }

  const store = create(
    persist(
      immer((set, get) => ({
        // Language map state (plain object for easy serialization)
        langMap: {},
        setLangMap: (langMap) => set((state) => {
          state.langMap = langMap instanceof Map ? Object.fromEntries(langMap) : langMap
        }),
        toggleLang: (code) => set((state) => {
          if (state.langMap[code]) {
            state.langMap[code].visible = !state.langMap[code].visible
          }
        }),

        // Position state
        position: 0,
        setPosition: (idx) => set((state) => {
          state.position = idx
        }),

        // Hint state
        hint: '',
        setHint: (hint) => set((state) => {
          state.hint = hint
        }),

        // Shard name state
        shardName: '',
        setShardName: (name) => set((state) => {
          state.shardName = name
        }),

        // Selected words state (plain array for easy serialization)
        wordlist: [],
        initWordlist: (words) => set((state) => {
          state.wordlist = words instanceof Set ? Array.from(words) : (words || [])
        }),
        toggleWord: (word, check = 0) => set((state) => {
          const idx = state.wordlist.indexOf(word)
          if (idx >= 0 && !check) {
            state.wordlist.splice(idx, 1)
          } else {
            state.wordlist.push(word)
          }
        }),
        clearWordlist: () => set((state) => {
          state.wordlist = []
        }),

        // Helper functions
        hasWord: (word) => get().wordlist.includes(word)
      })),
      {
        name: `ls100-session-${shardId}`
      }
    )
  )

  stores.set(shardId, store)
  return store
}

// Cleanup function to remove store when shard is no longer needed
export const cleanupSessionStore = (shardId) => {
  stores.delete(shardId)
}
