import { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import { Box, Typography, Stack, Chip, Button } from '@mui/joy'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { useSync } from './sync.js'
import { OverlayManager } from './overlay/OverlayManager.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'
import { useSubtitleGroups } from './hooks/useSubtitleGroups.js'
import { ReaderStateProvider, useReaderState } from './overlay/useTraceState.jsx'
import { OverlayUIProvider, useOverlayUI } from './overlay/useUiState.jsx'

const SubtitleReaderContent = ({ shard, shardId, onBack }) => {
  // Content state from ReaderStateContext
  const {
    position, selectedWords,
    setPositionCurrent, setSeek, setTotal, setSelectedWordsFromArray,
    handleWordLong
  } = useReaderState()
  const viewerRef = useRef(null)
  // UI events from OverlayUIContext
  const { handleWordShort, handleEmptyClick, handleScroll } = useOverlayUI()

  // Setup sync loop with context state (Option A - safer)
  const { syncNow } = useSync(shardId, selectedWords, position.current, 10000)

  log.warn('READER re-render', { position })

  // Load selected words and position (mount + shard change)
  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/words`)
        const words = data.words || []
        if (!alive) return
        setSelectedWordsFromArray(words) // Context action
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
        setSeek(pos) // Context action
      } catch (error) {
        log.error('Failed to load position:', error)
      }
    })()

    return () => { alive = false }
  }, [shardId, setSelectedWordsFromArray, setSeek])

  // Use languages directly from shard data
  const languages = shard?.data?.languages || []

  // Load lines and groups
  const { groups, total } = useSubtitleGroups(languages)
  useEffect(() => {
    setTotal(total) // Context action
  }, [total, setTotal])

  // Flush on unmount
  useEffect(() => {
    return () => { syncNow() }
  }, [syncNow])

  // Handle word events with context handlers
  const handleWordEvent = useCallback((word, type, pos) => {
    if (type === 'long') {
      handleWordLong(word) // From ReaderStateContext
    } else {
      handleWordShort(word, pos) // From OverlayUIContext
    }
  }, [handleWordLong, handleWordShort])

  useEffect(() => {
    log.warn('READER useEffect', { selectedWords })
    viewerRef.current?.setWordlist(selectedWords)
  }, [selectedWords])

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
            // startDecorator={<Bolt sx={{ fontSize: '16px', mr: -0.5 }} />}
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

      {/* OverlayManager - consumes OverlayUIContext */}
      <OverlayManager onBack={onBack} />

      {/* SubtitleViewer - consumes both contexts */}
      <SubtitleViewer ref={viewerRef}
        groups={groups}
        onWord={handleWordEvent}
        // position={position.seek}
        onEmptyClick={handleEmptyClick}
        onScroll={handleScroll}
        onCurrentGroupChange={setPositionCurrent} // Context action
      />
    </Box>
  )
}

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)

  // Load shard first to get languages for UI provider
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

  // Convert languages to langMap (shard-specific to our standard)
  const langMap = useMemo(() => {
    const languages = shard?.data?.languages || []
    const map = new Map()
    languages.filter(l => !l.isMain).forEach(l => {
      map.set(l.code, { filename: l.filename, visible: true })
    })
    return map
  }, [shard?.data?.languages])

  return (
    <ReaderStateProvider>
      <OverlayUIProvider langMap={langMap}>
        <SubtitleReaderContent shard={shard} shardId={shardId} onBack={onBack} />
      </OverlayUIProvider>
    </ReaderStateProvider>
  )
}
