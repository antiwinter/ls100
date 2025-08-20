import { useEffect, useCallback, useState, useRef } from 'react'
import { Box, Typography, Stack, Chip, Button } from '@mui/joy'
import ViewerSkeleton from './ViewerSkeleton.jsx'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { useSync } from './sync.js'
import { OverlayManager } from '../../../components/overlay/OverlayManager.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'
import { useSubtitleGroups } from './hooks/useSubtitleGroups.js'
import { useSessionStore } from '../../../components/overlay/stores/useSessionStore.js'
import { useSettingStore } from '../../../components/overlay/stores/useSettingStore.js'

const SubtitleHeader = ({ shardName, position, total, onReviewClick }) => {
  const [totalGroups, setTotalGroups] = useState(0)

  // Update totalGroups when total changes
  useEffect(() => {
    setTotalGroups(total)
  }, [total])

  return (
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
          onClick={onReviewClick}
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
        {position + 1}/{totalGroups}
      </Typography>
    </Stack>
  )
}

const SubtitleReaderContent = ({ shard, shardId, onBack, loading }) => {
  // Session store and state
  // log.debug('SUBTITLE READER RENDER', shard, shardId)
  const sessionStore = useSessionStore(shardId)
  const {
    position, wordlist, langMap, setPosition,
    initWordlist, toggleWord
  } = sessionStore()

  // Settings from store
  const { fontSize, fontFamily } = useSettingStore('subtitle-shard')()
  const viewerRef = useRef(null)
  const overlayRef = useRef(null)

  // Local state for viewer
  const [viewerAnchored, setViewerAnchored] = useState(false)
  const [positionLoaded, setPositionLoaded] = useState(false)
  const [seek, setSeek] = useState(0)

  // Setup sync loop with store state
  const { syncNow } = useSync(shardId, wordlist, position, 10000)

  // log.debug('READER re-render', { position })

  // UI Event Handlers
  const explainWord = useCallback((word, pos) => {
    const position = pos < window.innerHeight / 2 ? 'bottom' : 'top'
    // toggleWord(word, 1) // From session store
    overlayRef.current?.toggleDict(word, position)
  }, [])

  const handleEmptyClick = useCallback(() => {
    log.debug('handleEmptyClick')
    // If any overlay is open, close them all; otherwise show toolbar
    overlayRef.current?.toggleDict()
  }, [])

  // Load selected words and position (mount + shard change)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/words`)
        const words = data.words || []
        if (!alive) return
        initWordlist(words)
        log.debug(`📝 Loaded ${words.length} selected words`)
      } catch (error) {
        log.error('Failed to load selected words:', error)
      }
    })()
    ;(async () => {
      try {
        // Check if position exists in store first
        let pos = sessionStore.getState().position
        if (!pos) {
          // Fetch from backend if not in store
          const data = await apiCall(`/api/subtitle-shards/${shardId}/position`)
          pos = data?.position || 0
          log.debug('Loaded position from backend:', pos)
        } else {
          log.debug('Using position from store:', pos)
        }

        if (!alive) return
        setSeek(pos)
        setPositionLoaded(true)
      } catch (error) {
        log.error('Failed to load position:', error)
        // Set default position if backend fails
        if (!alive) return
        setSeek(0)
        setPositionLoaded(true)
      }
    })()

    return () => { alive = false }
  }, [shardId, initWordlist, setPosition, sessionStore, setSeek])

  // Use languages directly from shard data
  const languages = shard?.data?.languages || []

  // Load lines and groups
  const { groups, total, loading: groupsLoading } = useSubtitleGroups(languages)
  const groupReady = !groupsLoading && (groups?.length || 0) > 0
  const canRenderViewer = groupReady && positionLoaded
  const showViewer = canRenderViewer && viewerAnchored

  // Reset anchored flag when shard/seek changes
  useEffect(() => { setViewerAnchored(false) }, [shardId, seek])

  const handleAnchored = useCallback(() => setViewerAnchored(true), [])

  // log.debug('READER render state', {
  //   groupReady, positionLoaded, canRenderViewer, position, seek
  // })

  // Flush on unmount
  useEffect(() => {
    return () => { syncNow() }
  }, [syncNow])

  // Handle word events with store handlers
  const handleWordEvent = useCallback((word, type, pos) => {
    log.info('SubtitleReader:handleWordEvent received', { word, type, pos })
    log.debug('handleWordEvent', { word, type, pos })
    if (type === 'long') {
      toggleWord(word) // From session store
    } else {
      explainWord(word, pos) // From UI store
    }
  }, [toggleWord, explainWord])

  // Update viewer when state changes
  useEffect(() => {
    viewerRef.current?.setWordlist(wordlist)
  }, [wordlist])

  useEffect(() => {
    viewerRef.current?.setLangMap(langMap)
  }, [langMap])

  useEffect(() => {
    viewerRef.current?.setFont({ fontSize, fontFamily })
  }, [fontSize, fontFamily])

  // Handle review click (placeholder)
  const handleReviewClick = () => {
    // TODO: Implement review feature
  }

  const handleGroupChange = useCallback((idx) => {
    setPosition(idx)
    overlayRef.current?.closeTools()
  }, [setPosition])

  const shardName = shard?.name || ''
  if (loading) {
    return null
  }
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
      <SubtitleHeader
        shardName={shardName}
        position={position}
        total={total}
        onReviewClick={handleReviewClick}
      />

      {/* OverlayManager - local state management */}
      <OverlayManager
        ref={overlayRef}
        onBack={onBack}
        sessionStore={sessionStore}
        wordlist={wordlist}
        movieName={shardName}
        shardId={shardId}
        currentLine={(position || 0) + 1}
        lines={groups || []}
      />

      {/* SubtitleViewer - render after groups and position ready */}
      <Box sx={{ position: 'relative', flex: 1 }}>
        <Box sx={{ visibility: showViewer ? 'visible' : 'hidden', height: '100%', display: 'flex' }}>
          {canRenderViewer && (
            <SubtitleViewer
              ref={viewerRef}
              groups={groups}
              seek={seek}
              onWord={handleWordEvent}
              onEmptyClick={handleEmptyClick}
              onGroupChange={handleGroupChange}
              onAnchored={handleAnchored}
            />
          )}
        </Box>
        {!showViewer && (
          <Box sx={{ position: 'absolute', inset: 0 }}>
            <ViewerSkeleton />
          </Box>
        )}
      </Box>
    </Box>
  )
}

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const sessionStore = useSessionStore(shardId)
  const { setLangMap } = sessionStore()

  // Load shard and initialize langMap in session store
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiCall(`/api/shards/${shardId}`)
        if (!alive) return
        setShard(data.shard || null)

        // Initialize langMap in session store from shard languages
        const languages = data.shard?.data?.languages || []
        const current = sessionStore.getState().langMap || {} // Get existing persisted state
        const newLangMap = {} // Create fresh object

        languages.filter(l => !l.isMain).forEach(l => {
          // Copy existing entry if it exists, otherwise create new one
          const existing = current[l.code]
          newLangMap[l.code] = existing
            ? { ...existing, filename: l.filename } // Update filename, preserve visibility
            : { filename: l.filename, visible: false } // New entry
        })
        setLangMap(newLangMap)
        setLoading(false)
      } catch (error) {
        log.error('Failed to load shard:', error)
        if (!alive) return
        setShard(null)
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [shardId, setLangMap, sessionStore])

  return <SubtitleReaderContent shard={shard} shardId={shardId} loading={loading} onBack={onBack} />
}
