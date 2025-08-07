import { useRef, useCallback } from 'react'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'

// Debounced word selection sync worker
export const useWordSync = (shardId, selectedWordsRef) => {
  const syncQueue = useRef({ additions: [], removals: [] })
  const syncTimer = useRef(null)
  const issyncing = useRef(false)
  const lastSyncedState = useRef(new Set()) // Track last synced state

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
      
      // Update last synced state to current Set state
      if (selectedWordsRef?.current) {
        lastSyncedState.current = new Set(selectedWordsRef.current)
      }
      
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

  // Sync current Set state to backend
  const syncFromSet = useCallback(() => {
    if (!selectedWordsRef?.current) return
    
    const currentWords = selectedWordsRef.current
    const lastSynced = lastSyncedState.current
    
    // Calculate additions and removals
    const additions = [...currentWords].filter(word => !lastSynced.has(word))
    const removals = [...lastSynced].filter(word => !currentWords.has(word))
    
    if (additions.length === 0 && removals.length === 0) return
    
    // Update sync queue
    syncQueue.current = { additions, removals }
    
    // Debounce sync
    if (syncTimer.current) {
      clearTimeout(syncTimer.current)
    }
    syncTimer.current = setTimeout(sync, 2000)
  }, [selectedWordsRef, sync])

  // Compare current Set with last synced state and sync if changed
  const checkAndSync = useCallback(() => {
    if (!selectedWordsRef?.current) return
    
    const currentWords = selectedWordsRef.current
    const lastSynced = lastSyncedState.current
    
    // Compare sets - check if they're different
    if (currentWords.size !== lastSynced.size) {
      syncFromSet()
      return
    }
    
    // Same size, check contents
    for (const word of currentWords) {
      if (!lastSynced.has(word)) {
        syncFromSet()
        return
      }
    }
    
    // Sets are identical, skip sync
  }, [selectedWordsRef, syncFromSet])

  // Legacy queue methods (for compatibility, but trigger Set-based sync)
  const queueAdd = useCallback(() => {
    // Trigger immediate check and sync from Set
    setTimeout(checkAndSync, 0)
  }, [checkAndSync])

  const queueRemove = useCallback(() => {
    // Trigger immediate check and sync from Set
    setTimeout(checkAndSync, 0)
  }, [checkAndSync])

  // Force immediate sync
  const forcSync = useCallback(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current)
    }
    sync()
  }, [sync])

  return { queueAdd, queueRemove, forcSync, checkAndSync }
}