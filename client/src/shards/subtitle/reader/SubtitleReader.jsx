import { useState, useEffect } from 'react'
import { Box, Typography, LinearProgress, Button, Stack } from '@mui/joy'
import { RateReview } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { Dict as DictDrawer } from './Dict.jsx'
import { Toolbar } from './Toolbar.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'
import { ActionDrawer } from '../../../components/ActionDrawer.jsx'
import { useWordSync } from './WordSync.js'

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedWords, setSelectedWords] = useState(new Set())
  
  // Drawer states
  const [showToolbar, setShowToolbar] = useState(false)
  const [actionDrawer, setActionDrawer] = useState({ open: false, size: 'half' })
  const [dictDrawer, setDictDrawer] = useState({ visible: false, word: '', position: 'bottom' })
  
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

  // Handle word selection with performance tracking
  const handleWordClick = (word, element) => {
    const startTime = performance.now()
    
    const isSelected = selectedWords.has(word)
    
    if (isSelected) {
      // Remove word
      const newWords = new Set(selectedWords)
      newWords.delete(word)
      setSelectedWords(newWords)
      queueRemove(word)
    } else {
      // Show dictionary first - optimize position calculation
      const position = element.offsetTop < window.innerHeight / 2 ? 'top' : 'bottom'
      
      // Use React's concurrent features for immediate UI update
      setDictDrawer({ visible: true, word, position })
      
      // Log performance
      log.debug(`Word click to drawer: ${(performance.now() - startTime).toFixed(2)}ms`)
    }
  }

  // Handle adding word from dictionary
  const handleWordSelect = (word) => {
    const newWords = new Set(selectedWords)
    newWords.add(word)
    setSelectedWords(newWords)
    queueAdd(word)
    setDictDrawer({ visible: false, word: '', position: 'bottom' })
  }

  // Handle toolbar tool selection
  const handleToolSelect = (tool) => {
    setActionDrawer({ open: true, size: 'half' })
    setShowToolbar(false) // Hide toolbar when drawer opens
  }

  // Handle toolbar visibility
  const handleToolbarRequest = () => {
    setShowToolbar(true)
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
      overflow: 'hidden' // Prevent page-level scrolling
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

      {/* Main viewer */}
      <SubtitleViewer
        shard={shard}
        selectedWords={selectedWords}
        onWordClick={handleWordClick}
        onToolbarRequest={handleToolbarRequest}
      />

      {/* Action Drawer */}
      <ActionDrawer
        open={actionDrawer.open}
        onClose={() => setActionDrawer({ ...actionDrawer, open: false })}
        size={actionDrawer.size}
      >
        <Typography>Word Tools Coming Soon</Typography>
      </ActionDrawer>

      {/* Dictionary */}
      <DictDrawer
        word={dictDrawer.word}
        position={dictDrawer.position}
        visible={dictDrawer.visible}
        onClose={() => setDictDrawer({ visible: false, word: '', position: 'bottom' })}
        onWordSelect={handleWordSelect}
      />
    </Box>
  )
}