import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
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
  currentIndex, 
  selectedWords = new Set(), 
  onWordClick,
  onToolbarRequest
}) => {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const loadedRef = useRef(false)
  const viewerRef = useRef(null)

  // Load when shard changes
  useEffect(() => {
    const loadAllLines = async () => {
      if (!shard?.data?.languages?.[0] || loadingRef.current || loadedRef.current) {
        log.debug(`📥 Skip loading: loading=${loadingRef.current}, loaded=${loadedRef.current}`)
        return
      }

      loadingRef.current = true
      setLoading(true)
      log.debug(`📥 Loading all lines`)
      
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
      log.debug(`📥 Shard changed, resetting and loading`)
      loadAllLines()
    }
  }, [shard?.data?.languages?.[0]?.subtitle_id])

  // Handle word click via event delegation - no context coupling
  const handleClick = (e) => {
    const { word } = e.target.dataset
    if (word?.length > 1) {
      e.stopPropagation()
      
      // Performance tracking for drawer opening
      const startTime = performance.now()
      log.debug(`🎯 Word click start: ${word}`)
      
      const position = e.target.offsetTop < window.innerHeight / 2 ? 'top' : 'bottom'
      onWordClick?.(word, position)
      
      // Log immediate response time
      log.debug(`🎯 Word click to drawer: ${(performance.now() - startTime).toFixed(2)}ms`)
    } else {
      onToolbarRequest?.()
    }
  }

  // Render clickable text with word selection (optimized)
  const renderText = (text) => {
    if (!text) return null
    
    return text.split(/(\s+)/).map((part, idx) => {
      if (/\s/.test(part)) return part
      
      const cleanWord = part.replace(/[^\w]/g, '').toLowerCase()
      const isSelected = selectedWords.has(cleanWord)
      
      return (
        <span
          key={idx}
          data-word={cleanWord}
          style={{
            cursor: 'pointer',
            padding: '2px 1px',
            borderRadius: '3px',
            backgroundColor: isSelected ? 'var(--joy-palette-primary-100)' : 'transparent',
            color: isSelected ? 'var(--joy-palette-primary-700)' : 'inherit',
            display: 'inline-block',
            lineHeight: 'inherit'
          }}
        >
          {part}
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

  return (
    <Box
      ref={viewerRef}
      onClick={handleClick}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <InfiniteScroll
        loading={loading}
      >
        {entries.map(([timestamp, lines]) => {
          const isCurrent = lines.some(line => line.actualIndex === currentIndex)
          
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
                <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
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
export const SubtitleViewer = memo(SubtitleViewerComponent)