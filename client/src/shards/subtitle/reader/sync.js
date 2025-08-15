import { useRef, useCallback, useEffect } from 'react'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'

// General reader sync: words + index in one 10s loop (auto-baseline)
// index is 0-based current group index
export const useSync = (shardId, words, index, intervalMs = 10000) => {
  const wordsRef = useRef(new Set())
  const lastWordsRef = useRef(new Set())
  const syncingRef = useRef(false)
  const timerRef = useRef(null)
  const wordsReadyRef = useRef(false)
  const indexRef = useRef(0)
  const lastIndexRef = useRef(0)
  const indexReadyRef = useRef(false)

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

  const diff = useCallback((current, last) => {
    const adds = []
    const rems = []
    current.forEach(w => { if (!last.has(w)) adds.push(w) })
    last.forEach(w => { if (!current.has(w)) rems.push(w) })
    return { adds, rems }
  }, [])

  const doSync = useCallback(async () => {
    if (!shardId || syncingRef.current) return
    const curWords = wordsRef.current
    const curIndex = Number.isFinite(indexRef.current) ? indexRef.current : 0
    const { adds, rems } = curWords ? diff(curWords, lastWordsRef.current) : { adds: [], rems: [] }
    const indexChanged = indexReadyRef.current && curIndex !== lastIndexRef.current
    const needWords = wordsReadyRef.current && (adds.length || rems.length)
    if (!needWords && !indexChanged) return

    syncingRef.current = true
    try {
      if (needWords) {
        log.debug('sync words payload', { shardId, additions: adds, removals: rems })
        await apiCall(`/api/subtitle-shards/${shardId}/words`, {
          method: 'PUT',
          body: JSON.stringify({ additions: adds, removals: rems })
        })
        lastWordsRef.current = new Set(curWords)
      }
      if (indexChanged) {
        log.debug('sync position payload', { shardId, position: curIndex })
        await apiCall(`/api/subtitle-shards/${shardId}/position`, {
          method: 'PUT',
          body: JSON.stringify({ position: curIndex })
        })
        lastIndexRef.current = curIndex
      }
    } catch (e) {
      log.error('sync failed', e)
    } finally {
      syncingRef.current = false
    }
  }, [shardId, diff])

  useEffect(() => {
    wordsReadyRef.current = false
    lastWordsRef.current = new Set()
    indexReadyRef.current = false
    lastIndexRef.current = 0
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

  const syncNow = useCallback(() => { doSync() }, [doSync])

  return { syncNow }
}


