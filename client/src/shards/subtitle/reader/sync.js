import { useRef, useCallback, useEffect } from 'react'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'

// General reader sync: words + position in one 10s loop
export const useSync = (shardId, wordsRef, lineRef, intervalMs = 10000) => {
  const lastWordsRef = useRef(new Set())
  const syncingRef = useRef(false)
  const timerRef = useRef(null)
  const wordsReadyRef = useRef(false)
  const lastLineRef = useRef(0)
  const lineReadyRef = useRef(false)

  const diff = useCallback((current, last) => {
    const adds = []
    const rems = []
    current.forEach(w => { if (!last.has(w)) adds.push(w) })
    last.forEach(w => { if (!current.has(w)) rems.push(w) })
    return { adds, rems }
  }, [])

  const doSync = useCallback(async () => {
    if (!shardId || syncingRef.current) return
    const curWords = wordsRef?.current
    const curLine = lineRef?.current || 0
    const { adds, rems } = curWords ? diff(curWords, lastWordsRef.current) : { adds: [], rems: [] }
    const lineChanged = lineReadyRef.current && curLine !== lastLineRef.current
    const needWords = wordsReadyRef.current && (adds.length || rems.length)
    if (!needWords && !lineChanged) return

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
      if (lineChanged) {
        log.debug('sync position payload', { shardId, position: curLine })
        await apiCall(`/api/subtitle-shards/${shardId}/position`, {
          method: 'PUT',
          body: JSON.stringify({ position: curLine })
        })
        lastLineRef.current = curLine
      }
    } catch (e) {
      log.error('sync failed', e)
    } finally {
      syncingRef.current = false
    }
  }, [shardId, wordsRef, lineRef, diff])

  useEffect(() => {
    wordsReadyRef.current = false
    lastWordsRef.current = new Set()
    lineReadyRef.current = false
    lastLineRef.current = 0
  }, [shardId])

  useEffect(() => {
    timerRef.current = setInterval(() => { doSync() }, intervalMs)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [doSync, intervalMs])

  const ackWords = useCallback(() => {
    if (!wordsRef?.current) return
    lastWordsRef.current = new Set(wordsRef.current)
    wordsReadyRef.current = true
    log.debug('words baseline ack', { count: lastWordsRef.current.size, shardId })
  }, [wordsRef, shardId])

  const ackPosition = useCallback((line) => {
    const normalized = Number.isFinite(line) ? line : 0
    lastLineRef.current = normalized
    lineReadyRef.current = true
  }, [])

  const syncNow = useCallback(() => { doSync() }, [doSync])

  return { ackWords, ackPosition, syncNow }
}


