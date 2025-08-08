import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Box, Typography, LinearProgress, Stack, Chip } from '@mui/joy'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { Dict } from './Dict.jsx'
import { useSync } from './sync.js'
import { ToolbarFuncs } from './ToolbarFuncs.jsx'
import { Toolbar } from './Toolbar.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'

// Stable empty set to prevent re-renders
const EMPTY_SET = new Set()

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)
  const [loading, setLoading] = useState(true)
  const selectedWords = useRef(new Set())
  const [showToolbar, setShowToolbar] = useState(false)
  const [currentLine, setCurrentLine] = useState(0)
  const currentLineRef = useRef(0)
  const [totalLines, setTotalLines] = useState(0)
  const viewerRef = useRef(null)
  
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
      const words = data.words || []
      
      // Store in ref without triggering React re-render
      selectedWords.current.clear()
      words.forEach(word => selectedWords.current.add(word))
      
      log.debug(`📝 Loaded ${words.length} selected words`)
    } catch (error) {
      log.error('Failed to load selected words:', error)
    }
  }, [shardId])

  // Load shard and selected words
  useEffect(() => {
    loadShard()
    loadSelectedWords()
  }, [loadShard, loadSelectedWords])

  // setup general sync loop (10s)
  const { ackWords, ackPosition, syncNow } = useSync(shardId, selectedWords, currentLineRef, 10000)

  // ack words baseline after initial loadSelectedWords finishes
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        // wait a microtask to ensure loadSelectedWords ran in first effect
        await Promise.resolve()
        if (mounted) ackWords()
      } catch {
        // ignore
      }
    }
    init()
    return () => { mounted = false }
  }, [ackWords, shardId])

  // flush on unmount
  useEffect(() => {
    return () => {
      syncNow()
    }
  }, [syncNow])

  // load initial position baseline (single fetch)
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await apiCall(`/api/subtitle-shards/${shardId}/position`)
        const line = data?.position || 0
        if (!mounted) return
        ackPosition(line)
        if (line > 0) {
          // Imperatively set viewer position without emitting onScroll
          if (viewerRef.current?.setPosition) {
            viewerRef.current.setPosition(line - 1)
          }
          setCurrentLine(line)
          currentLineRef.current = line
        }
      } catch {
        // ignore
      }
    }
    // microtask to avoid double call loops on strict mode or remount
    Promise.resolve().then(() => mounted && load())
    return () => { mounted = false }
  }, [shardId, ackPosition])

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

  // Simple word click handler - only manages Set
  const handleWordClickToggle = useCallback((word, suggestedPosition) => {
    const currentWords = selectedWords.current
    const currentlySelected = currentWords.has(word)
    
    if (currentlySelected) {
      currentWords.delete(word)
    } else {
      currentWords.add(word)
    }
    
    // Show dictionary
    setDictDrawer(prev => {
      setShowToolbar(false)
      const newPosition = prev.visible ? prev.position : suggestedPosition
      
      return {
        visible: true,
        word,
        position: newPosition
      }
    })
  }, []) // No dependencies needed

  // Handle review click (placeholder)
  const handleReviewClick = () => {
    // TODO: Implement review feature
  }

  // Handle scroll events - hide toolbar and line updates (stable)
  const handleScroll = useCallback((e, currentLine) => {
    // Hide toolbar on scroll
    setShowToolbar(false)
    
    // Update current line from intersection
    if (currentLine) {
      setCurrentLine(currentLine)
      currentLineRef.current = currentLine
    }
  }, [])

  // Handle total lines update from SubtitleViewer (stable)
  const handleProgressUpdate = useCallback((current, total) => {
    setTotalLines(total)
  }, [])



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
          {currentLine}/{totalLines}
        </Typography>
      </Stack>

      {/* Main viewer - memoized for stability */}
      <MemoizedSubtitleViewer
        shard={shard}
        currentIndex={Math.max(0, (currentLine || 1) - 1)}
        selectedWords={EMPTY_SET} // Stable empty set to prevent re-renders
        selectedWordsRef={selectedWords} // Pass ref for attribute updates
        onWordClick={handleWordClickToggle}
        onEmptyClick={handleEmptyClick}
        onScroll={handleScroll}
        onProgressUpdate={handleProgressUpdate}
        ref={viewerRef}
      />

      {/* Direct drawer components with props */}
      <Dict
        word={dictDrawer.word}
        position={dictDrawer.position}
        visible={dictDrawer.visible}
        onClose={() => setDictDrawer({ visible: false, word: '', position: 'bottom' })}
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