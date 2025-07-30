import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Stack,
  Typography,
  Button,
  Card,
  CircularProgress
} from '@mui/joy'
import { RateReview } from '@mui/icons-material'
import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'

// Multi-language subtitle display with infinite scroll and word selection
export const SubtitleViewer = ({ 
  shard, 
  currentIndex, 
  selectedWords = new Set(), 
  onWordClick, 
  onToolbarRequest, 
  onReviewClick 
}) => {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const viewerRef = useRef(null)
  const observerRef = useRef(null)

  // Load subtitle lines with pagination
  const loadLines = useCallback(async (pageNum = 0, reset = false) => {
    if (loading || (!hasMore && pageNum > 0)) return

    setLoading(true)
    
    try {
      const languages = shard?.data?.languages || []
      if (languages.length === 0) return

      // Load from first subtitle for now
      const subtitleId = languages[0].subtitle_id
      const limit = 50 // Lines per page
      const offset = pageNum * limit
      
      const data = await apiCall(
        `/api/subtitles/${subtitleId}/lines?limit=${limit}&offset=${offset}`
      )
      
      const newLines = data.lines || []
      
      if (reset) {
        setLines(newLines)
      } else {
        setLines(prev => [...prev, ...newLines])
      }
      
      setHasMore(newLines.length === limit)
      setPage(pageNum)
      
      log.debug(`Loaded ${newLines.length} lines, page ${pageNum}`)
    } catch (error) {
      log.error('Failed to load subtitle lines:', error)
    } finally {
      setLoading(false)
    }
  }, [shard, loading, hasMore])

  // Initial load
  useEffect(() => {
    if (shard?.data?.languages?.length > 0) {
      loadLines(0, true)
    }
  }, [shard, loadLines])

  // Infinite scroll intersection observer
  useEffect(() => {
    if (!viewerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !loading) {
          loadLines(page + 1)
        }
      },
      { threshold: 0.5 }
    )

    observerRef.current = observer
    
    // Observe the last element
    const lastElement = viewerRef.current.lastElementChild
    if (lastElement) {
      observer.observe(lastElement)
    }

    return () => observer.disconnect()
  }, [lines, page, hasMore, loading, loadLines])

  // Handle click anywhere to show toolbar
  const handleViewerClick = (e) => {
    // Don't trigger toolbar if clicking on a word
    if (!e.target.dataset.word && onToolbarRequest) {
      onToolbarRequest()
    }
  }

  // Handle word click
  const handleWordClick = (e) => {
    const word = e.target.dataset.word
    if (word && word.length > 1) {
      e.stopPropagation()
      if (onWordClick) {
        onWordClick(word, e.target)
      }
    }
  }

  // Render clickable text with word selection
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
          onClick={handleWordClick}
          style={{
            cursor: 'pointer',
            padding: '2px 1px',
            borderRadius: '3px',
            backgroundColor: isSelected ? 'var(--joy-palette-primary-100)' : 'transparent',
            color: isSelected ? 'var(--joy-palette-primary-700)' : 'inherit',
            transition: 'all 0.2s ease',
            minHeight: '44px', // Touch-friendly
            display: 'inline-block',
            lineHeight: '1.4'
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.target.style.backgroundColor = 'var(--joy-palette-neutral-100)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.target.style.backgroundColor = 'transparent'
            }
          }}
        >
          {part}
        </span>
      )
    })
  }

  // Group lines by timestamp for multi-language display
  const groupedLines = lines.reduce((groups, line) => {
    const timestamp = line.data?.start || 0
    if (!groups[timestamp]) {
      groups[timestamp] = []
    }
    groups[timestamp].push(line)
    return groups
  }, {})

  const movieName = shard?.data?.languages?.[0]?.movie_name || shard?.name

  return (
    <Box
      ref={viewerRef}
      onClick={handleViewerClick}
      sx={{
        flex: 1,
        overflow: 'auto',
        pt: 8, // Space for toolbar
        pb: 2
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 2, py: 1, mb: 2 }}
      >
        <Typography level="body-sm" color="neutral">
          {movieName}
        </Typography>
        <Button
          variant="plain"
          size="sm"
          startDecorator={<RateReview />}
          onClick={onReviewClick}
          sx={{ minHeight: 'auto' }}
        >
          Review
        </Button>
      </Stack>

      {/* Subtitle content */}
      <Stack spacing={3} sx={{ px: 2 }}>
        {Object.entries(groupedLines).map(([timestamp, groupLines]) => {
          const isCurrentGroup = groupLines.some(line => 
            lines.indexOf(line) === currentIndex
          )
          
          return (
            <Card
              key={timestamp}
              variant={isCurrentGroup ? 'soft' : 'outlined'}
              sx={{
                p: 2,
                backgroundColor: isCurrentGroup 
                  ? 'var(--joy-palette-primary-50)' 
                  : 'transparent'
              }}
            >
              {/* Timestamp */}
              <Typography level="body-xs" color="neutral" sx={{ mb: 1 }}>
                {formatTime(parseInt(timestamp))}
              </Typography>
              
              {/* Languages */}
              <Stack spacing={1}>
                {groupLines.map((line, idx) => {
                  const language = getLanguageInfo(line, shard)
                  
                  return (
                    <Box key={idx}>
                      <Typography
                        level="body-sm"
                        color="neutral"
                        sx={{ fontSize: 'xs', mb: 0.5 }}
                      >
                        {language.name}
                      </Typography>
                      <Typography
                        level="body-md"
                        sx={{
                          lineHeight: 1.6,
                          fontSize: language.code === 'zh' ? 'lg' : 'md'
                        }}
                      >
                        {renderText(line.data?.text)}
                      </Typography>
                    </Box>
                  )
                })}
              </Stack>
            </Card>
          )
        })}

        {/* Loading indicator */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size="sm" />
          </Box>
        )}

        {/* End indicator */}
        {!hasMore && lines.length > 0 && (
          <Typography 
            level="body-sm" 
            color="neutral" 
            sx={{ textAlign: 'center', py: 2 }}
          >
            End of subtitles
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

// Format time from milliseconds
const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Get language info for display
const getLanguageInfo = (line, shard) => {
  // TODO: Map subtitle_id to language info from shard data
  return {
    name: 'English', // Placeholder
    code: 'en'
  }
}