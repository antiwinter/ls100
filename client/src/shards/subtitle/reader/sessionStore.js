import { getStore } from '../../../stores/factory'

export const SubtitleSessionStore = (shardId) => {
  if (!shardId) throw new Error('shardId is required for SubtitleSessionStore')
  return getStore(
    { topic: 'subtitle-session', shardId },
    (set, _get) => ({
      langMap: {},
      setLangMap: (langMap) => set((state) => {
        state.langMap = langMap instanceof Map ? Object.fromEntries(langMap) : langMap
      }),
      toggleLang: (code) => set((state) => {
        if (state.langMap[code]) {
          state.langMap[code].visible = !state.langMap[code].visible
        }
      }),
      position: 0,
      setPosition: (idx) => set((state) => { state.position = idx }),
      shardName: '',
      setShardName: (name) => set((state) => { state.shardName = name }),
      totalGroups: 0,
      setTotalGroups: (count) => set((state) => { state.totalGroups = count }),
      wordlist: [],
      initWordlist: (words) => set((state) => {
        state.wordlist = words instanceof Set ? Array.from(words) : (words || [])
      }),
      toggleWord: (word, check = 0) => set((state) => {
        const idx = state.wordlist.indexOf(word)
        if (idx >= 0 && !check) state.wordlist.splice(idx, 1)
        else state.wordlist.push(word)
      }),
      clearWordlist: () => set((state) => { state.wordlist = [] }),
      bookmarks: [],
      bookmarksLoaded: false,
      initBookmarks: (bookmarks) => set((state) => {
        state.bookmarks = bookmarks || []
        state.bookmarksLoaded = true
      }),
      addBookmark: (bookmark) => set((state) => {
        const newBookmark = {
          gid: bookmark.gid,
          sec: bookmark.sec || 0,
          line: bookmark.line || '',
          timestamp: bookmark.timestamp || new Date().toISOString()
        }
        state.bookmarks.push(newBookmark)
      }),
      removeBookmark: (gid) => set((state) => {
        const idx = state.bookmarks.findIndex(b => b.gid === gid)
        if (idx >= 0) state.bookmarks.splice(idx, 1)
      }),
      updateBookmark: (gid, updates) => set((state) => {
        const bookmark = state.bookmarks.find(b => b.gid === gid)
        if (bookmark) Object.assign(bookmark, updates)
      }),
      clearBookmarks: () => set((state) => { state.bookmarks = [] }),
      hint: '',
      setHint: (hint) => set(() => ({ hint })),
      searchResults: [],
      searchQuery: '',
      setSearchResults: (results) => set(() => ({ searchResults: results || [] })),
      setSearchQuery: (query) => set(() => ({ searchQuery: query || '' }))
    }),
    {
      partialize: (state) => {
        const { hint: _h, searchResults: _sr, searchQuery: _sq, ...persisted } = state
        return persisted
      }
    }
  )
}

export default { SubtitleSessionStore }


