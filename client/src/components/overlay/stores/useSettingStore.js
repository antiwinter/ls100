import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const stores = new Map()

export const useSettingStore = (id) => {
  if (!id) {
    throw new Error('id is required for useSettingStore')
  }

  if (stores.has(id)) {
    return stores.get(id)
  }

  const store = create(
    persist(
      immer((set) => ({
        // Font settings (raw values)
        fontSize: 16,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Heiti SC, sans-serif',
        setFontSize: (size) => set((state) => {
          state.fontSize = size
        }),
        setFontFamily: (family) => set((state) => {
          state.fontFamily = family
        }),
        updateFont: (updates) => set((state) => {
          if (updates.fontSize !== undefined) state.fontSize = updates.fontSize
          if (updates.fontFamily !== undefined) state.fontFamily = updates.fontFamily
        })
      })),
      {
        name: `ls100-settings-${id}`
      }
    )
  )

  stores.set(id, store)
  return store
}

// Cleanup function
export const cleanupSettingStore = (id) => {
  stores.delete(id)
}
