import { useState, useEffect, useCallback, useContext, memo } from 'react'
import { Box, Typography, LinearProgress, Button, Stack } from '@mui/joy'
import { RateReview } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { ReaderProvider, ReaderCtx } from './ReaderCtx.jsx'
import { Dict } from './Dict.jsx'
import { ToolbarFuncs } from './ToolbarFuncs.jsx'
import { Toolbar } from './Toolbar.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'
import { useWordSync } from './WordSync.js'

// Inner component - context-agnostic, stable
const SubtitleReaderInner = ({ shardId, onBack, onWordClick, onToolbarAction }) => {
  const [shard, setShard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedWords, setSelectedWords] = useState(new Set())
  const [showToolbar, setShowToolbar] = useState(false)
  
  // Word sync worker
  const { queueAdd, queueRemove } = useWordSync(shardId)

  // Load shard and selected words
  useEffect(() => {
    loadShard()
    loadSelectedWords()
  }, [shardId])

  const loadShard = async () => {
    try {
      const data = await apiCall(`/api/shards/${shardId}`)
      setShard(data.shard)
    } catch (error) {
      log.error('Failed to load shard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSelectedWords = async () => {
    try {
      const data = await apiCall(`/api/subtitle-shards/${shardId}/words`)
      setSelectedWords(new Set(data.words || []))
    } catch (error) {
      log.error('Failed to load selected words:', error)
    }
  }

  // Handle toolbar visibility
  const handleToolbarRequest = () => {
    setShowToolbar(true)
  }

  // Handle toolbar tool selection
  const handleToolSelect = (tool) => {
    onToolbarAction?.()
    setShowToolbar(false)
  }

  // Handle review click (placeholder)
  const handleReviewClick = () => {
    log.debug('Review clicked')
    // TODO: Implement review feature
  }

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading subtitle...</Typography>
        <LinearProgress sx={{ mt: 2 }} />
      </Box>
    )
  }

  if (!shard) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="danger">Shard not found</Typography>
        <Button onClick={onBack} sx={{ mt: 2 }}>Go Back</Button>
      </Box>
    )
  }

  const movieName = shard.data?.languages?.[0]?.movie_name || shard.name

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <Toolbar
        visible={showToolbar}
        onBack={onBack}
        onToolSelect={handleToolSelect}
        movieName={movieName}
      />

      {/* Header with Movie Name and Review */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ 
          px: 1, 
          py: 0.5,
          bgcolor: 'background.body',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography level="body-sm" color="neutral">
          {movieName}
        </Typography>
        <Button
          variant="plain"
          size="sm"
          startDecorator={<RateReview />}
          onClick={handleReviewClick}
          sx={{ minHeight: 'auto', py: 0.5 }}
        >
          Review
        </Button>
      </Stack>

      {/* Main viewer - context-agnostic, stable */}
      <SubtitleViewer
        shard={shard}
        selectedWords={selectedWords}
        onWordClick={onWordClick}
        onToolbarRequest={handleToolbarRequest}
      />
    </Box>
  )
}

// Memoize the inner component to prevent unnecessary re-renders
const MemoizedSubtitleReaderInner = memo(SubtitleReaderInner)

// Context wrapper component - isolates context consumption
const SubtitleReaderWithContext = ({ shardId, onBack }) => {
  const { setDictDrawer, setActionDrawer } = useContext(ReaderCtx)

  // Stable handlers - setState functions are stable, no deps needed
  const handleWordClick = useCallback((word, position) => {
    setDictDrawer({ visible: true, word, position })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToolbarAction = useCallback(() => {
    setActionDrawer({ open: true, size: 'half' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <MemoizedSubtitleReaderInner 
        shardId={shardId} 
        onBack={onBack}
        onWordClick={handleWordClick}
        onToolbarAction={handleToolbarAction}
      />
      {/* State isolated components - only here, not in inner */}
      <Dict />
      <ToolbarFuncs />
    </>
  )
}

// Outer component with context provider
export const SubtitleReader = ({ shardId, onBack }) => {
  return (
    <ReaderProvider>
      <SubtitleReaderWithContext shardId={shardId} onBack={onBack} />
    </ReaderProvider>
  )
}