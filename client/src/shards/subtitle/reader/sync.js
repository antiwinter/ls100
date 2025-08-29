import { useRef, useCallback, useEffect } from 'react'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'

// General reader sync: words + index + bookmarks in one 10s loop (auto-baseline)
// index is 0-based current group index
export const useSync = (shardId, words, index, bookmarks, intervalMs = 10000, options = {}) => {
  const { bookmarksLoaded = false } = options
  const wordsRef = useRef(new Set())
  const lastWordsRef = useRef(new Set())
  const syncingRef = useRef(false)
  const timerRef = useRef(null)
  const wordsReadyRef = useRef(false)
  const indexRef = useRef(0)
  const lastIndexRef = useRef(0)
  const indexReadyRef = useRef(false)
  const bookmarksRef = useRef([])
  const lastBookmarksRef = useRef([])
  const bookmarksReadyRef = useRef(false)

  // keep internal ref updated without forcing re-subscriptions
  useEffect(() => {
    if (words instanceof Set) {
      wordsRef.current = words
    } else {
      wordsRef.current = new Set(words || [])
    }
  }, [words])

  // keep index current; baseline on first observe
  useEffect(() => {
    const normalized = Number.isFinite(index) ? index : 0
    // Always keep latest index in a ref so interval doesn't need to be recreated
    indexRef.current = normalized
    if (!indexReadyRef.current) {
      lastIndexRef.current = normalized
      indexReadyRef.current = true
    }
  }, [index])

  // keep bookmarks current; baseline on first observe
  useEffect(() => {
    bookmarksRef.current = Array.isArray(bookmarks) ? bookmarks : []
  }, [bookmarks])

  const diff = useCallback((current, last) => {
    const adds = []
    const rems = []
    current.forEach(w => { if (!last.has(w)) adds.push(w) })
    last.forEach(w => { if (!current.has(w)) rems.push(w) })
    return { adds, rems }
  }, [])

  const diffBookmarks = useCallback((current, last) => {
    const additions = current.filter(b => !last.find(l => l.gid === b.gid))
    const removals = last.filter(b => !current.find(c => c.gid === b.gid))
    const updates = current.filter(b => {
      const old = last.find(l => l.gid === b.gid)
      return old && (
        old.sec !== b.sec || old.line !== b.line
      )
    })
    log.debug('diff bookmarks', { last, current, additions, removals, updates })
    return { additions, removals, updates }
  }, [])

  const doSync = useCallback(async () => {
    if (!shardId || syncingRef.current) return
    const curWords = wordsRef.current
    const curIndex = Number.isFinite(indexRef.current) ? indexRef.current : 0
    const curBookmarks = bookmarksRef.current
    const { adds, rems } = curWords ? diff(curWords, lastWordsRef.current) : { adds: [], rems: [] }
    const { additions, removals, updates } = bookmarksReadyRef.current ?
      diffBookmarks(curBookmarks, lastBookmarksRef.current) :
      { additions: [], removals: [], updates: [] }
    const indexChanged = indexReadyRef.current && curIndex !== lastIndexRef.current
    const needWords = wordsReadyRef.current && (adds.length || rems.length)
    const needBookmarks = bookmarksReadyRef.current &&
      (additions.length || removals.length || updates.length)
    if (!needWords && !indexChanged && !needBookmarks) return

    syncingRef.current = true
    try {
      if (needWords) {
        log.trace('sync words payload', { shardId, additions: adds, removals: rems })
        await apiCall(`/api/subtitle-shards/${shardId}/words`, {
          method: 'PUT',
          body: JSON.stringify({ additions: adds, removals: rems })
        })
        lastWordsRef.current = new Set(curWords)
      }
      if (indexChanged) {
        log.trace('sync position payload', { shardId, position: curIndex })
        await apiCall(`/api/subtitle-shards/${shardId}/position`, {
          method: 'PUT',
          body: JSON.stringify({ position: curIndex })
        })
        lastIndexRef.current = curIndex
      }
      if (needBookmarks) {
        // Sync bookmark additions
        if (additions.length > 0) {
          for (const bookmark of additions) {
            log.debug('sync bookmark addition', { shardId, bookmark })
            await apiCall(`/api/subtitle-shards/${shardId}/bookmarks`, {
              method: 'POST',
              body: JSON.stringify({
                gid: bookmark.gid,
                sec: bookmark.sec,
                line: bookmark.line
              })
            })
          }
        }
        // Sync bookmark removals (batch)
        if (removals.length > 0) {
          log.trace('sync bookmark removals', { shardId, count: removals.length })
          await apiCall(`/api/subtitle-shards/${shardId}/bookmarks`, {
            method: 'DELETE',
            body: JSON.stringify({ gids: removals.map(b => b.gid) })
          })
        }
        // Sync bookmark updates (batch)
        if (updates.length > 0) {
          log.trace('sync bookmark updates', { shardId, count: updates.length })
          await apiCall(`/api/subtitle-shards/${shardId}/bookmarks`, {
            method: 'PUT',
            body: JSON.stringify({
              updates: updates.map(b => ({
                gid: b.gid,
                sec: b.sec,
                line: b.line
              }))
            })
          })
        }
        lastBookmarksRef.current = [...curBookmarks]
      }
    } catch (e) {
      log.error('sync failed', e)
    } finally {
      syncingRef.current = false
    }
  }, [shardId, diff, diffBookmarks])

  useEffect(() => {
    wordsReadyRef.current = false
    lastWordsRef.current = new Set()
    indexReadyRef.current = false
    lastIndexRef.current = 0
    bookmarksReadyRef.current = false
    lastBookmarksRef.current = []
  }, [shardId])

  useEffect(() => {
    const id = setInterval(() => { doSync() }, intervalMs)
    timerRef.current = id
    return () => { clearInterval(id) }
  }, [doSync, intervalMs])

  // Auto-baseline words on first observe
  useEffect(() => {
    if (!wordsReadyRef.current) {
      lastWordsRef.current = new Set(wordsRef.current)
      wordsReadyRef.current = true
      log.debug('words baseline auto-ack', { count: lastWordsRef.current.size, shardId })
    }
  }, [shardId, words])

  // Auto-baseline bookmarks only after initial load is complete
  useEffect(() => {
    if (!bookmarksReadyRef.current && bookmarksLoaded) {
      lastBookmarksRef.current = [...bookmarksRef.current]
      bookmarksReadyRef.current = true
      log.debug('bookmarks baseline auto-ack', { count: lastBookmarksRef.current.length, shardId })
    }
  }, [shardId, bookmarks, bookmarksLoaded])

  const syncNow = useCallback(() => { doSync() }, [doSync])

  return { syncNow }
}


