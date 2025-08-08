import { useState, useEffect, useRef, useMemo, memo, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  Box,
  Stack,
  Typography
} from '@mui/joy'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'
import { InfiniteScroll } from '../../../components/InfiniteScroll'

// Multi-language subtitle display - context-agnostic, stable
const SubtitleViewerComponent = ({ 
  shard, 
  onWordClick,
  onEmptyClick,
  onScroll,
  onProgressUpdate,
  selectedWordsRef // Add selectedWordsRef prop
}, ref) => {
  const [lines, setLines] = useState([])
  const [visibleIndex, setVisibleIndex] = useState(null)
  const pendingIndexRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const loadedRef = useRef(false)
  const viewerRef = useRef(null)

  // Load when shard changes
  const subtitleId = shard?.data?.languages?.[0]?.subtitle_id
  useEffect(() => {
    const loadAllLines = async () => {
      if (!shard?.data?.languages?.[0] || loadingRef.current || loadedRef.current) {
        log.debug(`📥 Skip loading: loading=${loadingRef.current}, loaded=${loadedRef.current}`)
        return
      }

      loadingRef.current = true
      setLoading(true)
      log.debug('📥 Loading all lines')
      
      try {
        const { subtitle_id } = shard.data.languages[0]
        const data = await apiCall(`/api/subtitles/${subtitle_id}/lines?start=0&count=-1`)
        const lines = data.lines || []
        log.debug(`📥 Loaded ${lines.length} total lines`)
        setLines(lines)
        loadedRef.current = true
      } catch (error) {
        log.error('Load all lines failed:', error)
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    }

    if (shard?.data?.languages?.[0]) {
      setLines([])
      loadingRef.current = false
      loadedRef.current = false
      log.debug('📥 Shard changed, resetting and loading')
      loadAllLines()
    }
  }, [subtitleId, shard?.data?.languages])

  // Update total lines when lines change
  useEffect(() => {
    if (lines.length > 0) {
      onProgressUpdate?.(1, lines.length) // Initialize with first line
    }
  }, [lines.length, onProgressUpdate])

  // Update word attributes based on current line and selected words
  const updateWordAttributes = useCallback((currentLineIndex) => {
    if (!selectedWordsRef?.current || !viewerRef.current) return
    
    const container = viewerRef.current
    const selectedWords = selectedWordsRef.current
    
    // Find all word spans in ±30 line range
    const startLine = Math.max(0, currentLineIndex - 30)
    const endLine = Math.min(lines.length - 1, currentLineIndex + 30)
    
    // Get all word spans in range
    const wordSpans = container.querySelectorAll('[data-word]')
    
    wordSpans.forEach(span => {
      const word = span.dataset.word
      const lineIndex = parseInt(span.closest('[data-line-index]')?.dataset.lineIndex || '0')
      
      // Only process spans in the current range
      if (lineIndex >= startLine && lineIndex <= endLine) {
        const isSelected = selectedWords.has(word)
        if (isSelected) {
          span.setAttribute('data-selected', 'true')
        } else {
          span.removeAttribute('data-selected')
        }
      }
    })
  }, [selectedWordsRef, lines.length])

  // Handle word click via event delegation
  const handleClick = (e) => {
    const { word } = e.target.dataset
    if (word?.length > 1) {
      e.stopPropagation()
      
      // Calculate position for dictionary placement
      const clickY = e.clientY || 
                     (e.touches && e.touches[0]?.clientY) || 
                     (e.changedTouches && e.changedTouches[0]?.clientY) || 
                     window.innerHeight / 2
      const viewportHeight = window.innerHeight
      const position = clickY < viewportHeight / 2 ? 'bottom' : 'top'
      
      onWordClick?.(word, position)
      
      // Update word attributes immediately after click
      // Use current line or find the clicked word's line
      const clickedSpan = e.target.closest('[data-word]')
      const lineIndex = parseInt(clickedSpan?.closest('[data-line-index]')?.dataset.lineIndex || '0')
      updateWordAttributes(lineIndex)
    } else {
      // Dismiss dictionary when clicking on non-word area
      onEmptyClick?.()
    }
  }

  // Render text with pre-rendered overlays (hidden by default)
  const renderText = (text) => {
    if (!text) return null
    
    return text.split(/(\s+)/).map((part, idx) => {
      if (/\s/.test(part)) return part
      
      const cleanWord = part.replace(/[^\w]/g, '').toLowerCase()
      
      return (
        <span
          key={idx}
          data-word={cleanWord}
          style={{
            cursor: 'pointer',
            position: 'relative',
            display: 'inline-block',
            lineHeight: 'inherit'
          }}
        >
          {part}
          {/* Pure overlay shade - shown via CSS when parent has data-selected */}
          <span
            className="word-overlay"
            style={{
              position: 'absolute',
              top: '-2px',
              left: '-2px',
              right: '-2px', 
              bottom: '-2px',
              borderRadius: '4px',
              backgroundColor: 'var(--joy-palette-primary-500)',
              transition: 'opacity 0.2s ease',
              pointerEvents: 'none', // Don't interfere with clicks
              zIndex: 0 // Same level as text to show behind but visible
            }}
          />
        </span>
      )
    })
  }

  // Memoize expensive grouping computation
  const groups = useMemo(() => {
    const result = lines.reduce((acc, line, idx) => {
      const { start: timestamp } = line.data || {}
      const key = timestamp || 0
      if (!acc[key]) acc[key] = []
      acc[key].push({ ...line, actualIndex: idx })
      return acc
    }, {})
    
    // Only log when we have data to avoid spam
    if (lines.length > 0) {
      log.debug(`📊 ${lines.length} lines → ${Object.keys(result).length} groups`)
    }
    
    return result
  }, [lines])

  const entries = Object.entries(groups)

  // Imperative API: setPosition without emitting onScroll
  const tryScrollToIndex = useCallback((lineIndex) => {
    if (!viewerRef.current || !Number.isFinite(lineIndex)) return false
    const container = viewerRef.current
    const target = container.querySelector(`[data-line-index="${lineIndex}"]`)
    if (!target) return false
    target.scrollIntoView({ block: 'start' })
    updateWordAttributes(lineIndex)
    setVisibleIndex(lineIndex)
    return true
  }, [updateWordAttributes])

  useImperativeHandle(ref, () => ({
    setPosition: (lineIndex) => {
      // Try now; if lines not ready, remember to apply later
      const applied = tryScrollToIndex(lineIndex)
      if (!applied) {
        pendingIndexRef.current = lineIndex
      } else {
        pendingIndexRef.current = null
      }
    }
  }), [tryScrollToIndex])

  // When lines load or change, apply any pending scroll
  useEffect(() => {
    if (pendingIndexRef.current != null) {
      const applied = tryScrollToIndex(pendingIndexRef.current)
      if (applied) pendingIndexRef.current = null
    }
  }, [lines.length, tryScrollToIndex])

  return (
    <Box
      ref={viewerRef}
      onClick={handleClick}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        // CSS for word selection overlay
        '& .word-overlay': {
          opacity: 0 // Hidden by default
        },
        '& span[data-selected="true"] .word-overlay': {
          opacity: 0.3 // Show when selected
        }
      }}
    >
      <InfiniteScroll
        loading={loading}
        onScroll={(e, currentLine) => {
          onScroll?.(e, currentLine)
          // Update word attributes when scrolling
          if (currentLine) {
            updateWordAttributes(currentLine - 1) // Convert to 0-based index
            setVisibleIndex(currentLine - 1)
          }
        }}
      >
        {entries.map(([timestamp, lines]) => {
          const isCurrent = lines.some(line => line.actualIndex === visibleIndex)
          return (
            <Box
              key={timestamp}
              sx={{
                py: 0.1,
                mb: 1,
                backgroundColor: isCurrent ? 'var(--joy-palette-primary-50)' : 'transparent',
                borderRadius: 'sm'
              }}
            >
              {lines.map((line, idx) => (
                <Stack 
                  key={idx} 
                  direction="row" 
                  spacing={1} 
                  alignItems="flex-start"
                  data-line-index={line.actualIndex || 0}
                >
                  <Typography 
                    level="body-xs" 
                    color="neutral" 
                    sx={{ 
                      minWidth: '40px',
                      fontSize: '10px',
                      lineHeight: 1.2,
                      pt: 0.5,
                      flexShrink: 0
                    }}
                  >
                    {formatTime(parseInt(timestamp))}
                  </Typography>
                  
                  <Typography
                    level="body-sm"
                    sx={{
                      lineHeight: 1.3,
                      fontSize: getLanguageInfo().code === 'zh' ? 'md' : 'sm',
                      flex: 1
                    }}
                  >
                    {renderText(cleanSrtText(line.data?.text))}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )
        })}
      </InfiniteScroll>
    </Box>
  )
}

// Clean SRT formatting tags like {\an1}, {\pos(30,230)}, etc.
const cleanSrtText = (text) => {
  if (!text) return ''
  
  // Remove ASS/SSA formatting tags like {\an1}, {\pos(30,230)}, {\1c&Hffffff&}, etc.
  return text
    .replace(/\{\\[^}]*\}/g, '') // Remove {\tag} patterns
    .replace(/\{[^}]*\}/g, '')   // Remove other {tag} patterns
    .trim()
}

// Format time from milliseconds to MM:SS
const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Get language info for display
const getLanguageInfo = () => ({ code: 'en' }) // Simplified placeholder

// Memoize the component to prevent re-renders when unrelated state changes
export const SubtitleViewer = memo(forwardRef(SubtitleViewerComponent))