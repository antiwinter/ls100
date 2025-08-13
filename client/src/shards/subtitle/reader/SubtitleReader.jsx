import { useEffect, useCallback, useState } from 'react'
import { Box, Typography, Stack, Chip, Button } from '@mui/joy'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { useSync } from './sync.js'
import { OverlayManager } from './overlay/OverlayManager.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'
import { useSubtitleGroups } from './hooks/useSubtitleGroups.js'
import { OverlayProvider, useOverlay } from './hooks/useOverlayContext.jsx'

const SubtitleReaderContent = ({ shardId, onBack }) => {
  // Core data state
  const [shard, setShard] = useState(null)
  const [position, setPosition] = useState({ current: 0, seek: null, total: 0 })
  const [selectedWords, setSelectedWords] = useState([])

  // All overlay logic from context
  const { 
    handleWordShort, handleEmptyClick, handleScroll
  } = useOverlay()

  // Word selection helper
  const toggleSelectedWord = useCallback((word) => {
    setSelectedWords(prev => {
      const exists = prev.includes(word)
      return exists ? prev.filter(w => w !== word) : [...prev, word]
    })
  }, [])

  // Override handleWordLong to include selection logic
  const handleWordLongWithSelection = useCallback((word) => {
    toggleSelectedWord(word)
  }, [toggleSelectedWord])

  // Setup sync loop (10s)
  const { syncNow } = useSync(shardId, new Set(selectedWords), position.current, 10000)
  
  // Load shard and selected words (mount + shard change)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiCall(`/api/shards/${shardId}`)
        if (!alive) return
        setShard(data.shard)
      } catch (error) {
        log.error('Failed to load shard:', error)
      }
    })()

    ;(async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/words`)
        const words = data.words || []
        if (!alive) return
        setSelectedWords(words)
        log.debug(`📝 Loaded ${words.length} selected words`)
      } catch (error) {
        log.error('Failed to load selected words:', error)
      }
    })()

    ;(async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/position`)
        const pos = data?.position || 0
        if (!alive) return
        setPosition(prev => ({ ...prev, seek: pos }))
      } catch (error) {
        log.error('Failed to load position:', error)
      }
    })()

    return () => { alive = false }
  }, [shardId])

  // Use languages directly from shard data
  const languages = shard?.data?.languages || []

  // Load lines and groups
  const { groups, total } = useSubtitleGroups(languages)
  useEffect(() => { 
    setPosition(prev => ({ ...prev, total })) 
  }, [total])

  // Flush on unmount
  useEffect(() => {
    return () => { syncNow() }
  }, [syncNow])

  // Handle word events with selection logic
  const handleWordEvent = useCallback((word, type, pos) => {
    if (type === 'long') {
      handleWordLongWithSelection(word)
    } else {
      handleWordShort(word, pos)
    }
  }, [handleWordLongWithSelection, handleWordShort])

  // Handle review click (placeholder)
  const handleReviewClick = () => {
    // TODO: Implement review feature
  }

  const shardName = shard?.name || ''  
  if (!shard) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="danger">Shard not found</Typography>
        <Button onClick={onBack} sx={{ mt: 2 }}>Go Back</Button>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header with Movie Name, Progress, and Review */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ 
          px: 1, 
          py: 0.5,
          bgcolor: 'background.body'
        }}
      >
        <Stack direction="row" alignItems="center">
          <Typography
            level="body-xs"
            color="neutral"
            sx={{
              opacity: 0.7,
              maxWidth: '110px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {shardName}
          </Typography>
          
          <Chip
            size="sm"
            color="secondary"
            variant='outlined'
            onClick={handleReviewClick}
            startDecorator={<Bolt sx={{ fontSize: '16px', mr: -0.5 }} />}
            sx={{ 
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600 !important',
              height: '15px',
              px: 1,
              ml: 1,
              minHeight: 'auto'
            }}
          >
            25
          </Chip>
        </Stack>

        <Typography level="body-xs" color="neutral" sx={{ opacity: 0.7 }}>
          {position.current}/{position.total}
        </Typography>
      </Stack>

      {/* OverlayManager - no props needed, consumes context directly */}
      <OverlayManager onBack={onBack} />

      {/* SubtitleViewer - no settings prop needed, consumes context directly */}
      <SubtitleViewer
        groups={groups}
        selectedWords={new Set(selectedWords)}
        position={position.seek}
        onWord={handleWordEvent}
        onEmptyClick={handleEmptyClick}
        onScroll={handleScroll}
        onCurrentGroupChange={(idx) => {
          setPosition(prev => ({ ...prev, current: idx }))
        }}
      />
    </Box>
  )
}

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)

  // Load shard first to get languages for provider
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiCall(`/api/shards/${shardId}`)
        if (!alive) return
        setShard(data.shard)
      } catch (error) {
        log.error('Failed to load shard:', error)
      }
    })()
    return () => { alive = false }
  }, [shardId])

  const languages = shard?.data?.languages || []

  return (
    <OverlayProvider languages={languages}>
      <SubtitleReaderContent shardId={shardId} onBack={onBack} />
    </OverlayProvider>
  )
}