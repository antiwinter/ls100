import { useEffect, useCallback, useMemo, useReducer } from 'react'
import { Box, Typography, Stack, Chip, Button } from '@mui/joy'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { useSync } from './sync.js'
import { OverlayManager } from './overlay/OverlayManager.jsx'
import { useSubtitleGroups } from './hooks/useSubtitleGroups.js'
// UI managed inside OverlayManager; no useReaderUI here

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_SHARD':
      return { ...state, shard: action.shard }
    case 'LOAD_WORDS':
      return { ...state, selectedWords: action.words || [] }
    case 'SET_POSITION':
      return { ...state, position: { ...state.position, current: action.position } }
    case 'SET_SEEK':
      return { ...state, position: { ...state.position, seek: action.seek } }
    case 'SET_TOTAL':
      return { ...state, position: { ...state.position, total: action.total } }
    case 'SET_EXPLAIN':
      // Set explain word with position and fall through to auto-select it
      state = { ...state, ui: { ...state.ui, toExplain: action.data } }
      action.word = action.data?.word
      action.forceSelect = true
      // fall through to TOGGLE_WORD
    case 'TOGGLE_WORD': {
      const words = state.selectedWords
      const exists = words.includes(action.word)
      return {
        ...state,
        selectedWords: exists && !action.forceSelect
          ? words.filter(w => w !== action.word)
          : exists ? words : [...words, action.word]
      }
    }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case 'TOGGLE_TOOLBAR':
      return { ...state, ui: { ...state.ui, showToolbar: !state.ui.showToolbar } }
    case 'SET_TOOLBAR':
      return { ...state, ui: { ...state.ui, showToolbar: action.show } }
    default:
      return state
  }
}

export const SubtitleReader = ({ shardId, onBack }) => {
  const [state, dispatch] = useReducer(reducer, {
    shard: null,
    position: { current: 0, seek: null, total: 0 },
    selectedWords: [],
    settings: {},
    ui: { showToolbar: false, toExplain: null }
  })

  // setup general sync loop (10s)
  const { syncNow } = useSync(shardId, new Set(state.selectedWords), state.position.current, 10000)
  
  // Load shard and selected words (mount + shard change)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiCall(`/api/shards/${shardId}`)
        if (!alive) return
        dispatch({ type: 'LOAD_SHARD', shard: data.shard })
      } catch (error) {
        log.error('Failed to load shard:', error)
      }
    })()

    ;(async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/words`)
        const words = data.words || []
        if (!alive) return
        dispatch({ type: 'LOAD_WORDS', words })
        log.debug(`📝 Loaded ${words.length} selected words`)
        // baseline handled automatically in useSync
      } catch (error) {
        log.error('Failed to load selected words:', error)
      }
    })()

    ;(async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/position`)
        const position = data?.position || 0
        if (!alive) return
        // Only set seek position - viewer will emit range change after successful scroll
        dispatch({ type: 'SET_SEEK', seek: position })
      } catch (error) {
        log.error('Failed to load position:', error)
      }
    })()

    return () => { alive = false }
  }, [shardId])

  // Use languages directly from shard data - only when shard is loaded
  const languages = state.shard?.data?.languages || []

  // load lines and groups - will handle empty languages gracefully
  const { groups, total, loading } = useSubtitleGroups(languages)
  useEffect(() => { dispatch({ type: 'SET_TOTAL', total }) }, [total])

  // flush on unmount
  useEffect(() => {
    return () => {
      syncNow()
    }
  }, [syncNow])

  // Handle review click (placeholder)
  const handleReviewClick = () => {
    // TODO: Implement review feature
  }

  const shardName = state.shard?.name || ''  
  if (!state.shard) {
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
          {state.position.current}/{state.position.total}
        </Typography>
      </Stack>

      <OverlayManager
        title={shardName}
        languages={languages}
        onSettingsChange={(settings) => dispatch({ type: 'UPDATE_SETTINGS', settings })}
        toolbar={state.ui.showToolbar}
        explain={state.ui.toExplain}
        onBack={onBack}
      />

      <SubtitleViewer
        groups={groups}
        selectedWords={new Set(state.selectedWords)}
        settings={state.settings}
        position={state.position.seek}
        onWord={(word, type, pos) => {
          if (type === 'long') {
            dispatch({ type: 'TOGGLE_WORD', word })
          } else {
            dispatch({ type: 'SET_TOOLBAR', show: false })
            dispatch({ type: 'SET_EXPLAIN', data: { word, pos } })
          }
        }}
        onEmptyClick={() => { 
          dispatch({ type: 'SET_EXPLAIN', data: null })
          dispatch({ type: 'TOGGLE_TOOLBAR' })
        }}
        onScroll={(e) => {
          // Hide toolbar on scroll, don't update position
          if (state.ui.showToolbar) {
            dispatch({ type: 'SET_TOOLBAR', show: false })
          }
        }}
        onCurrentGroupChange={(idx) => {
          dispatch({ type: 'SET_POSITION', position: idx })
        }}
      />
    </Box>
  )
}
