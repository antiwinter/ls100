import { useEffect, useCallback, useState, useRef } from 'react'
import { Box, Typography, Stack, Chip, Button } from '@mui/joy'
import ViewerSkeleton from './ViewerSkeleton.jsx'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { useSync } from './sync.js'
import { OverlayManager } from '../../../components/overlay/index.jsx'
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
    initWordlist, toggleWord, setHint
  } = sessionStore()

  // Settings from store
  const { fontSize, fontFamily } = useSettingStore('subtitle-shard')()
  const viewerRef = useRef(null)
  const overlayRef = useRef(null)

  // Local state for viewer
  const [viewerAnchored, setViewerAnchored] = useState(0)
  const [positionLoaded, setPositionLoaded] = useState(false)
  const [seek, setSeek] = useState(0)

  // Setup sync loop with store state
  const { syncNow } = useSync(shardId, wordlist, position, 10000)

  // log.debug('READER re-render', { position })
  const [hintTrigger, setHintTrigger] = useState(0)

  const handleEmptyClick = useCallback(() => {
    // log.debug('handleEmptyClick')

    // Trigger hint saving side effect
    setHintTrigger(prev => prev + 1)

    // If any overlay is open, close them all; otherwise show toolbar
    overlayRef.current?.toggleTools()
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
  const showViewer = canRenderViewer && viewerAnchored === 2

  // Side effect for saving hint (triggered by handleEmptyClick)
  useEffect(() => {
    if (hintTrigger === 0) return

    // Save hint to session store
    if (groups && groups.length > 0 && position >= 0 && position < groups.length) {
      const g = groups[position]
      if (!g) return

      const sec = g.sec || 0
      const mainText = g.main?.[0]?.data?.text || ''
      const hint = `${sec} - ${mainText}`
      setHint(hint)
    }
  }, [hintTrigger, groups, position, setHint])

  // Helper to create merged group context
  const mergeGroup = useCallback((word, groups) => {
    const main = []
    const refs = new Map()

    groups.forEach(group => {
      main.push(...(group.main || []))

      if (group.refs) {
        for (const [code, lines] of group.refs.entries()) {
          if (!refs.has(code)) refs.set(code, [])
          refs.get(code).push(...lines)
        }
      }
    })

    return {
      word,
      sec: groups[0]?.sec || 0,
      main,
      refs
    }
  }, [])

  // UI Event Handlers
  const explainWord = useCallback((word, pos, gid = 1) => {
    if (!groups || !groups.length) return

    // Always get 3 adjacent groups: 0->[0,1,2], 1->[0,1,2], 2->[1,2,3]
    const start = Math.max(0, Math.min(gid - 1, groups.length - 3))
    const ctx = mergeGroup(word, groups.slice(start, start + 3))
    const position = pos < window.innerHeight / 2 ? 'bottom' : 'top'
    overlayRef.current?.toggleTools(ctx, position)
  }, [groups, mergeGroup])

  // Reset anchored flag when shard/seek changes
  useEffect(() => { setViewerAnchored(0) }, [shardId, seek])

  const handleAnchored = useCallback((ready) => {
    log.debug('READER handleAnchored', ready)
    setViewerAnchored(ready)
  }, [])

  // log.debug('READER render state', {
  //   groupReady, positionLoaded, canRenderViewer, position, seek
  // })

  // Flush on unmount
  useEffect(() => {
    return () => { syncNow() }
  }, [syncNow])

  // Handle word events with store handlers
  const handleWordEvent = useCallback((word, type, pos, gid) => {
    log.debug('handleWordEvent', { word, type, pos, gid })
    if (type === 'long') {
      toggleWord(word) // From session store
    } else {
      explainWord(word, pos, gid) // From UI store
    }
  }, [toggleWord, explainWord])

  // Update viewer when state changes
  useEffect(() => {
    // log.debug('READER useEffect wordlist', { wordlist })
    viewerRef.current?.setWordlist(wordlist)
  }, [wordlist, viewerAnchored])

  useEffect(() => {
    viewerRef.current?.setLangMap(langMap)
  }, [langMap, viewerAnchored])

  useEffect(() => {
    viewerRef.current?.setFont({ fontSize, fontFamily })
  }, [fontSize, fontFamily, viewerAnchored])

  // Handle review click (placeholder)
  const handleReviewClick = () => {
    // TODO: Implement review feature
  }

  const handleGroupChange = useCallback((idx) => {
    // log.debug('READER handleGroupChange', { idx })
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
        shardId={shardId}
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
  const { setLangMap, setShardName } = sessionStore()

  // Load shard and initialize langMap in session store
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiCall(`/api/shards/${shardId}`)
        if (!alive) return
        setShard(data.shard || null)

        // Save shard name to session store
        if (data.shard?.name) {
          setShardName(data.shard.name)
        }

        // Initialize langMap in session store from shard languages
        const languages = data.shard?.data?.languages || []
        const current = sessionStore.getState().langMap || {} // Get existing persisted state
        const newLangMap = {} // Create fresh object

        languages.forEach(l => {
          // Copy existing entry if it exists, otherwise create new one
          const existing = current[l.code]
          newLangMap[l.code] = existing
            ? { ...existing, filename: l.filename, isMain: l.isMain }
            : { filename: l.filename, visible: false, isMain: l.isMain } // New entry
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
  }, [shardId, setLangMap, setShardName, sessionStore])

  return <SubtitleReaderContent shard={shard} shardId={shardId} loading={loading} onBack={onBack} />
}
