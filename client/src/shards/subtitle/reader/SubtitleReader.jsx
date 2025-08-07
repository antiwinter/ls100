import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Box, Typography, LinearProgress, Stack, Chip } from '@mui/joy'
import { Bolt } from '@mui/icons-material'
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
  
  // Track dict state with ref for immediate access
  const dictStateRef = useRef({ visible: false, word: '', position: 'bottom' })
  
  // Update ref whenever dict state changes
  useEffect(() => {
    dictStateRef.current = dictDrawer
  }, [dictDrawer])
  
  // Function to get current dict state
  const getDictState = useCallback(() => dictStateRef.current, [])
  
  // Word sync worker
  const { queueAdd, queueRemove: _queueRemove } = useWordSync(shardId)

  // Stable word click handler with smart positioning
  const handleWordClick = useCallback((word, suggestedPosition) => {
    setDictDrawer(prev => {
      setShowToolbar(false)
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

  const loadShard = useCallback(async () => {
    try {
      const data = await apiCall(`/api/shards/${shardId}`)
      setShard(data.shard)
    } catch (error) {
      log.error('Failed to load shard:', error)
    } finally {
      setLoading(false)
    }
  }, [shardId])

  const loadSelectedWords = useCallback(async () => {
    try {
      const data = await apiCall(`/api/subtitle-shards/${shardId}/words`)
      setSelectedWords(new Set(data.words || []))
    } catch (error) {
      log.error('Failed to load selected words:', error)
    }
  }, [shardId])

  // Load shard and selected words
  useEffect(() => {
    loadShard()
    loadSelectedWords()
  }, [loadShard, loadSelectedWords])

  // Handle empty space clicks - dismiss dictionary or toggle toolbar
  const handleEmptyClick = useCallback(() => {  
    if (getDictState()?.visible) {
      // If dict is open, close it
      setDictDrawer(prev => ({ ...prev, visible: false }))
    } else {
      // If dict is closed, toggle toolbar
      setShowToolbar(current => !current)
    }
  }, [getDictState])

  // Handle toolbar tool selection
  const handleToolSelect = (_tool) => {
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
          bgcolor: 'background.body'
        }}
      >
        <Typography level="body-xs" color="neutral" sx={{ opacity: 0.7 }}>
          {movieName}
        </Typography>
        <Chip
          variant="solid"
          color="primary"
          size="sm"
          startDecorator={<Bolt />}
          onClick={handleReviewClick}
          sx={{ cursor: 'pointer' }}
        >
          25
        </Chip>
      </Stack>

      {/* Main viewer - memoized for stability */}
      <MemoizedSubtitleViewer
        shard={shard}
        selectedWords={selectedWords}
        onWordClick={handleWordClick}
        onEmptyClick={handleEmptyClick}
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