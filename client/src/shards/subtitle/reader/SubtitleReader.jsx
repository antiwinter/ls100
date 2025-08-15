import { useEffect, useCallback, useState, useRef } from 'react'
import { Box, Typography, Stack, Chip, Button } from '@mui/joy'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { useSync } from './sync.js'
import { OverlayManager } from './overlay/OverlayManager.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'
import { useSubtitleGroups } from './hooks/useSubtitleGroups.js'
import { useSessionStore } from './overlay/stores/useSessionStore'
import { useSettingStore } from './overlay/stores/useSettingStore'

const SubtitleReaderContent = ({ shard, shardId, onBack }) => {
  // Session store and state
  const {
    position, wordlist, langMap, setPosition,
    initWordlist, toggleWord, toggleLang
  } = useSessionStore(shardId)()

  // Settings from store
  const { fontSize, fontFamily } = useSettingStore('subtitle-shard')()
  const viewerRef = useRef(null)
  const overlayRef = useRef(null)
  const [totalGroups, setTotalGroups] = useState(0)

  // Setup sync loop with store state
  const { syncNow } = useSync(shardId, wordlist, position, 10000)

  log.warn('READER re-render', { position })

  // UI Event Handlers
  const explainWord = useCallback((word, pos) => {
    const position = pos < window.innerHeight / 2 ? 'bottom' : 'top'
    overlayRef.current?.openTool('dict', word, position)
  }, [])

  const handleEmptyClick = useCallback(() => {
    // If any overlay is open, close them all; otherwise show toolbar
    overlayRef.current?.closeAll()
  }, [])

  const handleScroll = useCallback(() => {
    overlayRef.current?.closeAll()
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
        const data = await apiCall(`/api/subtitle-shards/${shardId}/position`)
        const pos = data?.position || 0
        if (!alive) return
        setPosition(pos)
      } catch (error) {
        log.error('Failed to load position:', error)
      }
    })()

    return () => { alive = false }
  }, [shardId, initWordlist, setPosition])

  // Use languages directly from shard data
  const languages = shard?.data?.languages || []

  // Load lines and groups
  const { groups, total } = useSubtitleGroups(languages)
  useEffect(() => {
    setTotalGroups(total) // Context action
  }, [setTotalGroups, total])

  // Flush on unmount
  useEffect(() => {
    return () => { syncNow() }
  }, [syncNow])

  // Handle word events with store handlers
  const handleWordEvent = useCallback((word, type, pos) => {
    if (type === 'long') {
      toggleWord(word) // From session store
    } else {
      explainWord(word, pos) // From UI store
    }
  }, [toggleWord, explainWord])

  // Update viewer when state changes
  useEffect(() => {
    log.warn('READER useEffect', { wordlist })
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
          {position}/{totalGroups}
        </Typography>
      </Stack>

      {/* OverlayManager - local state management */}
      <OverlayManager ref={overlayRef} onBack={onBack} sessionStore={{ langMap, toggleLang }} />

      {/* SubtitleViewer - uses imperative API */}
      <SubtitleViewer ref={viewerRef}
        groups={groups}
        onWord={handleWordEvent}
        // position={position.seek}
        onEmptyClick={handleEmptyClick}
        onScroll={handleScroll}
        onCurrentGroupChange={setPosition}
      />
    </Box>
  )
}

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)
  const { setLangMap } = useSessionStore(shardId)()

  // Load shard and initialize langMap in session store
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiCall(`/api/shards/${shardId}`)
        if (!alive) return
        setShard(data.shard)

        // Initialize langMap in session store from shard languages
        const languages = data.shard?.data?.languages || []
        const langMap = {}
        languages.filter(l => !l.isMain).forEach(l => {
          langMap[l.code] = { filename: l.filename, visible: false }
        })
        setLangMap(langMap)
      } catch (error) {
        log.error('Failed to load shard:', error)
      }
    })()
    return () => { alive = false }
  }, [shardId, setLangMap])

  return <SubtitleReaderContent shard={shard} shardId={shardId} onBack={onBack} />
}
