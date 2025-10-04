import { getStore } from '../../../stores/factory'

export const useSettingStore = (topic) => {
  if (!topic) throw new Error('id is required for useSettingStore')
  return getStore(
    { topic },
    (set) => ({
      fontSize: 16,
      fontFamily:
        'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Heiti SC, sans-serif',
      selectedFont: 'system-ui',
      setFontSize: (size) => set((state) => { state.fontSize = size }),
      setFontFamily: (family) => set((state) => { state.fontFamily = family }),
      setSelectedFont: (font) => set((state) => {
        state.selectedFont = font
        state.fontFamily = font
      }),
      updateFont: (updates) => set((state) => {
        if (updates.fontSize !== undefined) state.fontSize = updates.fontSize
        if (updates.fontFamily !== undefined) state.fontFamily = updates.fontFamily
      })
    })
  )
}
