import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'
import { Box, Typography, LinearProgress, Stack, Chip } from '@mui/joy'
import { Bolt } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { Dict } from './Dict.jsx'
import { useSync } from './sync.js'
import { ToolbarFuncs } from './ToolbarFuncs.jsx'
import { Toolbar } from './Toolbar.jsx'
import { SubtitleViewer } from './SubtitleViewer.jsx'
import { useSubtitleLines } from './hooks/useSubtitleLines.js'
import { FontDrawer } from './FontDrawer.jsx'
import { fontStack } from '../../../utils/font'

export const SubtitleReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)
  const [loading, setLoading] = useState(true)
  const selectedWords = useRef(new Set())
  const [showToolbar, setShowToolbar] = useState(false)
  const [currentLine, setCurrentLine] = useState(0)
  const currentLineRef = useRef(0)
  const [totalLines, setTotalLines] = useState(0)
  const viewerRef = useRef(null)
  
  // Prepare languages and fetch all lines (main + refs) once
  const languages = useMemo(() => 
    shard?.data?.languages?.map(l => ({ 
      code: l.language_code || l.code || 'en',
      filename: l.filename || l.file || '',
      subtitle_id: l.subtitle_id
    })) || [],
    [shard?.data?.languages]
  )
  const { lines, loading: linesLoading } = useSubtitleLines(languages)
  
  // Local drawer states - simple and direct
  const [dictDrawer, setDictDrawer] = useState({ visible: false, word: '', position: 'bottom' })
  const [actionDrawer, setActionDrawer] = useState({ open: false, size: 'half', tool: null })

  // Font settings
  const [fontMode, setFontMode] = useState('sans')
  const [fontSize, setFontSize] = useState(16)
  const [langSet, setLangSet] = useState(new Set())
  
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
      // refresh selection for current viewport without re-render
      viewerRef.current?.refreshSelection?.(Math.max(0, (currentLineRef.current || 1) - 1))
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
          // ensure selection overlays reflect baseline right away
          viewerRef.current?.refreshSelection?.(Math.max(0, line - 1))
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
  const handleToolSelect = (tool) => {
    setActionDrawer({ open: true, size: 'half', tool })
    setShowToolbar(false)
  }

  // (deprecated) legacy word click handler removed

  // Toggle and ensure-select helpers
  const toggleWord = useCallback((w, f) => {
    const s = selectedWords.current
    if (!f && s.has(w)) {
      s.delete(w)
    } else {
      s.add(w)
    }
  }, [])

  // Short press: ensure selected and open dict
  const explainWord = useCallback((word, pos) => {
    toggleWord(word, 1)
    setShowToolbar(false)
    setDictDrawer({ visible: true, word, position: pos })
  }, [toggleWord])

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



  const movieName = shard?.data?.languages?.[0]?.movie_name || shard?.name || ''
  
  // init langSet once when shard loads
  useEffect(() => {
    if (languages.length) {
      setLangSet(new Set(languages.map(l => l.code)))
    }
  }, [languages])

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
        lines={lines}
        loading={linesLoading}
        selectedWordsRef={selectedWords}
        langSet={langSet}
        mainLanguageCode={languages?.[0]?.code}
        languages={languages}
        onWordShort={explainWord}
        onWordLong={toggleWord}
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

      {actionDrawer.tool === 'font' ? (
        <FontDrawer
          open={actionDrawer.open}
          onClose={() => setActionDrawer({ open: false, size: 'half', tool: null })}
          fontMode={fontMode}
          onChangeFontMode={(mode) => {
            setFontMode(mode)
            // apply immediately via CSS vars
            viewerRef.current?.setFontStyle?.({ family: fontStack(mode) })
          }}
          fontSize={fontSize}
          onChangeFontSize={(size) => {
            setFontSize(size)
            // apply immediately via CSS vars
            viewerRef.current?.setFontStyle?.({ size })
          }}
          languages={languages}
          langSet={langSet}
          mainLanguageCode={languages?.[0]?.code}
          onToggleLang={(code) => setLangSet(prev => {
            const next = new Set(prev)
            if (next.has(code)) next.delete(code); else next.add(code)
            // Imperatively toggle ref visibility for better performance
            const visible = next.has(code)
            viewerRef.current?.setRefLangVisibility?.(code, visible)
            return next
          })}
        />
      ) : (
        <ToolbarFuncs
          open={actionDrawer.open}
          size={actionDrawer.size}
          onClose={() => setActionDrawer({ open: false, size: 'half', tool: null })}
        />
      )}
    </Box>
  )
}

// Memoize SubtitleViewer to prevent unnecessary re-renders
const MemoizedSubtitleViewer = memo(SubtitleViewer)