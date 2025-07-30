import { useRef, useCallback } from 'react'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'

// Debounced word selection sync worker
export const useWordSync = (shardId) => {
  const syncQueue = useRef({ additions: [], removals: [] })
  const syncTimer = useRef(null)
  const issyncing = useRef(false)

  // Debounced sync function
  const sync = useCallback(async () => {
    if (issyncing.current || !shardId) return
    
    const { additions, removals } = syncQueue.current
    if (additions.length === 0 && removals.length === 0) return

    issyncing.current = true
    
    try {
      await apiCall(`/api/subtitle-shards/${shardId}/words`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additions, removals })
      })
      
      // Clear queue on success
      syncQueue.current = { additions: [], removals: [] }
      log.debug('Word selection synced:', { additions: additions.length, removals: removals.length })
    } catch (error) {
      log.error('Failed to sync word selection:', error)
      // TODO: Implement retry logic with exponential backoff
    } finally {
      issyncing.current = false
    }
  }, [shardId])

  // Queue word addition
  const queueAdd = useCallback((word) => {
    // Remove from removals if it was there
    syncQueue.current.removals = syncQueue.current.removals.filter(w => w !== word)
    
    // Add to additions if not already there
    if (!syncQueue.current.additions.includes(word)) {
      syncQueue.current.additions.push(word)
    }
    
    // Debounce sync
    if (syncTimer.current) {
      clearTimeout(syncTimer.current)
    }
    syncTimer.current = setTimeout(sync, 2000)
  }, [sync])

  // Queue word removal
  const queueRemove = useCallback((word) => {
    // Remove from additions if it was there
    syncQueue.current.additions = syncQueue.current.additions.filter(w => w !== word)
    
    // Add to removals if not already there
    if (!syncQueue.current.removals.includes(word)) {
      syncQueue.current.removals.push(word)
    }
    
    // Debounce sync
    if (syncTimer.current) {
      clearTimeout(syncTimer.current)
    }
    syncTimer.current = setTimeout(sync, 2000)
  }, [sync])

  // Force immediate sync
  const forcSync = useCallback(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current)
    }
    sync()
  }, [sync])

  return { queueAdd, queueRemove, forcSync }
}