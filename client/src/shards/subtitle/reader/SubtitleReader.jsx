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
import { ExportDrawer } from './ExportDrawer.jsx'
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
  
  // Track langSet with ref to avoid SubtitleViewer re-renders
  const langSetRef = useRef(new Set())
  
  useEffect(() => {
    langSetRef.current = langSet
  }, [langSet])
  
  // Track dict state with ref for immediate access
  const dictStateRef = useRef({ visible: false, word: '', position: 'bottom' })
  
  // Track action drawer state with ref for immediate access
  const actionDrawerRef = useRef({ open: false, size: 'half', tool: null })
  
  // Update refs whenever states change
  useEffect(() => {
    dictStateRef.current = dictDrawer
  }, [dictDrawer])
  
  useEffect(() => {
    actionDrawerRef.current = actionDrawer
  }, [actionDrawer])
  
  // Function to get current dict state
  const getDictState = useCallback(() => dictStateRef.current, [])
  
  // Function to get current action drawer state
  const getActionDrawerState = useCallback(() => actionDrawerRef.current, [])
  
  // Track toolbar state with ref for immediate access
  const toolbarVisibleRef = useRef(false)
  
  useEffect(() => {
    toolbarVisibleRef.current = showToolbar
  }, [showToolbar])
  
  // Unified drawer state helpers - stable functions using refs
  const hasAnyDrawerOpen = useCallback(() => {
    const dictState = getDictState()
    const actionState = getActionDrawerState()
    return dictState?.visible || actionState.open
  }, [getDictState, getActionDrawerState])
  
  const closeAllDrawers = useCallback(() => {
    setDictDrawer({ visible: false, word: '', position: 'bottom' })
    setActionDrawer({ open: false, size: 'half', tool: null })
  }, [])
  
  const isToolbarVisible = useCallback(() => toolbarVisibleRef.current, [])
  
  // Viewport-only styling - like word highlighting
  const handleChangeFontMode = useCallback((mode) => {
    log.debug(`🎯 handleChangeFontMode: ${mode} - VIEWPORT ONLY`)
    
    // Mark to skip the next scroll event
    skipNextScrollRef.current = true
    log.debug('🔒 Will skip next scroll event due to font change')
    
    setFontMode(mode)
    // Apply font to current viewport only via imperative call
    viewerRef.current?.applyFontToViewport?.({ family: fontStack(mode) })
  }, [])
  
  const handleChangeFontSize = useCallback((size) => {
    log.debug(`🎯 handleChangeFontSize: ${size} - VIEWPORT ONLY`)
    
    // Mark to skip the next scroll event
    skipNextScrollRef.current = true
    log.debug('🔒 Will skip next scroll event due to font change')
    
    setFontSize(size)
    // Apply font to current viewport only via imperative call
    viewerRef.current?.applyFontToViewport?.({ size })
  }, [])
  
  const handleToggleLang = useCallback((code) => {
    log.debug(`🎯 handleToggleLang: ${code} - VIEWPORT ONLY`)
    
    // Mark to skip the next scroll event
    skipNextScrollRef.current = true
    log.debug('🔒 Will skip next scroll event due to language toggle')
    
    setLangSet(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      
      // Apply visibility to current viewport only
      const visible = next.has(code)
      viewerRef.current?.applyLangVisibilityToViewport?.(code, visible)
      log.debug(`✅ Language ${code} visibility applied to viewport: ${visible}`)
      return next
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

  // Handle empty space clicks - unified behavior
  const handleEmptyClick = useCallback(() => {  
    if (hasAnyDrawerOpen() || isToolbarVisible()) {
      // If anything is open, close all drawers and toolbar
      closeAllDrawers()
      setShowToolbar(false)
    } else {
      // If nothing is open, show toolbar
      setShowToolbar(true)
    }
  }, [hasAnyDrawerOpen, isToolbarVisible, closeAllDrawers])

  // Handle toolbar tool selection
  const handleToolSelect = (tool) => {
    const currentActionState = getActionDrawerState()
    
    // Toggle behavior: if same tool is open, close it; otherwise open the new tool
    if (currentActionState.open && currentActionState.tool === tool) {
      setActionDrawer({ open: false, size: 'half', tool: null })
    } else {
      setActionDrawer({ open: true, size: 'half', tool })
    }
    
    // Only hide toolbar for non-font tools
    if (tool !== 'font') {
      setShowToolbar(false)
    }
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

  // Track if we need to skip the next scroll event due to font operations
  const skipNextScrollRef = useRef(false)
  
  // Handle scroll events - hide action drawers + toolbar, preserve dict
  const handleScroll = useCallback((e, currentLine) => {
    log.debug(`📜 SCROLL EVENT TRIGGERED - currentLine: ${currentLine}`)
    log.debug('📜 Event target:', e?.target?.tagName, e?.target?.className)
    log.debug('📜 Event type:', e?.type)
    log.debug('📜 Skip next scroll:', skipNextScrollRef.current)
    
    // Skip this scroll event if it's caused by font/language changes
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false
      log.debug('🚫 Skipping scroll event caused by font/language change')
      // Still update current line but don't close drawers
      if (currentLine) {
        setCurrentLine(currentLine)
        currentLineRef.current = currentLine
      }
      return
    }
    
    // Hide action drawers and toolbar on scroll (preserve dict)
    setActionDrawer({ open: false, size: 'half', tool: null })
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
      const newLangSet = new Set(languages.map(l => l.code))
      setLangSet(newLangSet)
      langSetRef.current = newLangSet
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
        langSetRef={langSetRef}
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

      {/* Always render FontDrawer - just control open state */}
      <FontDrawer
        open={actionDrawer.open && actionDrawer.tool === 'font'}
        onClose={() => setActionDrawer({ open: false, size: 'half', tool: null })}
        fontMode={fontMode}
        onChangeFontMode={handleChangeFontMode}
        fontSize={fontSize}
        onChangeFontSize={handleChangeFontSize}
        languages={languages}
        langSet={langSet}
        mainLanguageCode={languages?.[0]?.code}
        onToggleLang={handleToggleLang}
      />
      
      {/* Always render ExportDrawer - just control open state */}
      <ExportDrawer
        open={actionDrawer.open && actionDrawer.tool === 'export'}
        onClose={() => setActionDrawer({ open: false, size: 'half', tool: null })}
        selectedWords={Array.from(selectedWords.current)}
        movieName={movieName}
        shardId={shardId}
        currentLine={currentLine}
        lines={lines}
      />
      
      {/* Always render ToolbarFuncs - just control open state */}
      <ToolbarFuncs
        open={actionDrawer.open && actionDrawer.tool !== 'font' && actionDrawer.tool !== 'export'}
        size={actionDrawer.size}
        onClose={() => setActionDrawer({ open: false, size: 'half', tool: null })}
      />
    </Box>
  )
}

// Memoized SubtitleViewer with development re-render monitoring
const MemoizedSubtitleViewer = memo((props) => {
  // Monitor re-renders in development - hooks must always be called
  const renderCountRef = useRef(0)
  renderCountRef.current++
  
  useEffect(() => {
    if (import.meta.env.DEV && renderCountRef.current > 1) {
      // this is crucial, never remove
      log.warn(`🔄 SubtitleViewer re-render #${renderCountRef.current}`)
    }
  })
  
  return <SubtitleViewer {...props} />
})