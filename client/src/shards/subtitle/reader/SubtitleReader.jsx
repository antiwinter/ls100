import { useState, useEffect, useCallback, useMemo, useReducer } from 'react'
import { Box, Typography, LinearProgress, Stack, Chip } from '@mui/joy'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { useSync } from './sync.js'
import { OverlayManager } from './overlay/OverlayManager.jsx'
import { useSubtitleLines } from './hooks/useSubtitleLines.js'
import { useSubtitleGroups } from './hooks/useSubtitleGroups.js'
// UI managed inside OverlayManager; no useReaderUI here

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)
  const [currentGroup, setCurrentGroup] = useState(0)
  const [initialGroup, setInitialGroup] = useState(null)
  const [totalGroups, setTotalGroups] = useState(0)
  const [selectedWords, setSelectedWords] = useState(new Set())
  const [uiSettings, setSettings] = useState({ fontMode: 'sans', fontSize: 16, langSet: new Set() })
  const [showToolbar, setUiToolbar] = useState(false)
  const [toExplain, setExplainWordState] = useState(null)

  // setup general sync loop (10s)
  const { syncNow } = useSync(shardId, selectedWords, currentGroup, 10000)
  
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
      } finally {
        if (alive) setLoading(false)
      }
    })()

    ;(async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/words`)
        const words = data.words || []
        if (!alive) return
        const next = new Set(words)
        setSelectedWords(next)
        log.debug(`📝 Loaded ${words.length} selected words`)
        // baseline handled automatically in useSync
      } catch (error) {
        log.error('Failed to load selected words:', error)
      }
    })()

    const load = async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/position`)
         const position = data?.position || 0
        if (!alive) return
         // position baseline handled by useSync via index watcher
         if (position > 0) {
           setInitialGroup(position)
           setCurrentGroup(position)
         }
      } catch {
        // ignore
      }
    }
    // microtask to avoid double call loops on strict mode or remount
    Promise.resolve().then(() => alive && load())

    return () => { alive = false }
  }, [shardId])

  // Prepare languages and fetch all lines (main + refs) once
  const languages = useMemo(() => 
    shard?.data?.languages?.map(l => ({ 
      code: l.language_code || l.code || 'en',
      filename: l.filename || l.file || '',
      subtitle_id: l.subtitle_id
    })) || [],
    [shard?.data?.languages]
  )

  // load lines
  const { lines } = useSubtitleLines(languages)
  const { groups, total } = useSubtitleGroups(lines, languages?.[0]?.code, languages)
  useEffect(() => { setTotalGroups(total) }, [total])

  // flush on unmount
  useEffect(() => {
    return () => {
      syncNow()
    }
  }, [syncNow])

  // Toggle and ensure-select helpers
  const toggleWord = useCallback((word, forceSelect) => {
    setSelectedWords(prev => {
      const next = new Set(prev)
      if (!forceSelect && next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }, [])

  // Short press delegates overlay opening to OverlayManager
  // (duplicated state removed)
  const explainWord = useCallback((word, pos) => {
    toggleWord(word, 1)
    setUiToolbar(false)
    setExplainWordState(word)
  }, [toggleWord])

  // Handle review click (placeholder)
  const handleReviewClick = () => {
    // TODO: Implement review feature
  }

  // Scroll handling is minimal; OverlayManager handles drawers/toolbar
  const handleScroll = useCallback((e, currentPos) => {
    if (Number.isFinite(currentPos)) setCurrentGroup(currentPos)
  }, [])

  const movieName = shard?.data?.languages?.[0]?.movie_name || shard?.name || ''
  
  // langSet initialized inside OverlayManager

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
      {/* Overlay manager renders toolbar and drawers */}

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
            {movieName}
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
              // py: 0.2,
              px: 1,
              ml: 1,
              minHeight: 'auto'
            }}
          >
            25
          </Chip>
        </Stack>

        <Typography level="body-xs" color="neutral" sx={{ opacity: 0.7 }}>
          {currentGroup}/{totalGroups}
        </Typography>
      </Stack>

      <OverlayManager
        title={movieName}
        languages={languages}
        onSettingsChange={setSettings}
        toolbar={showToolbar}
        explain={toExplain}
        onBack={onBack}
      />

      <SubtitleViewer
        groups={groups}
        selectedWords={selectedWords}
        settings={uiSettings}
        languages={languages}
        position={initialGroup}
        onWord={(word, type, pos) => { type === 'long' ? toggleWord(word, false) : explainWord(word, pos) }}
        onEmptyClick={() => { setExplainWordState(null); setUiToolbar((v) => !v) }}
        onScroll={(e, idx) => Number.isFinite(idx) && setCurrentGroup(idx)}
        onCurrentGroupChange={(idx) => {
          setCurrentGroup(idx)
        }}
      />
    </Box>
  )
}
