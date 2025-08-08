import { useRef, useCallback, useEffect } from 'react'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'

// Simple 10s loop sync comparing current Set with last copy
export const useWordSync = (shardId, selectedRef, intervalMs = 10000) => {
  const lastRef = useRef(new Set())
  const syncingRef = useRef(false)
  const timerRef = useRef(null)
  const readyRef = useRef(false) // prevent initial re-upload until baseline is acked

  const diff = useCallback((current, last) => {
    const adds = []
    const rems = []
    current.forEach(w => { if (!last.has(w)) adds.push(w) })
    last.forEach(w => { if (!current.has(w)) rems.push(w) })
    return { adds, rems }
  }, [])

  const doSync = useCallback(async () => {
    if (!shardId || syncingRef.current || !selectedRef?.current || !readyRef.current) return

    const cur = selectedRef.current
    const { adds, rems } = diff(cur, lastRef.current)
    if (adds.length === 0 && rems.length === 0) return

    syncingRef.current = true
    try {
      log.debug('sync PUT payload', { shardId, additions: adds, removals: rems })
      await apiCall(`/api/subtitle-shards/${shardId}/words`, {
        method: 'PUT',
        body: JSON.stringify({ additions: adds, removals: rems })
      })
      lastRef.current = new Set(cur)
      log.debug('words synced', { adds: adds.length, rems: rems.length })
    } catch (e) {
      log.error('sync words failed', e)
    } finally {
      syncingRef.current = false
    }
  }, [shardId, selectedRef, diff])

  useEffect(() => {
    // reset readiness on shard change
    readyRef.current = false
    lastRef.current = new Set()
  }, [shardId])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      doSync()
    }, intervalMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [doSync, intervalMs])

  const ackBaseline = useCallback(() => {
    if (!selectedRef?.current) return
    lastRef.current = new Set(selectedRef.current)
    readyRef.current = true
    log.debug('word sync baseline acknowledged', { count: lastRef.current.size, shardId })
  }, [selectedRef])

  const syncNow = useCallback(() => {
    doSync()
  }, [doSync])

  return { ackBaseline, syncNow }
}