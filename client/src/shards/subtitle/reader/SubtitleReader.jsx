import { useState, useEffect, useCallback, memo } from 'react'
import { Box, Typography, LinearProgress, Button, Stack } from '@mui/joy'
import { RateReview } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { Dict } from './Dict.jsx'
import { ToolbarFuncs } from './ToolbarFuncs.jsx'
import { Toolbar } from './Toolbar.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'
import { useWordSync } from './WordSync.js'

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedWords, setSelectedWords] = useState(new Set())
  const [showToolbar, setShowToolbar] = useState(false)
  
  // Local drawer states - simple and direct
  const [dictDrawer, setDictDrawer] = useState({ visible: false, word: '', position: 'bottom' })
  const [actionDrawer, setActionDrawer] = useState({ open: false, size: 'half' })
  
  // Word sync worker
  const { queueAdd, queueRemove } = useWordSync(shardId)

  // Stable word click handler with smart positioning
  const handleWordClick = useCallback((word, suggestedPosition) => {
    setDictDrawer(prev => {
      const newPosition = prev.visible ? prev.position : suggestedPosition
      log.debug(`📖 Dict ${prev.visible ? 'open' : 'closed'} → position: ${prev.visible ? 'kept' : 'new'} (${newPosition})`)
      
      return {
        visible: true,
        word,
        // Only update position if dict was closed - keep current position if already open
        position: newPosition
      }
    })
  }, [])

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

  // Handle toolbar visibility - stable function
  const handleToolbarRequest = useCallback(() => {
    setShowToolbar(true)
  }, [])

  // Handle empty space clicks - dismiss dictionary
  const handleEmptyClick = useCallback(() => {
    setDictDrawer(prev => ({ ...prev, visible: false }))
  }, [])

  // Handle toolbar tool selection
  const handleToolSelect = (tool) => {
    setActionDrawer({ open: true, size: 'half' })
    setShowToolbar(false)
  }

  // Handle word selection from dictionary
  const handleWordSelect = (word) => {
    const newWords = new Set(selectedWords)
    newWords.add(word)
    setSelectedWords(newWords)
    queueAdd(word)
    setDictDrawer({ visible: false, word: '', position: 'bottom' })
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

      {/* Main viewer - memoized for stability */}
      <MemoizedSubtitleViewer
        shard={shard}
        selectedWords={selectedWords}
        onWordClick={handleWordClick}
        onEmptyClick={handleEmptyClick}
        onToolbarRequest={handleToolbarRequest}
      />

      {/* Direct drawer components with props */}
      <Dict
        word={dictDrawer.word}
        position={dictDrawer.position}
        visible={dictDrawer.visible}
        onClose={() => setDictDrawer({ visible: false, word: '', position: 'bottom' })}
        onWordSelect={handleWordSelect}
      />

      <ToolbarFuncs
        open={actionDrawer.open}
        size={actionDrawer.size}
        onClose={() => setActionDrawer({ open: false, size: 'half' })}
      />
    </Box>
  )
}

// Memoize SubtitleViewer to prevent unnecessary re-renders
const MemoizedSubtitleViewer = memo(SubtitleViewer)